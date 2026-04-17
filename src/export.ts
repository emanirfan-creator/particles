import { DEFAULT_STATE } from './state';
import type { ParticleState } from './state';

export function buildPrompt(state: ParticleState): string {
  const desc = describe(state);
  return [
    `# Recreate this particle animation`,
    ``,
    desc,
    ``,
    `## Specification (JSON)`,
    '```json',
    JSON.stringify(state, null, 2),
    '```',
    ``,
    `## Instructions for the LLM`,
    ``,
    `Using **${state.mode === '3d' ? 'three.js' : 'p5.js'}**, create a single self-contained HTML file that reproduces the animation above.`,
    ``,
    `Requirements:`,
    `- Render **${state.count}** particles of base size ~${state.size}px.`,
    `- Arrange them in the shape **"${state.shape}"**${state.shape === 'text' ? ` rendering the text \`${state.text}\`` : ''} scaled by spread = ${state.spread}.`,
    `- Color them using the palette **"${state.palette}"** with gradient mode **"${state.gradientMode}"** (colorA=${state.colorA}, colorB=${state.colorB}). For the "cycle" palette, compute per-frame RGB via \`sin(t*0.02)*60+180, sin(t*0.015)*30+140, sin(t*0.01)*80+180\`.`,
    state.mode === '2d'
      ? `- Apply motion trails by overdrawing a semi-transparent black rect each frame (alpha = ${(1 - state.trail).toFixed(2)}) instead of fully clearing.`
      : `- Use additive blending and a soft circular sprite for each point.`,
    state.rotation !== 0
      ? `- Rotate the scene globally by ${state.rotation} radians per frame.`
      : ``,
    state.mirror > 0
      ? `- Mirror each particle with ${state.mirror}-fold symmetry about the origin.`
      : ``,
    `- Implement cursor-based repulsion: radius ${state.cursor.radius}px, force ${state.cursor.repel}. Particles push away when the cursor is within the radius and spring back when it leaves.`,
    `- Seed any randomness with ${state.seed} so the result is reproducible.`,
    ``,
    `Output one HTML file with the library loaded from a CDN. No build step.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function describe(s: ParticleState): string {
  const trail = s.trail > 0.5 ? 'heavy trails' : s.trail > 0 ? 'subtle trails' : 'no trails';
  const rot =
    s.rotation === 0 ? 'static' : s.rotation > 0 ? 'slowly spinning clockwise' : 'slowly spinning counter-clockwise';
  const sym = s.mirror === 0 ? '' : `, ${s.mirror}-fold mirror symmetry`;
  return `A ${s.mode.toUpperCase()} field of ${s.count} particles forming a ${s.shape}, colored with the ${s.palette} palette (${s.gradientMode}), ${trail}, ${rot}${sym}. The cursor repels nearby particles within ${s.cursor.radius}px with force ${s.cursor.repel}.`;
}

/** Parse + coerce JSON back into a ParticleState, filling defaults for missing / invalid fields. */
export function importJSON(raw: string): ParticleState {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!obj || typeof obj !== 'object') throw new Error('Expected a JSON object');
  const p = obj as Partial<ParticleState> & Record<string, unknown>;
  const out: ParticleState = {
    ...DEFAULT_STATE,
    ...p,
    text: typeof p.text === 'string' ? p.text : DEFAULT_STATE.text,
    cursor: { ...DEFAULT_STATE.cursor, ...(p.cursor as object | undefined) },
  } as ParticleState;
  // Basic range clamping.
  out.count = clamp(Math.round(out.count), 50, 200_000);
  out.size = clamp(out.size, 0.2, 30);
  out.spread = clamp(out.spread, 0.05, 4);
  out.trail = clamp(out.trail, 0, 1);
  out.rotation = clamp(out.rotation, -0.05, 0.05);
  if (out.mirror !== 0 && out.mirror !== 2 && out.mirror !== 4) out.mirror = 0;
  out.cursor.radius = clamp(out.cursor.radius, 0, 500);
  out.cursor.repel = clamp(out.cursor.repel, 0, 10);
  return out;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
