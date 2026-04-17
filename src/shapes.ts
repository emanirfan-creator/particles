import { mulberry32 } from './state';
import type { Shape2D, Shape3D, ShapeId } from './state';

/**
 * Generate target positions for `count` particles forming `shape`.
 * Returns a Float32Array of length count*3 (z = 0 for inherently 2D shapes).
 * `scale` is the overall size (maps to state.spread * base).
 */
export function generate3D(
  shape: ShapeId,
  count: number,
  scale: number,
  seed: number,
  text = ''
): Float32Array {
  const out = new Float32Array(count * 3);
  const rand = mulberry32(seed);
  const R = 80 * scale;

  switch (shape) {
    case 'sphere': {
      // Fibonacci lattice on a sphere + seed-driven jitter so Variation is visible.
      const GA = Math.PI * (3 - Math.sqrt(5));
      const jitterAmt = R * 0.04;
      for (let i = 0; i < count; i++) {
        const y = 1 - (i / Math.max(count - 1, 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = GA * i;
        out[i * 3]     = Math.cos(theta) * r * R + (rand() - 0.5) * jitterAmt;
        out[i * 3 + 1] = y * R                   + (rand() - 0.5) * jitterAmt;
        out[i * 3 + 2] = Math.sin(theta) * r * R + (rand() - 0.5) * jitterAmt;
      }
      break;
    }
    case 'cube': {
      for (let i = 0; i < count; i++) {
        const face = Math.floor(rand() * 6);
        const u = (rand() * 2 - 1) * R;
        const v = (rand() * 2 - 1) * R;
        if (face === 0) setXYZ(out, i, R, u, v);
        else if (face === 1) setXYZ(out, i, -R, u, v);
        else if (face === 2) setXYZ(out, i, u, R, v);
        else if (face === 3) setXYZ(out, i, u, -R, v);
        else if (face === 4) setXYZ(out, i, u, v, R);
        else setXYZ(out, i, u, v, -R);
      }
      break;
    }
    case 'torus': {
      const majorR = R;
      const minorR = R * 0.35;
      for (let i = 0; i < count; i++) {
        const u = (i / count) * Math.PI * 2 + rand() * 0.3;
        const v = rand() * Math.PI * 2;
        out[i * 3] = (majorR + minorR * Math.cos(v)) * Math.cos(u);
        out[i * 3 + 1] = minorR * Math.sin(v);
        out[i * 3 + 2] = (majorR + minorR * Math.cos(v)) * Math.sin(u);
      }
      break;
    }
    case 'helix': {
      const turns = 6;
      const jitter = R * 0.05;
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const a = t * Math.PI * 2 * turns;
        out[i * 3]     = Math.cos(a) * R * 0.6 + (rand() - 0.5) * jitter;
        out[i * 3 + 1] = (t - 0.5) * R * 2.2   + (rand() - 0.5) * jitter;
        out[i * 3 + 2] = Math.sin(a) * R * 0.6 + (rand() - 0.5) * jitter;
      }
      break;
    }
    case 'galaxy': {
      const arms = 4;
      for (let i = 0; i < count; i++) {
        const t = Math.pow(rand(), 0.6);
        const arm = Math.floor(rand() * arms);
        const a = (arm / arms) * Math.PI * 2 + t * 6;
        const radius = t * R * 1.2;
        const jitter = (rand() - 0.5) * R * 0.2 * (1 - t);
        out[i * 3] = Math.cos(a) * radius + jitter;
        out[i * 3 + 1] = (rand() - 0.5) * R * 0.1 * (1 - t);
        out[i * 3 + 2] = Math.sin(a) * radius + jitter;
      }
      break;
    }
    case 'wave': {
      const side = Math.ceil(Math.sqrt(count));
      const waveJitter = R * 0.04;
      for (let i = 0; i < count; i++) {
        const ix = i % side;
        const iz = Math.floor(i / side);
        const x = ((ix / (side - 1)) - 0.5) * R * 2;
        const z = ((iz / (side - 1)) - 0.5) * R * 2;
        const y = Math.sin(x * 0.05) * Math.cos(z * 0.05) * R * 0.4;
        out[i * 3]     = x + (rand() - 0.5) * waveJitter;
        out[i * 3 + 1] = y + (rand() - 0.5) * waveJitter;
        out[i * 3 + 2] = z + (rand() - 0.5) * waveJitter;
      }
      break;
    }
    case 'grid': {
      const side = Math.ceil(Math.cbrt(count));
      const gridJitter = R * 0.06;
      for (let i = 0; i < count; i++) {
        const ix = i % side;
        const iy = Math.floor(i / side) % side;
        const iz = Math.floor(i / (side * side));
        out[i * 3]     = ((ix / (side - 1 || 1)) - 0.5) * R * 2 + (rand() - 0.5) * gridJitter;
        out[i * 3 + 1] = ((iy / (side - 1 || 1)) - 0.5) * R * 2 + (rand() - 0.5) * gridJitter;
        out[i * 3 + 2] = ((iz / (side - 1 || 1)) - 0.5) * R * 2 + (rand() - 0.5) * gridJitter;
      }
      break;
    }
    // 2D-native shapes — render flat in XY plane (z=0) so they still look correct in 3D.
    case 'circle': {
      // Sphere surface projection: density concentrates near edge for a 3D sphere illusion.
      for (let i = 0; i < count; i++) {
        const z = rand() * 2 - 1;
        const r = Math.sqrt(1 - z * z);
        const a = rand() * Math.PI * 2;
        out[i * 3]     = Math.cos(a) * r * R;
        out[i * 3 + 1] = z * R;
        out[i * 3 + 2] = 0;
      }
      break;
    }
    case 'heart': {
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y =
          13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t);
        const jitter = (rand() - 0.5) * 0.5;
        out[i * 3] = (x + jitter) * (R / 17);
        out[i * 3 + 1] = (y + jitter) * (R / 17);
        out[i * 3 + 2] = 0;
      }
      break;
    }
    case 'kaleidoscope': {
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const a = t * Math.PI * 2 * 12;
        const radius = Math.sqrt(t) * R;
        out[i * 3] = Math.cos(a) * radius;
        out[i * 3 + 1] = Math.sin(a) * radius;
        out[i * 3 + 2] = 0;
      }
      break;
    }
    case 'text': {
      const pixels = sampleTextPixels(text || 'HELLO', count, seed, R * 3);
      const jitterDepth = R * 0.04;
      for (let i = 0; i < count; i++) {
        out[i * 3] = pixels[i * 2];
        out[i * 3 + 1] = pixels[i * 2 + 1];
        out[i * 3 + 2] = (rand() - 0.5) * jitterDepth;
      }
      break;
    }
    case 'cloud':
    default: {
      for (let i = 0; i < count; i++) {
        out[i * 3] = gauss(rand) * R * 0.6;
        out[i * 3 + 1] = gauss(rand) * R * 0.6;
        out[i * 3 + 2] = gauss(rand) * R * 0.6;
      }
      break;
    }
  }
  return out;
}

/** 2D target positions. Origin = (0,0), scaled to the smaller of w/h. */
export function generate2D(
  shape: ShapeId,
  count: number,
  scale: number,
  seed: number,
  extent: number,
  text = ''
): Float32Array {
  const out = new Float32Array(count * 2);
  const rand = mulberry32(seed);
  const R = extent * 0.4 * scale;

  switch (shape) {
    case 'circle': {
      // Sphere surface projection: density concentrates near edge for a 3D sphere illusion.
      for (let i = 0; i < count; i++) {
        const z = rand() * 2 - 1;
        const r = Math.sqrt(1 - z * z);
        const a = rand() * Math.PI * 2;
        out[i * 2]     = Math.cos(a) * r * R;
        out[i * 2 + 1] = z * R;
      }
      break;
    }
    case 'grid': {
      const side = Math.ceil(Math.sqrt(count));
      const gridJitter = R * 0.06;
      for (let i = 0; i < count; i++) {
        const ix = i % side;
        const iy = Math.floor(i / side);
        out[i * 2]     = ((ix / (side - 1 || 1)) - 0.5) * R * 2 + (rand() - 0.5) * gridJitter;
        out[i * 2 + 1] = ((iy / (side - 1 || 1)) - 0.5) * R * 2 + (rand() - 0.5) * gridJitter;
      }
      break;
    }
    case 'heart': {
      const heartJitter = R * 0.08;
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y =
          13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t);
        out[i * 2]     = (x + (rand() - 0.5) * heartJitter) * (R / 17);
        out[i * 2 + 1] = -(y + (rand() - 0.5) * heartJitter) * (R / 17);
      }
      break;
    }
    case 'wave': {
      for (let i = 0; i < count; i++) {
        const x = ((i / count) - 0.5) * R * 2.4;
        const y = Math.sin(x * 0.04) * R * 0.4 + (rand() - 0.5) * R * 0.05;
        out[i * 2] = x;
        out[i * 2 + 1] = y;
      }
      break;
    }
    case 'kaleidoscope': {
      const angleOffset = rand() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const a = t * Math.PI * 2 * 12 + angleOffset;
        const radius = Math.sqrt(t) * R;
        out[i * 2]     = Math.cos(a) * radius;
        out[i * 2 + 1] = Math.sin(a) * radius;
      }
      break;
    }
    case 'text': {
      // Aim for text spanning roughly 80% of the smaller dimension.
      const targetWidth = Math.min(extent * 0.85, R * 3);
      const pixels = sampleTextPixels(text || 'HELLO', count, seed, targetWidth);
      // sampleTextPixels flips Y for world (+y up). In p5 +y is down, so flip back.
      for (let i = 0; i < count; i++) {
        out[i * 2] = pixels[i * 2];
        out[i * 2 + 1] = -pixels[i * 2 + 1];
      }
      break;
    }
    // 3D shapes selected while in 2D mode — flatten XZ → XY so they still look reasonable.
    case 'sphere':
    case 'torus':
    case 'helix':
    case 'galaxy':
    case 'cube': {
      const flat3D = generate3D(shape as Shape3D, count, scale, seed);
      for (let i = 0; i < count; i++) {
        out[i * 2] = flat3D[i * 3];
        out[i * 2 + 1] = -flat3D[i * 3 + 1];
      }
      break;
    }
    case 'cloud':
    default: {
      for (let i = 0; i < count; i++) {
        out[i * 2] = gauss(rand) * R * 0.6;
        out[i * 2 + 1] = gauss(rand) * R * 0.6;
      }
      break;
    }
  }
  return out;
}

/**
 * Render `text` to an offscreen canvas and sample `targetCount` particle positions
 * proportional to ink coverage. Returns Float32Array of length count*2 (x,y) centered
 * at origin, normalized so the rendered text fits within `targetWidth` units wide.
 */
export function sampleTextPixels(
  text: string,
  targetCount: number,
  seed: number,
  targetWidth: number
): Float32Array {
  const out = new Float32Array(targetCount * 2);
  const safe = (text || ' ').trim() || ' ';
  // Reference render at a fixed font size for consistent sampling density.
  const fontPx = 220;
  const font = `bold ${fontPx}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return out;
  measureCtx.font = font;
  const metrics = measureCtx.measureText(safe);
  const textW = Math.max(1, Math.ceil(metrics.width));
  const ascent = (metrics.actualBoundingBoxAscent || fontPx * 0.8) | 0;
  const descent = (metrics.actualBoundingBoxDescent || fontPx * 0.2) | 0;
  const textH = Math.max(1, ascent + descent);

  const padding = 24;
  const W = textW + padding * 2;
  const H = textH + padding * 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return out;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(safe, padding, padding + ascent);

  const data = ctx.getImageData(0, 0, W, H).data;
  // Collect filled pixel coordinates (downsample stride for speed on big text).
  const stride = Math.max(1, Math.floor(Math.sqrt((W * H) / Math.max(targetCount * 4, 1))));
  const filled: number[] = [];
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      const idx = (y * W + x) * 4 + 3; // alpha
      if (data[idx] > 128) {
        filled.push(x, y);
      }
    }
  }
  if (filled.length === 0) return out;

  const cx = W / 2;
  const cy = H / 2;
  const scale = targetWidth / W;
  const rand = mulberry32(seed);
  const pairCount = filled.length / 2;
  for (let i = 0; i < targetCount; i++) {
    const pickIdx = Math.floor(rand() * pairCount) * 2;
    const px = filled[pickIdx];
    const py = filled[pickIdx + 1];
    // small sub-pixel jitter so duplicates aren't perfectly stacked
    const jx = (rand() - 0.5) * stride;
    const jy = (rand() - 0.5) * stride;
    out[i * 2] = (px + jx - cx) * scale;
    // Flip Y so text reads upright in world coords (y-up).
    out[i * 2 + 1] = -(py + jy - cy) * scale;
  }
  return out;
}

export const SHAPES_3D: Shape3D[] = [
  'sphere',
  'cube',
  'torus',
  'helix',
  'galaxy',
  'wave',
  'grid',
  'cloud',
  'text',
];

export const SHAPES_2D: Shape2D[] = [
  'circle',
  'grid',
  'heart',
  'wave',
  'cloud',
  'kaleidoscope',
  'text',
];

export function shapesForMode(mode: '2d' | '3d'): ShapeId[] {
  return mode === '3d' ? (SHAPES_3D as ShapeId[]) : (SHAPES_2D as ShapeId[]);
}

export function is2DShape(shape: string): shape is Shape2D {
  return (SHAPES_2D as string[]).includes(shape);
}

export function is3DShape(shape: string): shape is Shape3D {
  return (SHAPES_3D as string[]).includes(shape);
}

function setXYZ(arr: Float32Array, i: number, x: number, y: number, z: number) {
  arr[i * 3] = x;
  arr[i * 3 + 1] = y;
  arr[i * 3 + 2] = z;
}

function gauss(rand: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
