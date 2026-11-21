// Parameter helpers shared by the UI and the tests.
import { STYLES, DEFAULT_PARAMS, applyStyle, LAYER_IDS } from './styles.js';

// Full parameter set for a theme preset.
export function presetParams(pr, { seed = DEFAULT_PARAMS.seed, master = DEFAULT_PARAMS.master } = {}) {
  const base = structuredClone(DEFAULT_PARAMS);
  base.master = master;
  const p = applyStyle(base, pr.params.style, { keepMood: false });
  const { layers, ...rest } = pr.params;
  Object.assign(p, rest);
  if (layers) for (const [id, v] of Object.entries(layers)) Object.assign(p.layers[id], v);
  p.name = pr.name; p.preset = pr.id; p.seed = seed;
  return p;
}

// Fill in anything missing from saved/imported params. Returns null if the
// data can't be a Motivo parameter set.
export function normalizeParams(p) {
  if (!p || typeof p !== 'object' || !STYLES[p.style]) return null;
  const base = applyStyle(structuredClone(DEFAULT_PARAMS), p.style, { keepMood: false });
  const out = { ...base, ...p, layers: base.layers };
  for (const id of LAYER_IDS) Object.assign(out.layers[id], (p.layers && typeof p.layers === 'object' && p.layers[id]) || {});
  for (const [k, v] of Object.entries(DEFAULT_PARAMS)) {
    if (k === 'layers' || k === 'preset') continue;
    if (typeof v === 'number' && !Number.isFinite(+out[k])) out[k] = base[k];
    else if (typeof v === 'number') out[k] = +out[k];
  }
  out.name = String(out.name || 'Untitled Track').slice(0, 60);
  out.seed = String(out.seed || DEFAULT_PARAMS.seed);
  return out;
}

// A library entry as stored on disk; returns a cleaned copy or null.
export function normalizeEntry(e, idHint = Date.now()) {
  if (!e || typeof e !== 'object') return null;
  const params = normalizeParams(e.params);
  if (!params) return null;
  return {
    id: Number.isFinite(e.id) ? e.id : idHint,
    name: String(e.name || params.name).slice(0, 60),
    params,
    sum: String(e.sum || ''),
    at: Number.isFinite(e.at) ? e.at : Date.now(),
    gen: Number.isFinite(e.gen) ? e.gen : 1,
  };
}
