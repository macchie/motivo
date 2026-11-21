// Genre definitions. Each style describes harmony, groove and orchestration
// tendencies; the generator interprets them together with mood parameters.
// Progressions are 0-based scale degrees (0 = I/i).

const L = (inst, vol = 0.8, mute = false, pan = 0) => ({ inst, vol, mute, pan });

export const STYLES = {
  ambient: {
    name: 'Ambient', desc: 'Slow evolving pads, sparse bells and wide space. Exploration & menus.',
    bpm: 72, bpmRange: [50, 95], timeSig: '4/4', scales: ['lydian', 'major', 'majorPent', 'dorian', 'minor'],
    progressions: [[0, 3, 0, 4], [0, 5, 3, 4], [0, 3, 5, 4], [0, 2, 3, 0], [5, 3, 0, 4], [0, 4, 3, 3]],
    hr: 2, chord7: 0.5, sus: 0.35,
    bass: 'drone', chords: 'sustain', drums: 'sparse', arp: { rate: 2, pattern: 'updown', oct: 2 },
    melody: { density: 0.22, res: 4, legato: 1, register: 12 }, swing: 0, swingUnit: 16,
    layers: { pad: L('pad-glass', 0.8), chords: L('epiano', 0.5, true), bass: L('bass-sub', 0.6), lead: L('lead-bell', 0.65),
      arp: L('arp-sparkle', 0.5, false, -0.3), drums: L('minimal', 0.5, true), ambience: L(null, 0.6) },
    mood: { energy: 20, tension: 20, brightness: 65, density: 35, complexity: 40 },
    fx: { reverbSize: 85, reverbMix: 55, delay: 'd8', delayFb: 45, delayMix: 30, warmth: 30, lofi: 0, pump: 0, width: 85 },
  },
  cinematic: {
    name: 'Cinematic Orchestral', desc: 'Strings, brass and big percussion. Castles, quests, title screens.',
    bpm: 92, bpmRange: [65, 135], timeSig: '4/4', scales: ['minor', 'harmonicMinor', 'dorian', 'major', 'lydian'],
    progressions: [[0, 5, 3, 4], [0, 3, 4, 0], [0, 6, 5, 4], [5, 3, 0, 4], [0, 4, 5, 3], [0, 5, 2, 6]],
    hr: 1, chord7: 0.12, sus: 0.15,
    bass: 'ostinato', chords: 'staccato', drums: 'epic', arp: { rate: 1, pattern: 'updown', oct: 1 },
    melody: { density: 0.42, res: 2, legato: 0.92, register: 12 }, swing: 0, swingUnit: 16,
    layers: { pad: L('pad-strings', 0.8), chords: L('pizz', 0.6), bass: L('bass-cello', 0.75), lead: L('lead-brass', 0.75),
      arp: L('harp', 0.5, true, 0.3), drums: L('cinematic', 0.8), ambience: L(null, 0.5) },
    mood: { energy: 60, tension: 55, brightness: 45, density: 55, complexity: 50 },
    fx: { reverbSize: 75, reverbMix: 40, delay: 'off', delayFb: 30, delayMix: 15, warmth: 20, lofi: 0, pump: 0, width: 80 },
  },
  chiptune: {
    name: 'Chiptune', desc: 'Pulse waves, triangle bass and noise drums. Retro platformers & arcades.',
    bpm: 140, bpmRange: [100, 190], timeSig: '4/4', scales: ['major', 'minor', 'dorian', 'mixolydian', 'majorPent'],
    progressions: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 4], [5, 3, 0, 4], [0, 0, 3, 4], [0, 6, 5, 4]],
    hr: 1, chord7: 0, sus: 0,
    bass: 'chip', chords: 'chiparp', drums: 'chip', arp: { rate: 1, pattern: 'up', oct: 1 },
    melody: { density: 0.68, res: 1, legato: 0.8, register: 12 }, swing: 0, swingUnit: 16,
    layers: { pad: L('pad-chip', 0.5, true), chords: L('chip-pulse', 0.55), bass: L('bass-chip', 0.8), lead: L('lead-chip', 0.8),
      arp: L('chip-pulse', 0.45, true, 0.2), drums: L('chip', 0.7), ambience: L(null, 0.4) },
    mood: { energy: 75, tension: 30, brightness: 75, density: 65, complexity: 50 },
    fx: { reverbSize: 20, reverbMix: 12, delay: '8', delayFb: 25, delayMix: 14, warmth: 0, lofi: 0, pump: 0, width: 40 },
  },
  synthwave: {
    name: 'Synthwave', desc: 'Neon 80s pads, gated drums and pulsing bass. Racing, night drives, cyber menus.',
    bpm: 100, bpmRange: [80, 125], timeSig: '4/4', scales: ['minor', 'dorian', 'minor', 'mixolydian'],
    progressions: [[0, 5, 2, 6], [0, 5, 3, 4], [5, 3, 0, 4], [0, 6, 5, 6], [0, 3, 5, 6]],
    hr: 1, chord7: 0.3, sus: 0.1,
    bass: 'pulse8', chords: 'pulse', drums: 'backbeat', arp: { rate: 1, pattern: 'up', oct: 2 },
    melody: { density: 0.45, res: 2, legato: 0.95, register: 12 }, swing: 0, swingUnit: 16,
    layers: { pad: L('pad-warm', 0.75), chords: L('stab', 0.5, true), bass: L('bass-synth', 0.75), lead: L('lead-saw', 0.7),
      arp: L('pluck', 0.55, false, 0.25), drums: L('electro', 0.75), ambience: L(null, 0.5) },
    mood: { energy: 65, tension: 40, brightness: 55, density: 55, complexity: 45 },
    fx: { reverbSize: 70, reverbMix: 35, delay: 'd8', delayFb: 40, delayMix: 24, warmth: 15, lofi: 0, pump: 40, width: 85 },
  },
  lofi: {
    name: 'Lo-fi Chill', desc: 'Jazzy 7th chords, swung dusty beats and vinyl warmth. Cozy hubs & shops.',
    bpm: 80, bpmRange: [65, 95], timeSig: '4/4', scales: ['dorian', 'minor', 'major', 'mixolydian'],
    progressions: [[1, 4, 0, 0], [3, 2, 1, 4], [0, 5, 1, 4], [3, 4, 2, 5], [0, 3, 1, 4]],
    hr: 1, chord7: 0.95, sus: 0.05, add9: 0.35,
    bass: 'syncopated', chords: 'lofi', drums: 'boom', arp: { rate: 2, pattern: 'up', oct: 1 },
    melody: { density: 0.34, res: 2, legato: 0.8, register: 12 }, swing: 32, swingUnit: 16,
    layers: { pad: L('pad-warm', 0.4, true), chords: L('epiano', 0.75), bass: L('bass-upright', 0.75), lead: L('piano', 0.6),
      arp: L('kalimba', 0.4, true), drums: L('lofi', 0.75), ambience: L(null, 0.5) },
    mood: { energy: 40, tension: 25, brightness: 40, density: 45, complexity: 70 },
    fx: { reverbSize: 40, reverbMix: 24, delay: 'off', delayFb: 30, delayMix: 12, warmth: 60, lofi: 55, pump: 20, width: 60 },
  },
  horror: {
    name: 'Dark Ambient', desc: 'Drones, dissonance and music-box dread. Dungeons, haunted places, horror.',
    bpm: 64, bpmRange: [45, 85], timeSig: '4/4', scales: ['phrygian', 'harmonicMinor', 'wholeTone', 'minor'],
    progressions: [[0, 1, 0, 5], [0, 5, 1, 0], [0, 3, 1, 0], [0, 0, 1, 1], [0, 6, 1, 0]],
    hr: 2, chord7: 0.3, sus: 0, cluster: 0.4,
    bass: 'sparse', chords: 'sustain', drums: 'sparse', arp: { rate: 2, pattern: 'random', oct: 2 },
    melody: { density: 0.18, res: 4, legato: 1, register: 12 }, swing: 0, swingUnit: 16,
    layers: { pad: L('pad-dark', 0.8), chords: L('piano', 0.45, true), bass: L('bass-sub', 0.6), lead: L('lead-glock', 0.55),
      arp: L('arp-sparkle', 0.35, true), drums: L('cinematic', 0.55), ambience: L(null, 0.7) },
    mood: { energy: 15, tension: 85, brightness: 20, density: 30, complexity: 50 },
    fx: { reverbSize: 92, reverbMix: 60, delay: '4', delayFb: 50, delayMix: 25, warmth: 40, lofi: 15, pump: 0, width: 90 },
  },
  action: {
    name: 'Action / Battle', desc: 'Driving 16th bass, aggressive drums and heroic brass. Combat & bosses.',
    bpm: 152, bpmRange: [125, 185], timeSig: '4/4', scales: ['harmonicMinor', 'minor', 'phrygian', 'dorian'],
    progressions: [[0, 5, 6, 0], [0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 4], [0, 1, 0, 6]],
    hr: 1, chord7: 0.1, sus: 0.1,
    bass: 'pulse16', chords: 'staccato', drums: 'drive', arp: { rate: 1, pattern: 'updown', oct: 1 },
    melody: { density: 0.55, res: 1, legato: 0.85, register: 12 }, swing: 0, swingUnit: 16,
    layers: { pad: L('pad-strings', 0.65), chords: L('stab', 0.55), bass: L('bass-saw', 0.75), lead: L('lead-brass', 0.8),
      arp: L('pluck', 0.45, false, -0.25), drums: L('acoustic', 0.85), ambience: L(null, 0.4) },
    mood: { energy: 90, tension: 70, brightness: 50, density: 70, complexity: 60 },
    fx: { reverbSize: 45, reverbMix: 24, delay: 'off', delayFb: 30, delayMix: 12, warmth: 10, lofi: 0, pump: 15, width: 75 },
  },
  folk: {
    name: 'Fantasy Folk', desc: 'Harps, flutes, guitars and hand drums in a lilting 6/8. Villages, forests, taverns.',
    bpm: 108, bpmRange: [80, 135], timeSig: '6/8', scales: ['dorian', 'mixolydian', 'major', 'minor'],
    progressions: [[0, 6, 0, 4], [0, 3, 0, 4], [0, 6, 3, 0], [5, 6, 0, 0], [0, 4, 5, 3]],
    hr: 1, chord7: 0.05, sus: 0.2,
    bass: 'folk', chords: 'strum', drums: 'folk', arp: { rate: 2, pattern: 'updown', oct: 2 },
    melody: { density: 0.55, res: 2, legato: 0.9, register: 12 }, swing: 0, swingUnit: 16,
    layers: { pad: L('pad-strings', 0.5, true), chords: L('guitar', 0.7), bass: L('bass-upright', 0.65), lead: L('lead-flute', 0.75),
      arp: L('harp', 0.5, false, 0.3), drums: L('hand', 0.7), ambience: L(null, 0.55) },
    mood: { energy: 55, tension: 25, brightness: 65, density: 55, complexity: 45 },
    fx: { reverbSize: 55, reverbMix: 30, delay: 'off', delayFb: 25, delayMix: 10, warmth: 25, lofi: 0, pump: 0, width: 70 },
  },
  electronic: {
    name: 'Techno / Cyber', desc: 'Four-on-the-floor, acid bass and stabs. Hacking, cyberpunk, stealth.',
    bpm: 124, bpmRange: [110, 145], timeSig: '4/4', scales: ['minor', 'phrygian', 'dorian'],
    progressions: [[0, 0, 5, 6], [0, 5, 0, 6], [0, 3, 0, 3], [0, 1, 0, 6]],
    hr: 2, chord7: 0.35, sus: 0.2,
    bass: 'offbeat', chords: 'stabs', drums: 'four', arp: { rate: 1, pattern: 'random', oct: 1 },
    melody: { density: 0.3, res: 1, legato: 0.7, register: 12 }, swing: 8, swingUnit: 16,
    layers: { pad: L('pad-dark', 0.5, true), chords: L('stab', 0.55), bass: L('bass-acid', 0.75), lead: L('lead-square', 0.5, true),
      arp: L('pluck', 0.55, false, 0.2), drums: L('electro', 0.85), ambience: L(null, 0.5) },
    mood: { energy: 80, tension: 55, brightness: 45, density: 60, complexity: 55 },
    fx: { reverbSize: 50, reverbMix: 22, delay: 'd8', delayFb: 45, delayMix: 22, warmth: 10, lofi: 0, pump: 55, width: 80 },
  },
  cozy: {
    name: 'Cozy / Puzzle', desc: 'Bouncy marimba, light percussion and sunny harmony. Puzzles, farming, shops.',
    bpm: 98, bpmRange: [78, 120], timeSig: '4/4', scales: ['majorPent', 'major', 'lydian', 'mixolydian'],
    progressions: [[0, 3, 4, 0], [0, 5, 3, 4], [3, 4, 2, 5], [0, 3, 1, 4], [0, 2, 3, 4]],
    hr: 1, chord7: 0.45, sus: 0.15, add9: 0.2,
    bass: 'roots', chords: 'bounce', drums: 'light', arp: { rate: 2, pattern: 'up', oct: 1 },
    melody: { density: 0.5, res: 2, legato: 0.7, register: 12 }, swing: 12, swingUnit: 16,
    layers: { pad: L('pad-glass', 0.4, true), chords: L('marimba', 0.65), bass: L('bass-upright', 0.65), lead: L('kalimba', 0.7),
      arp: L('pizz', 0.45, true), drums: L('minimal', 0.6), ambience: L(null, 0.45) },
    mood: { energy: 45, tension: 10, brightness: 80, density: 50, complexity: 45 },
    fx: { reverbSize: 40, reverbMix: 25, delay: '8', delayFb: 20, delayMix: 12, warmth: 20, lofi: 0, pump: 0, width: 65 },
  },
  world: {
    name: 'Desert / Exotic', desc: 'Phrygian-dominant melodies, oud plucks and hand drums. Deserts, bazaars, temples.',
    bpm: 100, bpmRange: [75, 130], timeSig: '4/4', scales: ['phrygianDominant', 'hirajoshi', 'harmonicMinor'],
    progressions: [[0, 1, 0, 1], [0, 6, 5, 1], [0, 1, 6, 0], [0, 3, 1, 0]],
    hr: 1, chord7: 0.05, sus: 0.1,
    bass: 'ostinato', chords: 'strum', drums: 'folk', arp: { rate: 1, pattern: 'updown', oct: 1 },
    melody: { density: 0.55, res: 1, legato: 0.88, register: 12, ornament: 0.35 }, swing: 0, swingUnit: 16,
    layers: { pad: L('pad-dark', 0.55), chords: L('oud', 0.6), bass: L('bass-sub', 0.6), lead: L('lead-flute', 0.75),
      arp: L('oud', 0.4, true), drums: L('hand', 0.75), ambience: L(null, 0.55) },
    mood: { energy: 55, tension: 55, brightness: 50, density: 55, complexity: 55 },
    fx: { reverbSize: 60, reverbMix: 32, delay: 'd8', delayFb: 30, delayMix: 14, warmth: 25, lofi: 0, pump: 0, width: 75 },
  },
};

export const LAYER_IDS = ['pad', 'chords', 'bass', 'lead', 'arp', 'drums', 'ambience'];
export const LAYER_NAMES = { pad: 'Pad', chords: 'Chords', bass: 'Bass', lead: 'Lead', arp: 'Arp', drums: 'Drums', ambience: 'Ambience' };
export const LAYER_COLORS = { pad: '#8b7cf6', chords: '#5aa9e6', bass: '#e8b04a', lead: '#f06d8c', arp: '#4fd1c5', drums: '#a3b1c6', ambience: '#7bc67e' };

export const DEFAULT_PARAMS = {
  name: 'Untitled Track', seed: 'amber-harbor-42', style: 'ambient', preset: null,
  key: 'auto', scale: 'auto', timeSig: '4/4',
  energy: 50, tension: 30, brightness: 60, density: 50, complexity: 50,
  bpm: 100, swing: 0, humanize: 30,
  mode: 'loop', length: 60, form: 'auto', intro: 2, outro: 2, variation: 40, harmRhythm: 'auto', cycles: 4,
  melRange: 14, repetition: 60, rests: 30, register: 'mid', ornaments: 20,
  bed: 'none', bedLevel: 50, sprinkles: 'none', sprinkleDensity: 40,
  reverbSize: 60, reverbMix: 30, delay: 'off', delayFb: 30, delayMix: 15, warmth: 20, lofi: 0, pump: 0, width: 70, master: 80,
  layers: {},
};

// Build a full parameter set for a style (keeps non-style fields from `base`).
export function applyStyle(base, styleId, { keepMood = true } = {}) {
  const st = STYLES[styleId];
  const p = structuredClone(base);
  p.style = styleId;
  p.bpm = st.bpm;
  p.timeSig = st.timeSig;
  p.swing = st.swing;
  Object.assign(p, st.fx);
  if (!keepMood) Object.assign(p, st.mood);
  p.layers = {};
  for (const id of LAYER_IDS) {
    const d = st.layers[id];
    p.layers[id] = { inst: d.inst, vol: d.vol, mute: d.mute, solo: false, pan: d.pan || 0 };
  }
  return p;
}
