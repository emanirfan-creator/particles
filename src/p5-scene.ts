import p5 from 'p5';
import { generate2D } from './shapes';
import type { ShapeOpts } from './shapes';
import { samplePalette, hexToRgb } from './palettes';
import { flowAngle } from './noise';
import type { ParticleState } from './state';
import type { Scene } from './three-scene';

const STIFFNESS = 0.06;
const DAMPING = 0.84;
const CONNECTION_PARTICLE_CAP = 1500;

export function createP5Scene(host: HTMLElement, initial: ParticleState): Scene {
  let currentState: ParticleState = {
    ...initial,
    cursor: { ...initial.cursor },
  };

  let positions = new Float32Array(0);
  let velocities = new Float32Array(0);
  let targets = new Float32Array(0);
  let colors: [number, number, number][] = [];
  let lineColor: [number, number, number] = [200, 220, 255];
  let frame = 0;

  const sketch = (p: p5) => {
    let mouseXLocal = -9999;
    let mouseYLocal = -9999;

    p.setup = () => {
      const c = p.createCanvas(host.clientWidth, host.clientHeight);
      c.parent(host);
      p.noStroke();
      rebuild();
      host.addEventListener('pointermove', (e) => {
        const rect = host.getBoundingClientRect();
        mouseXLocal = e.clientX - rect.left - host.clientWidth / 2;
        mouseYLocal = e.clientY - rect.top - host.clientHeight / 2;
      });
      host.addEventListener('pointerleave', () => {
        mouseXLocal = -9999;
        mouseYLocal = -9999;
      });
    };

    p.draw = () => {
      frame++;
      const s = currentState;
      const w = p.width;
      const h = p.height;

      // Trail / clear.
      if (s.trail > 0) {
        p.noStroke();
        p.fill(5, 6, 10, (1 - s.trail) * 255);
        p.rect(0, 0, w, h);
      } else {
        p.background(5, 6, 10);
      }

      p.push();
      p.translate(w / 2, h / 2);
      if (s.rotation !== 0) p.rotate(frame * s.rotation);

      // Cycle palette refresh.
      if (s.palette === 'cycle') {
        recolor(s);
      }

      const cursorX = mouseXLocal;
      const cursorY = mouseYLocal;
      const active = cursorX > -9000;
      const rotSin = s.rotation !== 0 ? Math.sin(-frame * s.rotation) : 0;
      const rotCos = s.rotation !== 0 ? Math.cos(-frame * s.rotation) : 1;

      const repelR = s.cursor.radius;
      const repelR2 = repelR * repelR;
      const useFlow = s.flowField;
      const noiseScale = s.noiseScale;
      const noiseSpeed = s.noiseSpeed;
      const noiseStr = s.noiseStrength * 0.1;

      p.noStroke();
      for (let i = 0; i < s.count; i++) {
        const ix = i * 2;
        let px = positions[ix];
        let py = positions[ix + 1];
        let vx = velocities[ix];
        let vy = velocities[ix + 1];
        const tx = targets[ix];
        const ty = targets[ix + 1];

        // Spring toward target with damping
        vx = vx * DAMPING + (tx - px) * STIFFNESS;
        vy = vy * DAMPING + (ty - py) * STIFFNESS;

        if (active) {
          const lx = cursorX * rotCos - cursorY * rotSin;
          const ly = cursorX * rotSin + cursorY * rotCos;
          const dx = px - lx;
          const dy = py - ly;
          const d2 = dx * dx + dy * dy;
          if (d2 < repelR2 && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const f = (1 - d / repelR) * s.cursor.repel;
            vx += (dx / d) * f;
            vy += (dy / d) * f;
          }
        }

        // Perlin flow field perturbation.
        if (useFlow) {
          const angle = flowAngle(px, py, frame, noiseScale, noiseSpeed);
          vx += Math.cos(angle) * noiseStr;
          vy += Math.sin(angle) * noiseStr;
        }

        px += vx;
        py += vy;

        positions[ix] = px;
        positions[ix + 1] = py;
        velocities[ix] = vx;
        velocities[ix + 1] = vy;

        const col = colors[i];
        p.fill(col[0], col[1], col[2], 200);

        drawMirrored(p, px, py, s.size, s.mirror);
      }

      // Particle connections / network graph.
      if (s.connections) {
        const cap = Math.min(s.count, CONNECTION_PARTICLE_CAP);
        const connR = s.connectionRadius;
        const connR2 = connR * connR;
        p.strokeWeight(0.8);
        for (let i = 0; i < cap; i++) {
          for (let j = i + 1; j < cap; j++) {
            const dx = positions[i * 2] - positions[j * 2];
            const dy = positions[i * 2 + 1] - positions[j * 2 + 1];
            const d2 = dx * dx + dy * dy;
            if (d2 < connR2) {
              const alpha = (1 - Math.sqrt(d2) / connR) * s.connectionOpacity * 200;
              p.stroke(lineColor[0], lineColor[1], lineColor[2], alpha);
              p.line(positions[i * 2], positions[i * 2 + 1], positions[j * 2], positions[j * 2 + 1]);
            }
          }
        }
        p.noStroke();
      }

      p.pop();
    };

    p.windowResized = () => {
      p.resizeCanvas(host.clientWidth, host.clientHeight);
      retarget();
    };
  };

  let instance = new p5(sketch, host);

  function shapeText(s: ParticleState): string {
    return s.shape === 'svg' ? s.svgData : s.text;
  }

  function rebuild() {
    const s = currentState;
    const extent = Math.min(host.clientWidth, host.clientHeight);
    const nextTargets = generate2D(s.shape, s.count, s.spread, s.seed, extent, shapeText(s));
    targets = new Float32Array(nextTargets.length);
    targets.set(nextTargets);
    positions = new Float32Array(targets.length);
    positions.set(targets);
    velocities = new Float32Array(targets.length);
    colors = new Array(s.count);
    recolor(s);
  }

  function retarget() {
    const s = currentState;
    const extent = Math.min(host.clientWidth, host.clientHeight);
    const next = generate2D(s.shape, s.count, s.spread, s.seed, extent, shapeText(s));
    if (next.length !== targets.length) {
      rebuild();
      return;
    }
    targets.set(next);
  }

  function recolor(s: ParticleState) {
    const A = hexToRgb(s.colorA);
    const B = hexToRgb(s.colorB);
    for (let i = 0; i < s.count; i++) {
      const t =
        s.gradientMode === 'position'
          ? i / Math.max(s.count - 1, 1)
          : s.gradientMode === 'velocity'
          ? Math.min(
              1,
              Math.hypot(velocities[i * 2] || 0, velocities[i * 2 + 1] || 0) / 4
            )
          : 0;
      colors[i] = samplePalette(s.palette, t, A, B, frame);
    }
  }

  return {
    resize(w, h) {
      instance.resizeCanvas(w, h);
      retarget();
    },
    update(state, key) {
      currentState = { ...state, cursor: { ...state.cursor } };
      if (key === 'resetView') return;
      if (key === 'count' || key === 'seed') rebuild();
      else if (key === 'shape' || key === 'spread' || key === 'text' || key === 'svgData') retarget();
      else if (
        key === 'palette' ||
        key === 'gradientMode' ||
        key === 'colorA' ||
        key === 'colorB'
      )
        recolor(currentState);
    },
    dispose() {
      instance.remove();
    },
  };
}

function drawMirrored(
  p: p5,
  x: number,
  y: number,
  size: number,
  mirror: 0 | 2 | 4
) {
  p.ellipse(x, y, size, size);
  if (mirror === 2 || mirror === 4) {
    p.ellipse(-x, -y, size, size);
  }
  if (mirror === 4) {
    p.ellipse(-x, y, size, size);
    p.ellipse(x, -y, size, size);
  }
}
