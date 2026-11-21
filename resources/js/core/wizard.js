// "New track" wizard: a few beginner-friendly answers mapped onto the full
// parameter set. Pure data + functions so the mapping is testable; everything
// it sets can be refined afterwards in the Parameters panel.
import { STYLES, DEFAULT_PARAMS, applyStyle } from './styles.js';
import { PRESETS } from './presets.js';
import { presetParams } from './params.js';

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, Math.round(v)));

const LOOP_LENGTHS = [
  { id: 'short', label: 'Short', sub: '≈ 30 s loop', length: 30 },
  { id: 'medium', label: 'Medium', sub: '≈ 1 min loop', length: 60 },
  { id: 'long', label: 'Long', sub: '≈ 3 min loop', length: 180 },
  { id: 'endless', label: 'Endless', sub: 'Evolving, never repeats the same way', length: 45, mode: 'evolve' },
];
const ONESHOT_LENGTHS = [
  { id: 'sting', label: 'Sting', sub: '≈ 8 s', length: 8 },
  { id: 'short', label: 'Short', sub: '≈ 15 s', length: 15 },
  { id: 'medium', label: 'Medium', sub: '≈ 30 s', length: 30 },
  { id: 'scene', label: 'Cutscene', sub: '≈ 1 min', length: 60 },
];

export const PURPOSES = [
  { id: 'explore', label: 'Exploration', noun: 'Theme', icon: 'mountain', desc: 'Levels, towns, overworld — music heard in the background for minutes.',
    presets: ['forest', 'space', 'ocean', 'village', 'snow', 'desert', 'castle'], styles: ['ambient', 'folk', 'cinematic', 'world', 'cozy'],
    mode: 'loop', lengths: LOOP_LENGTHS, defaultLength: 'medium', set: { variation: 45 } },
  { id: 'combat', label: 'Combat & action', noun: 'Battle', icon: 'sword', desc: 'Fights, chases, boss rooms — high energy that should not tire the player.',
    presets: ['battle', 'cyberpunk', 'arcade', 'chipdungeon', 'nightdrive'], styles: ['action', 'electronic', 'synthwave', 'chiptune', 'cinematic'],
    mode: 'loop', lengths: LOOP_LENGTHS, defaultLength: 'endless', set: { variation: 65 } },
  { id: 'menu', label: 'Menu & UI', noun: 'Menu', icon: 'cup', desc: 'Title screens, menus, shops, puzzles — calm and catchy, loops a lot.',
    presets: ['menu', 'title', 'puzzle', 'campfire'], styles: ['cozy', 'lofi', 'ambient', 'chiptune', 'cinematic'],
    mode: 'loop', lengths: LOOP_LENGTHS, defaultLength: 'medium', set: { variation: 25, repetition: 75 } },
  { id: 'stinger', label: 'Stinger & cutscene', noun: 'Stinger', icon: 'trophy', desc: 'Victory jingles, game over, discoveries, short scenes — plays once and ends.',
    presets: ['victory', 'title', 'battle', 'haunted'], styles: ['cinematic', 'chiptune', 'cozy', 'horror', 'action'],
    mode: 'oneshot', lengths: ONESHOT_LENGTHS, defaultLength: 'short', set: { intro: 0, outro: 1 } },
  { id: 'ambience', label: 'Ambience & tension', noun: 'Ambience', icon: 'ghost', desc: 'Dungeons, stealth, horror, underwater — atmosphere more than melody.',
    presets: ['haunted', 'dungeon', 'underwater', 'stealth', 'space'], styles: ['horror', 'ambient', 'electronic', 'world'],
    mode: 'loop', lengths: LOOP_LENGTHS, defaultLength: 'long', set: { variation: 50, rests: 50 } },
];
export const purposeById = (id) => PURPOSES.find((p) => p.id === id) || PURPOSES[0];

export const TEMPOS = [
  { id: 'slower', label: 'Slower', factor: 0.85 },
  { id: 'default', label: 'As designed', factor: 1 },
  { id: 'faster', label: 'Faster', factor: 1.15 },
];

// Parameters before the "feel" step: theme (or genre) + purpose + length.
// The UI uses it to place the mood pad and show tempos.
export function wizardBase(a, { seed = DEFAULT_PARAMS.seed, master = DEFAULT_PARAMS.master } = {}) {
  const purpose = purposeById(a.purpose);
  const pr = a.preset ? PRESETS.find((x) => x.id === a.preset) : null;
  let p;
  if (pr) p = presetParams(pr, { seed, master });
  else {
    const style = STYLES[a.style] ? a.style : purpose.styles[0];
    const base = structuredClone(DEFAULT_PARAMS); base.master = master;
    p = applyStyle(base, style, { keepMood: false });
    p.seed = seed; p.preset = null;
    p.name = `${STYLES[style].name} ${purpose.noun}`;
  }
  Object.assign(p, purpose.set);
  p.mode = purpose.mode;
  const len = purpose.lengths.find((l) => l.id === a.length) || purpose.lengths.find((l) => l.id === purpose.defaultLength);
  p.length = len.length;
  if (len.mode) p.mode = len.mode;
  if (p.mode === 'oneshot') { p.intro = Math.min(p.intro, len.length <= 15 ? 0 : 1); p.form = len.length <= 15 ? 'A' : 'auto'; }
  return p;
}

export function tempoFor(p, tempo) {
  const t = TEMPOS.find((x) => x.id === tempo) || TEMPOS[1];
  const [lo, hi] = STYLES[p.style].bpmRange;
  return t.factor === 1 ? p.bpm : clamp(p.bpm * t.factor, Math.min(lo, p.bpm), Math.max(hi, p.bpm));
}

// Full parameter set from the wizard answers. `energy` / `brightness` are the
// mood-pad position (omit to keep the theme's own mood).
export function wizardToParams(a, opts = {}) {
  const p = wizardBase(a, opts);
  if (Number.isFinite(a.energy) || Number.isFinite(a.brightness)) {
    const e0 = p.energy, b0 = p.brightness;
    const e = Number.isFinite(a.energy) ? clamp(a.energy) : e0;
    const b = Number.isFinite(a.brightness) ? clamp(a.brightness) : b0;
    // One pad, five sliders: darker reads as more tense, more energy as busier.
    p.tension = clamp(p.tension + (b0 - b) * 0.6 + (e - e0) * 0.15);
    p.density = clamp(p.density + (e - e0) * 0.5);
    p.energy = e; p.brightness = b;
  }
  p.bpm = tempoFor(p, a.tempo);
  return p;
}
