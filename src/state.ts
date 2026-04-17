export type Mode = '2d' | '3d';

export type Shape3D =
  | 'sphere'
  | 'cube'
  | 'torus'
  | 'helix'
  | 'galaxy'
  | 'aurora'
  | 'wave'
  | 'grid'
  | 'cloud'
  | 'text'
  | 'svg';

export type Shape2D =
  | 'circle'
  | 'grid'
  | 'heart'
  | 'wave'
  | 'cloud'
  | 'kaleidoscope'
  | 'text'
  | 'svg';

export type ShapeId = Shape3D | Shape2D;

export type PaletteId =
  | 'plasma'
  | 'sunset'
  | 'ocean'
  | 'mono'
  | 'cycle'
  | 'cosmic'
  | 'aurora'
  | 'ember'
  | 'ice'
  | 'custom';

export type GradientMode = 'position' | 'velocity' | 'solid';

export type ParticleState = {
  mode: Mode;
  count: number;
  size: number;
  spread: number;
  shape: ShapeId;
  text: string;
  svgData: string;
  palette: PaletteId;
  gradientMode: GradientMode;
  colorA: string;
  colorB: string;
  trail: number;
  rotation: number;
  mirror: 0 | 2 | 4;
  cursor: { repel: number; radius: number };
  seed: number;
  // Flow field (Perlin noise)
  flowField: boolean;
  noiseScale: number;
  noiseSpeed: number;
  noiseStrength: number;
  // Galaxy shape parameters
  galaxyArms: number;
  galaxySpiral: number;
  // Particle connections / network graph
  connections: boolean;
  connectionRadius: number;
  connectionOpacity: number;
};

export const DEFAULT_STATE: ParticleState = {
  mode: '3d',
  count: 10000,
  size: 3,
  spread: 1,
  shape: 'sphere',
  text: 'HELLO',
  svgData: '',
  palette: 'plasma',
  gradientMode: 'position',
  colorA: '#7c3aed',
  colorB: '#38bdf8',
  trail: 0,
  rotation: 0,
  mirror: 0,
  cursor: { repel: 2, radius: 80 },
  seed: 1,
  flowField: false,
  noiseScale: 0.004,
  noiseSpeed: 0.005,
  noiseStrength: 1.5,
  galaxyArms: 4,
  galaxySpiral: 6,
  connections: false,
  connectionRadius: 80,
  connectionOpacity: 0.3,
};

const LISTENERS = new Set<(s: ParticleState, key: keyof ParticleState) => void>();

export function onStateChange(
  fn: (s: ParticleState, key: keyof ParticleState) => void
) {
  LISTENERS.add(fn);
  return () => LISTENERS.delete(fn);
}

export function notifyChange(state: ParticleState, key: keyof ParticleState) {
  LISTENERS.forEach((fn) => fn(state, key));
}

/** Mulberry32 — small seeded PRNG for reproducible shape generation. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
