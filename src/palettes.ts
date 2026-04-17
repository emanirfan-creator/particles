import type { PaletteId } from './state';

export type RGB = [number, number, number];

/** Sample a palette at t ∈ [0, 1]. For `cycle`, also pass a time frame. */
export function samplePalette(
  id: PaletteId,
  t: number,
  colorA: RGB,
  colorB: RGB,
  frame = 0
): RGB {
  switch (id) {
    case 'plasma':
      return lerpStops(t, PLASMA);
    case 'sunset':
      return lerpStops(t, SUNSET);
    case 'ocean':
      return lerpStops(t, OCEAN);
    case 'mono':
      return lerpStops(t, MONO);
    case 'cycle':
      return [
        Math.sin(frame * 0.02) * 60 + 180,
        Math.sin(frame * 0.015) * 30 + 140,
        Math.sin(frame * 0.01) * 80 + 180,
      ];
    case 'custom':
    default:
      return [
        colorA[0] + (colorB[0] - colorA[0]) * t,
        colorA[1] + (colorB[1] - colorA[1]) * t,
        colorA[2] + (colorB[2] - colorA[2]) * t,
      ];
  }
}

const PLASMA: RGB[] = [
  [13, 8, 135],
  [126, 3, 168],
  [204, 71, 120],
  [248, 149, 64],
  [240, 249, 33],
];

const SUNSET: RGB[] = [
  [30, 20, 60],
  [124, 58, 237],
  [239, 68, 68],
  [251, 146, 60],
  [254, 240, 138],
];

const OCEAN: RGB[] = [
  [3, 7, 30],
  [17, 94, 140],
  [58, 180, 204],
  [168, 230, 224],
  [240, 255, 250],
];

const MONO: RGB[] = [
  [20, 20, 24],
  [90, 90, 100],
  [200, 200, 210],
];

function lerpStops(t: number, stops: RGB[]): RGB {
  const n = stops.length - 1;
  const x = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[Math.min(i + 1, n)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = parseInt(
    h.length === 3
      ? h.split('').map((c) => c + c).join('')
      : h,
    16
  );
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
