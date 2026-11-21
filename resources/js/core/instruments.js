// Instrument & drum-kit catalogue. Pure data – rendered by synth.js.
// roles: pad | keys | bass | lead     gm: General MIDI program (0-based) for MIDI export

export const INSTRUMENTS = {
  // ── Pads ────────────────────────────────────────────────────────────────
  'pad-warm':    { name: 'Warm Analog',     roles: ['pad'], gm: 89, level: 0.20,
    osc: [{ type: 'sawtooth', detune: -9 }, { type: 'sawtooth', detune: 9 }, { type: 'triangle', mult: 0.5, gain: 0.6 }],
    filter: { freq: 900, q: 0.8, env: 1.0, a: 1.2, decay: 3, key: 0.3 }, env: { a: 1.2, d: 1.5, s: 0.85, r: 2.2 }, vib: { rate: 0.3, depth: 5 } },
  'pad-glass':   { name: 'Glass Pad',       roles: ['pad'], gm: 92, level: 0.26,
    osc: [{ type: 'triangle' }, { type: 'sine', mult: 2, gain: 0.35, detune: 6 }, { type: 'sine', mult: 4, gain: 0.08, detune: -5 }],
    filter: { freq: 5200, q: 0.4 }, env: { a: 1.6, d: 2, s: 0.85, r: 3 }, trem: { rate: 0.25, depth: 0.25 } },
  'pad-strings': { name: 'String Ensemble', roles: ['pad'], gm: 48, level: 0.15,
    osc: [{ type: 'sawtooth', detune: -11 }, { type: 'sawtooth', detune: 12 }, { type: 'sawtooth', gain: 0.6 }],
    filter: { freq: 2300, q: 0.5, env: 0.3, decay: 1 }, hp: 180, env: { a: 0.45, d: 1, s: 0.9, r: 1.1 }, vib: { rate: 5, depth: 9, delay: 0.4 } },
  'pad-choir':   { name: 'Choir Aah',       roles: ['pad'], gm: 52, level: 0.55,
    osc: [{ type: 'sawtooth', detune: -7 }, { type: 'sawtooth', detune: 7 }],
    formants: [[730, 9, 1], [1090, 11, 0.5], [2440, 14, 0.22]], env: { a: 0.9, d: 1, s: 0.9, r: 1.6 }, vib: { rate: 4.6, depth: 12, delay: 0.3 } },
  'pad-dark':    { name: 'Dark Drone',      roles: ['pad'], gm: 95, level: 0.24,
    osc: [{ type: 'sawtooth', detune: -6 }, { type: 'sawtooth', detune: 6 }, { type: 'sine', mult: 0.5, gain: 0.9 }],
    filter: { freq: 480, q: 3, lfo: { rate: 0.09, depth: 280 } }, env: { a: 2, d: 2, s: 0.9, r: 3 } },
  'pad-chip':    { name: 'Chip Soft Pulse', roles: ['pad', 'keys'], gm: 80, level: 0.10,
    osc: [{ type: 'pulse50' }], filter: { freq: 6000, q: 0.3 }, env: { a: 0.04, d: 0.4, s: 0.6, r: 0.25 }, vib: { rate: 5, depth: 8, delay: 0.3 } },
  'pad-organ':   { name: 'Drawbar Organ',   roles: ['pad', 'keys'], gm: 16, level: 0.16,
    osc: [{ type: 'organ' }], env: { a: 0.02, d: 0.1, s: 1, r: 0.18 }, vib: { rate: 6.2, depth: 6 } },

  // ── Keys / plucked ─────────────────────────────────────────────────────
  'piano':       { name: 'Soft Piano',      roles: ['keys', 'lead'], gm: 0, level: 0.34,
    osc: [{ type: 'piano' }, { type: 'sine', mult: 1, gain: 0.4, detune: 3 }],
    filter: { freq: 1800, q: 0.5, env: 2.2, decay: 0.7, key: 0.6 }, env: { a: 0.004, d: 2.2, s: 0, r: 0.45 } },
  'epiano':      { name: 'Electric Piano',  roles: ['keys', 'lead'], gm: 4, level: 0.34,
    osc: [{ type: 'sine' }], fm: { ratio: 1, index: 2.2, decay: 0.5 }, tine: 0.18,
    env: { a: 0.004, d: 2.4, s: 0.12, r: 0.5 }, trem: { rate: 4.5, depth: 0.18 } },
  'pluck':       { name: 'Synth Pluck',     roles: ['keys', 'lead'], gm: 81, level: 0.22,
    osc: [{ type: 'sawtooth', detune: -6 }, { type: 'sawtooth', detune: 6 }],
    filter: { freq: 500, q: 2, env: 7, decay: 0.18, key: 0.5 }, env: { a: 0.002, d: 0.45, s: 0, r: 0.2 } },
  'harp':        { name: 'Harp',            roles: ['keys', 'lead'], gm: 46, level: 0.34,
    osc: [{ type: 'triangle' }, { type: 'sine', mult: 2, gain: 0.25 }],
    filter: { freq: 3800, q: 0.3 }, env: { a: 0.002, d: 1.4, s: 0, r: 0.8 } },
  'marimba':     { name: 'Marimba',         roles: ['keys', 'lead'], gm: 12, level: 0.38,
    osc: [{ type: 'sine' }, { type: 'sine', mult: 4, gain: 0.22, decay: 0.08 }, { type: 'sine', mult: 10, gain: 0.05, decay: 0.03 }],
    env: { a: 0.002, d: 0.55, s: 0, r: 0.25 } },
  'kalimba':     { name: 'Kalimba',         roles: ['keys', 'lead'], gm: 108, level: 0.36,
    osc: [{ type: 'sine' }, { type: 'sine', mult: 5.4, gain: 0.14, decay: 0.06 }, { type: 'sine', mult: 2, gain: 0.12 }],
    env: { a: 0.002, d: 0.9, s: 0, r: 0.4 } },
  'pizz':        { name: 'Pizzicato Strings', roles: ['keys', 'lead'], gm: 45, level: 0.28,
    osc: [{ type: 'sawtooth' }, { type: 'triangle', gain: 0.5 }],
    filter: { freq: 900, q: 0.6, env: 2, decay: 0.12, key: 0.6 }, env: { a: 0.003, d: 0.3, s: 0, r: 0.18 } },
  'stab':        { name: 'Synth Stab',      roles: ['keys'], gm: 87, level: 0.16,
    osc: [{ type: 'sawtooth', detune: -10 }, { type: 'square', detune: 10, gain: 0.6 }],
    filter: { freq: 700, q: 3, env: 4, decay: 0.22 }, env: { a: 0.004, d: 0.35, s: 0.25, r: 0.2 } },
  'chip-pulse':  { name: 'Chip Pulse 25%',  roles: ['keys', 'lead'], gm: 80, level: 0.11,
    osc: [{ type: 'pulse25' }], env: { a: 0.002, d: 0.15, s: 0.55, r: 0.05 } },
  'guitar':      { name: 'Nylon Guitar',    roles: ['keys', 'lead'], gm: 24, level: 0.30,
    osc: [{ type: 'triangle' }, { type: 'sawtooth', gain: 0.35 }],
    filter: { freq: 1400, q: 0.8, env: 2, decay: 0.3, key: 0.5 }, env: { a: 0.002, d: 1.2, s: 0, r: 0.3 } },
  'oud':         { name: 'Oud',             roles: ['keys', 'lead'], gm: 105, level: 0.30,
    osc: [{ type: 'sawtooth' }, { type: 'square', gain: 0.25 }],
    filter: { freq: 1100, q: 4, env: 1.6, decay: 0.25 }, hp: 200, env: { a: 0.002, d: 0.9, s: 0, r: 0.25 }, bend: { semis: 0.6, time: 0.05 } },

  // ── Bass ───────────────────────────────────────────────────────────────
  'bass-sub':     { name: 'Sub Bass',      roles: ['bass'], gm: 38, level: 0.48,
    osc: [{ type: 'sine' }, { type: 'triangle', gain: 0.18 }], env: { a: 0.01, d: 0.3, s: 0.9, r: 0.18 } },
  'bass-saw':     { name: 'Saw Bass',      roles: ['bass'], gm: 38, level: 0.26,
    osc: [{ type: 'sawtooth' }, { type: 'sine', mult: 0.5, gain: 0.6 }],
    filter: { freq: 380, q: 4, env: 2.5, decay: 0.22 }, env: { a: 0.004, d: 0.3, s: 0.8, r: 0.12 } },
  'bass-acid':    { name: 'Acid 303',      roles: ['bass'], gm: 87, level: 0.22,
    osc: [{ type: 'sawtooth' }], filter: { freq: 260, q: 15, env: 7, decay: 0.16 }, env: { a: 0.003, d: 0.2, s: 0.75, r: 0.08 } },
  'bass-synth':   { name: 'Synthwave Bass', roles: ['bass'], gm: 39, level: 0.25,
    osc: [{ type: 'square' }, { type: 'sawtooth', detune: 7, gain: 0.6 }, { type: 'sine', mult: 0.5, gain: 0.6 }],
    filter: { freq: 600, q: 1.5, env: 1.8, decay: 0.2 }, env: { a: 0.004, d: 0.25, s: 0.7, r: 0.1 } },
  'bass-chip':    { name: 'Chip Triangle', roles: ['bass'], gm: 38, level: 0.42,
    osc: [{ type: 'chipTri' }], env: { a: 0.002, d: 0.1, s: 0.95, r: 0.03 } },
  'bass-upright': { name: 'Upright Bass',  roles: ['bass'], gm: 32, level: 0.50,
    osc: [{ type: 'sine' }, { type: 'triangle', gain: 0.5 }], filter: { freq: 700, q: 0.5, env: 1, decay: 0.15 },
    env: { a: 0.006, d: 0.9, s: 0.2, r: 0.16 } },
  'bass-cello':   { name: 'Cello Section', roles: ['bass'], gm: 42, level: 0.20,
    osc: [{ type: 'sawtooth', detune: -6 }, { type: 'sawtooth', detune: 6 }], filter: { freq: 1000, q: 0.6 },
    env: { a: 0.06, d: 0.5, s: 0.85, r: 0.3 }, vib: { rate: 5.2, depth: 8, delay: 0.25 } },

  // ── Leads ──────────────────────────────────────────────────────────────
  'lead-saw':     { name: 'Saw Lead',      roles: ['lead'], gm: 81, level: 0.16,
    osc: [{ type: 'sawtooth', detune: -7 }, { type: 'sawtooth', detune: 7 }],
    filter: { freq: 2600, q: 1, env: 0.6, decay: 0.4 }, env: { a: 0.01, d: 0.3, s: 0.8, r: 0.22 }, vib: { rate: 5.5, depth: 14, delay: 0.25 } },
  'lead-square':  { name: 'Square Lead',   roles: ['lead'], gm: 80, level: 0.14,
    osc: [{ type: 'square' }], filter: { freq: 2400, q: 1 }, env: { a: 0.006, d: 0.2, s: 0.8, r: 0.15 }, vib: { rate: 5.8, depth: 12, delay: 0.2 } },
  'lead-flute':   { name: 'Flute',         roles: ['lead'], gm: 73, level: 0.36,
    osc: [{ type: 'sine' }, { type: 'triangle', gain: 0.18 }], breath: 0.10,
    env: { a: 0.07, d: 0.2, s: 0.85, r: 0.2 }, vib: { rate: 5, depth: 13, delay: 0.22 } },
  'lead-bell':    { name: 'Crystal Bell',  roles: ['lead', 'keys'], gm: 14, level: 0.26,
    osc: [{ type: 'sine' }], fm: { ratio: 3.5, index: 3.5, decay: 1.4 }, env: { a: 0.002, d: 2.6, s: 0, r: 1.6 } },
  'lead-chip':    { name: 'Chip Pulse 12%', roles: ['lead'], gm: 80, level: 0.10,
    osc: [{ type: 'pulse125' }], env: { a: 0.002, d: 0.1, s: 0.8, r: 0.05 }, vib: { rate: 6, depth: 22, delay: 0.18 } },
  'lead-brass':   { name: 'Brass Section', roles: ['lead'], gm: 61, level: 0.17,
    osc: [{ type: 'sawtooth', detune: -8 }, { type: 'sawtooth', detune: 8 }],
    filter: { freq: 450, q: 1.2, env: 4, a: 0.12, decay: 0.6, key: 0.5 }, env: { a: 0.06, d: 0.4, s: 0.85, r: 0.25 }, vib: { rate: 5, depth: 6, delay: 0.35 } },
  'lead-ocarina': { name: 'Ocarina',       roles: ['lead'], gm: 79, level: 0.40,
    osc: [{ type: 'sine' }, { type: 'sine', mult: 2, gain: 0.06 }, { type: 'sine', mult: 3, gain: 0.04 }], breath: 0.04,
    env: { a: 0.05, d: 0.2, s: 0.9, r: 0.18 }, vib: { rate: 5.4, depth: 10, delay: 0.25 } },
  'lead-violin':  { name: 'Solo Violin',   roles: ['lead'], gm: 40, level: 0.17,
    osc: [{ type: 'sawtooth' }, { type: 'sawtooth', detune: 4, gain: 0.5 }], filter: { freq: 3000, q: 1.5 }, hp: 350,
    env: { a: 0.08, d: 0.3, s: 0.9, r: 0.25 }, vib: { rate: 5.6, depth: 18, delay: 0.15 } },
  'lead-glock':   { name: 'Music Box',     roles: ['lead', 'keys'], gm: 10, level: 0.26,
    osc: [{ type: 'sine' }, { type: 'sine', mult: 2.76, gain: 0.25, decay: 0.15 }, { type: 'sine', mult: 5.4, gain: 0.1, decay: 0.06 }],
    env: { a: 0.001, d: 1.4, s: 0, r: 0.9 } },
  'lead-whistle': { name: 'Whistle',       roles: ['lead'], gm: 78, level: 0.32,
    osc: [{ type: 'sine' }], breath: 0.03, env: { a: 0.03, d: 0.1, s: 0.9, r: 0.12 }, vib: { rate: 6.2, depth: 16, delay: 0.12 } },
  'arp-sparkle':  { name: 'Sparkle',       roles: ['keys', 'lead'], gm: 98, level: 0.24,
    osc: [{ type: 'sine' }, { type: 'sine', mult: 3, gain: 0.15, decay: 0.1 }], env: { a: 0.002, d: 0.4, s: 0, r: 0.35 } },
};

export const LAYER_ROLES = {
  pad: ['pad'],
  chords: ['keys', 'pad'],
  bass: ['bass'],
  lead: ['lead', 'keys'],
  arp: ['keys', 'lead'],
};

export function instrumentsFor(layer) {
  const roles = LAYER_ROLES[layer] || [];
  return Object.entries(INSTRUMENTS).filter(([, d]) => d.roles.some((r) => roles.includes(r)));
}

// Drum kits – each voice is synthesised from these parameters.
export const KITS = {
  electro:   { name: 'Electro 808/909', gain: 1,
    kick: { f0: 165, f1: 44, pd: 0.07, decay: 0.42, click: 0.5 }, snare: { tone: 185, toneAmt: 0.5, decay: 0.17, bp: 2000 },
    clap: { bp: 1300, decay: 0.16 }, hat: { hp: 7600, decay: 0.045 }, ohat: { hp: 7000, decay: 0.32 } },
  acoustic:  { name: 'Studio Kit', gain: 1,
    kick: { f0: 120, f1: 52, pd: 0.04, decay: 0.3, click: 0.8 }, snare: { tone: 210, toneAmt: 0.35, decay: 0.21, bp: 3200 },
    clap: { bp: 1500, decay: 0.12 }, hat: { hp: 8500, decay: 0.035 }, ohat: { hp: 8000, decay: 0.28 } },
  chip:      { name: '8-bit Noise', chip: true, gain: 0.85,
    kick: { f0: 180, f1: 50, pd: 0.06, decay: 0.12 }, snare: { decay: 0.12 }, hat: { decay: 0.03 }, ohat: { decay: 0.12 } },
  cinematic: { name: 'Cinematic Percussion', gain: 1.1,
    kick: { f0: 95, f1: 40, pd: 0.09, decay: 0.9, click: 0.2 }, snare: { tone: 170, toneAmt: 0.5, decay: 0.3, bp: 1600 },
    clap: { bp: 1100, decay: 0.2 }, hat: { hp: 6000, decay: 0.05 }, ohat: { hp: 5500, decay: 0.4 } },
  lofi:      { name: 'Dusty Lo-fi', gain: 0.9, lp: 3800,
    kick: { f0: 110, f1: 48, pd: 0.05, decay: 0.32, click: 0.3 }, snare: { tone: 200, toneAmt: 0.4, decay: 0.16, bp: 2200 },
    clap: { bp: 1200, decay: 0.12 }, hat: { hp: 6000, decay: 0.03 }, ohat: { hp: 5500, decay: 0.18 } },
  hand:      { name: 'Hand Drums', gain: 1,
    kick: { f0: 110, f1: 70, pd: 0.03, decay: 0.38, click: 0.1 }, snare: { tone: 330, toneAmt: 0.75, decay: 0.12, bp: 2600 },
    clap: { bp: 1600, decay: 0.1 }, hat: { hp: 4500, decay: 0.05 }, ohat: { hp: 4000, decay: 0.15 } },
  minimal:   { name: 'Soft Minimal', gain: 0.7, lp: 5000,
    kick: { f0: 90, f1: 46, pd: 0.06, decay: 0.45, click: 0.05 }, snare: { tone: 220, toneAmt: 0.6, decay: 0.12, bp: 1800 },
    clap: { bp: 1300, decay: 0.1 }, hat: { hp: 7000, decay: 0.03 }, ohat: { hp: 6500, decay: 0.2 } },
};

export const DRUM_GM = { kick: 36, rim: 37, snare: 38, clap: 39, tomL: 45, hat: 42, ohat: 46, tomH: 50, crash: 49, ride: 51, shaker: 70, taiko: 41, perc: 60 };

export const BEDS = {
  none: 'None', wind: 'Wind', rain: 'Rain', ocean: 'Ocean Waves', space: 'Space Hum', fire: 'Campfire',
  vinyl: 'Vinyl Crackle', cave: 'Cave Rumble', night: 'Night Air', city: 'City Hum', underwater: 'Underwater',
};
export const SPRINKLES = {
  none: 'None', birds: 'Birds', drips: 'Water Drips', crickets: 'Crickets', stars: 'Star Twinkles',
  bubbles: 'Bubbles', thunder: 'Distant Thunder', chimes: 'Wind Chimes',
};
