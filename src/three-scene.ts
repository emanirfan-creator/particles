import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { generate3D } from './shapes';
import { samplePalette, hexToRgb } from './palettes';
import type { ParticleState } from './state';

export interface Scene {
  resize(w: number, h: number): void;
  update(state: ParticleState, key: keyof ParticleState | 'resetView'): void;
  dispose(): void;
}

const VERT = /* glsl */ `
  attribute vec3 color;
  attribute vec3 target;
  uniform float uSize;
  uniform float uPixelRatio;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (300.0 / -mv.z);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// Spring-damper constants (per-frame). Tuned for smooth deceleration without overshoot.
const STIFFNESS = 0.05;
const DAMPING = 0.86;

export function createThreeScene(
  host: HTMLElement,
  initial: ParticleState
): Scene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.setClearColor(0x05060a, 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    55,
    host.clientWidth / host.clientHeight,
    0.1,
    2000
  );
  const initialCamPos = new THREE.Vector3(0, 0, 240);
  camera.position.copy(initialCamPos);

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.rotateSpeed = 0.6;

  const group = new THREE.Group();
  scene.add(group);

  const uniforms = {
    uSize: { value: initial.size },
    uPixelRatio: { value: renderer.getPixelRatio() },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms,
  });

  let geometry = new THREE.BufferGeometry();
  let positions = new Float32Array(0);
  let velocities = new Float32Array(0);
  let targets = new Float32Array(0);
  let colors = new Float32Array(0);
  let points: THREE.Points | null = null;
  let currentState: ParticleState = { ...initial, cursor: { ...initial.cursor } };

  // Cursor plane intersection in world space.
  const mouseNDC = new THREE.Vector2(-10, -10);
  const raycaster = new THREE.Raycaster();
  const cursorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const cursorWorld = new THREE.Vector3(9999, 9999, 0);
  let cursorActive = false;

  renderer.domElement.addEventListener('pointermove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    cursorActive = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    cursorActive = false;
    cursorWorld.set(9999, 9999, 0);
  });

  rebuild(initial);
  recolor(initial);

  let rafId = 0;
  function loop() {
    rafId = requestAnimationFrame(loop);

    if (cursorActive) {
      raycaster.setFromCamera(mouseNDC, camera);
      raycaster.ray.intersectPlane(cursorPlane, cursorWorld);
    }

    // Spring-damper integration: each particle has velocity, accelerated by
    // (target - position) * stiffness, then damped. Cursor repulsion adds an
    // impulse to velocity instead of teleporting position so it feels springy.
    const repelR = currentState.cursor.radius;
    const repelR2 = repelR * repelR;
    const repelForce = currentState.cursor.repel * 0.6;

    for (let i = 0; i < currentState.count; i++) {
      const ix = i * 3;
      let px = positions[ix];
      let py = positions[ix + 1];
      let pz = positions[ix + 2];
      let vx = velocities[ix];
      let vy = velocities[ix + 1];
      let vz = velocities[ix + 2];
      const tx = targets[ix];
      const ty = targets[ix + 1];
      const tz = targets[ix + 2];

      // Spring force toward target
      vx = vx * DAMPING + (tx - px) * STIFFNESS;
      vy = vy * DAMPING + (ty - py) * STIFFNESS;
      vz = vz * DAMPING + (tz - pz) * STIFFNESS;

      // Cursor repel — impulse on XY plane only.
      if (cursorActive) {
        const dx = px - cursorWorld.x;
        const dy = py - cursorWorld.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < repelR2 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const f = (1 - d / repelR) * repelForce;
          vx += (dx / d) * f;
          vy += (dy / d) * f;
        }
      }

      px += vx;
      py += vy;
      pz += vz;

      positions[ix] = px;
      positions[ix + 1] = py;
      positions[ix + 2] = pz;
      velocities[ix] = vx;
      velocities[ix + 1] = vy;
      velocities[ix + 2] = vz;
    }

    // Cycle palette needs per-frame color refresh.
    if (currentState.palette === 'cycle') {
      recolor(currentState);
    }

    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Auto-spin from state.rotation (works in both modes via group.rotation.y).
    if (currentState.rotation !== 0) {
      group.rotation.y += currentState.rotation;
    }

    orbit.update();
    renderer.render(scene, camera);
  }
  loop();

  function rebuild(state: ParticleState) {
    currentState = { ...state, cursor: { ...state.cursor } };
    const nextTargets = generate3D(state.shape, state.count, state.spread, state.seed, state.text);
    targets = new Float32Array(nextTargets.length);
    targets.set(nextTargets);
    positions = new Float32Array(targets.length);
    positions.set(targets); // start at target so first frame isn't chaos
    velocities = new Float32Array(targets.length); // zero
    colors = new Float32Array(state.count * 3);

    geometry.dispose();
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('target', new THREE.BufferAttribute(targets, 3));
    if (points) {
      group.remove(points);
      points.geometry.dispose();
    }
    points = new THREE.Points(geometry, material);
    group.add(points);
    recolor(state);
  }


  function recolor(state: ParticleState) {
    const A = hexToRgb(state.colorA);
    const B = hexToRgb(state.colorB);
    const frame = performance.now() * 0.06;
    for (let i = 0; i < state.count; i++) {
      const t =
        state.gradientMode === 'position'
          ? i / Math.max(state.count - 1, 1)
          : state.gradientMode === 'velocity'
          ? Math.min(
              1,
              Math.hypot(
                velocities[i * 3] || 0,
                velocities[i * 3 + 1] || 0,
                velocities[i * 3 + 2] || 0
              ) / 4
            )
          : 0;
      const c = samplePalette(state.palette, t, A, B, frame);
      colors[i * 3] = c[0] / 255;
      colors[i * 3 + 1] = c[1] / 255;
      colors[i * 3 + 2] = c[2] / 255;
    }
    (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  function retargetSafe(state: ParticleState) {
    currentState = { ...state, cursor: { ...state.cursor } };
    const next = generate3D(state.shape, state.count, state.spread, state.seed, state.text);
    if (next.length !== targets.length) {
      rebuild(state);
      return;
    }
    targets.set(next);
    (geometry.attributes.target as THREE.BufferAttribute).needsUpdate = true;
  }

  return {
    resize(w, h) {
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(state, key) {
      currentState = { ...state, cursor: { ...state.cursor } };
      if (key === 'resetView') {
        camera.position.copy(initialCamPos);
        orbit.target.set(0, 0, 0);
        group.rotation.set(0, 0, 0);
        orbit.update();
        return;
      }
      if (key === 'count' || key === 'seed') {
        rebuild(state);
      } else if (key === 'shape' || key === 'spread' || key === 'text') {
        retargetSafe(state);
      } else if (
        key === 'palette' ||
        key === 'gradientMode' ||
        key === 'colorA' ||
        key === 'colorB'
      ) {
        recolor(state);
      } else if (key === 'size') {
        uniforms.uSize.value = state.size;
      }
      // trail / mirror don't apply to 3D.
    },
    dispose() {
      cancelAnimationFrame(rafId);
      orbit.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    },
  };
}
