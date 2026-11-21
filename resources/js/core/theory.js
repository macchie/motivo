// Music theory helpers: scales, chords, voicings.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// `harm` = heptatonic parent used to build chords for non-heptatonic scales.
// `mood` = 0 (dark) … 1 (bright), used by the auto scale picker.
export const NOTE_FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const NOTE_SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
// Decide flat vs sharp spelling from the relative major of the key/mode.
export function usesFlats(keyPc, iv) {
  const minorish = iv.includes(3) && !iv.includes(4);
  const rel = (keyPc + (minorish ? 3 : 0) + (iv.includes(1) && minorish ? 5 : 0)) % 12;
  return [5, 10, 3, 8, 1, 6].includes(rel);
}
export const pcName = (pc, flats) => (flats ? NOTE_FLATS : NOTE_SHARPS)[((pc % 12) + 12) % 12];

export const SCALES = {
  major:            { name: 'Major',             iv: [0, 2, 4, 5, 7, 9, 11], mood: 0.80 },
  lydian:           { name: 'Lydian',            iv: [0, 2, 4, 6, 7, 9, 11], mood: 0.92 },
  mixolydian:       { name: 'Mixolydian',        iv: [0, 2, 4, 5, 7, 9, 10], mood: 0.66 },
  majorPent:        { name: 'Major Pentatonic',  iv: [0, 2, 4, 7, 9], harm: 'major', mood: 0.86 },
  dorian:           { name: 'Dorian',            iv: [0, 2, 3, 5, 7, 9, 10], mood: 0.48 },
  minorPent:        { name: 'Minor Pentatonic',  iv: [0, 3, 5, 7, 10], harm: 'minor', mood: 0.38 },
  minor:            { name: 'Natural Minor',     iv: [0, 2, 3, 5, 7, 8, 10], mood: 0.30 },
  harmonicMinor:    { name: 'Harmonic Minor',    iv: [0, 2, 3, 5, 7, 8, 11], mood: 0.20 },
  phrygian:         { name: 'Phrygian',          iv: [0, 1, 3, 5, 7, 8, 10], mood: 0.14 },
  phrygianDominant: { name: 'Phrygian Dominant', iv: [0, 1, 4, 5, 7, 8, 10], mood: 0.24 },
  hirajoshi:        { name: 'Hirajoshi',         iv: [0, 2, 3, 7, 8], harm: 'minor', mood: 0.32 },
  wholeTone:        { name: 'Whole Tone',        iv: [0, 2, 4, 6, 8, 10], mood: 0.50 },
};

export const TIME_SIGS = {
  '4/4': { label: '4/4', steps: 16, groups: [4, 4, 4, 4] },
  '3/4': { label: '3/4', steps: 12, groups: [4, 4, 4] },
  '6/8': { label: '6/8', steps: 12, groups: [6, 6] },
  '5/4': { label: '5/4', steps: 20, groups: [4, 4, 4, 4, 4] },
  '7/8': { label: '7/8', steps: 14, groups: [4, 4, 6] },
};

export const mod = (n, m) => ((n % m) + m) % m;
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const noteName = (midi) => NOTE_NAMES[mod(midi, 12)] + (Math.floor(midi / 12) - 1);

export function harmonyScale(scaleId) {
  const s = SCALES[scaleId];
  return s.harm ? SCALES[s.harm].iv : s.iv;
}

// Build chord intervals (relative to key root) for a scale degree.
export function buildChord(scaleIv, degree, size = 3, color = null) {
  const L = scaleIv.length;
  const out = [];
  for (let k = 0; k < size; k++) {
    const idx = degree + 2 * k;
    out.push(scaleIv[mod(idx, L)] + 12 * Math.floor(idx / L));
  }
  const root = out[0];
  if (color === 'sus2' && out.length >= 2) out[1] = root + 2;
  if (color === 'sus4' && out.length >= 2) out[1] = root + 5;
  if (color === 'add9') out.push(root + 14);
  return out;
}

export function chordSymbol(keyPc, intervals, flats = false) {
  const root = intervals[0];
  const rel = intervals.map((i) => i - root);
  const has = (x) => rel.some((r) => mod(r, 12) === x);
  let q = '';
  const third = has(4) ? 4 : has(3) ? 3 : 0;
  const fifth = has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : 7;
  if (!third) q = has(5) ? 'sus4' : has(2) ? 'sus2' : '5';
  else if (third === 3 && fifth === 6) q = 'dim';
  else if (third === 4 && fifth === 8) q = 'aug';
  else if (third === 3) q = 'm';
  const sev = rel.length >= 4 ? mod(rel[3], 12) : null;
  let sus = '';
  if (q.startsWith('sus')) { sus = q; q = ''; }
  if (sev === 11) q = q === 'm' ? 'm(maj7)' : q + 'maj7';
  else if (sev === 10) q = q === 'dim' ? 'm7♭5' : q + '7';
  else if (sev === 9 && q === 'dim') q = 'dim7';
  q += sus;
  if (rel.some((r) => r === 14)) q += q ? '(add9)' : 'add9';
  return pcName(keyPc + root, flats) + q;
}

// Choose an inversion/octave of `pcsAbs` (absolute midi notes of root-position
// chord) that is close to the previous voicing and centred around `center`.
export function voiceLead(chordMidi, prev, center, spread = 0) {
  const n = chordMidi.length;
  const candidates = [];
  for (let inv = 0; inv < n; inv++) {
    const v = chordMidi.map((m, i) => (i < inv ? m + 12 : m)).sort((a, b) => a - b);
    for (let oct = -2; oct <= 2; oct++) candidates.push(v.map((m) => m + 12 * oct));
  }
  let best = candidates[0], bestCost = Infinity;
  for (const c of candidates) {
    const mean = c.reduce((a, b) => a + b, 0) / c.length;
    let cost = Math.abs(mean - center) * 0.6;
    if (prev && prev.length) {
      for (const m of c) {
        let d = Infinity;
        for (const p of prev) d = Math.min(d, Math.abs(p - m));
        cost += d;
      }
    }
    if (cost < bestCost) { bestCost = cost; best = c; }
  }
  if (spread && best.length >= 3) {
    // open voicing: drop the second-from-top an octave
    const v = best.slice();
    v[v.length - 2] -= 12;
    return v.sort((a, b) => a - b);
  }
  return best;
}
