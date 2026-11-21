// Shared by the golden test and `npm run golden`: a fixed set of seeds whose
// output must never change unless GENERATOR_VERSION is bumped.
import { createHash } from 'node:crypto';

export const GOLDEN_CASES = [
  { preset: 'forest', seed: 'golden-a' },
  { preset: 'battle', seed: 'golden-b' },
  { preset: 'haunted', seed: 'golden-c' },
  { style: 'chiptune', seed: 'golden-d', mode: 'oneshot', length: 20 },
  { style: 'synthwave', seed: 'golden-e', mode: 'evolve', cycle: 3, timeSig: '7/8' },
  { style: 'folk', seed: 'golden-f', timeSig: '6/8', length: 120, key: 'D', scale: 'dorian' },
];

export function caseParams(c, { STYLES, DEFAULT_PARAMS, applyStyle, PRESETS }) {
  let p;
  if (c.preset) {
    const pr = PRESETS.find((x) => x.id === c.preset);
    p = applyStyle(structuredClone(DEFAULT_PARAMS), pr.params.style, { keepMood: false });
    const { layers, ...rest } = pr.params;
    Object.assign(p, rest);
    if (layers) for (const [id, v] of Object.entries(layers)) Object.assign(p.layers[id], v);
  } else p = applyStyle(structuredClone(DEFAULT_PARAMS), c.style, { keepMood: false });
  const { preset, style, cycle, ...over } = c;
  return Object.assign(p, over);
}

export const songHash = (s) => createHash('sha256').update(JSON.stringify({ t: s.tracks, c: s.chords, s: s.sections, k: s.keyPc, sc: s.scaleId })).digest('hex').slice(0, 16);
