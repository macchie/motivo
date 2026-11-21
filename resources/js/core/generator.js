// Procedural composer. Turns a parameter set + seed into a Song: sections,
// chords and note events (in beats) for every layer. Fully deterministic.

import { RNG } from './rng.js';
import { SCALES, TIME_SIGS, NOTE_NAMES, buildChord, chordSymbol, voiceLead, harmonyScale, mod, usesFlats, pcName } from './theory.js';
import { STYLES } from './styles.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function stepWeight(pos, ts) {
  if (pos === 0) return 1;
  let acc = 0;
  for (const g of ts.groups) { if (pos === acc) return 0.8; acc += g; }
  if (pos % 4 === 0) return 0.6;
  if (pos % 2 === 0) return 0.4;
  return 0.2;
}
function groupStarts(ts) {
  const out = []; let acc = 0;
  for (const g of ts.groups) { out.push(acc); acc += g; }
  return out;
}

function resolveForm(form, body, r) {
  let letters;
  if (!form || form === 'auto') {
    const n = body <= 8 ? 1 : Math.max(2, Math.floor(body / 8));
    const T = { 1: ['A'], 2: ['AB'], 3: ['ABA', 'AAB'], 4: ['AABA', 'ABAC', 'ABAB'], 5: ['ABACA', 'AABAB'], 6: ['AABABA', 'ABACAB'] };
    letters = n <= 6 ? r.pick(T[n]) : 'ABAC'.repeat(Math.ceil(n / 4)).slice(0, n);
  } else letters = form;
  let n = letters.length;
  while (n > 1 && body / n < 2) n--;
  letters = letters.slice(0, n);
  const chunk = body % 4 === 0 && body >= n * 4 ? 4 : body >= n * 2 ? 2 : 1;
  const base = Math.max(1, Math.floor(body / n / chunk) * chunk);
  const lens = new Array(n).fill(base);
  let rem = body - base * n, i = n - 1;
  while (rem > 0) { const add = Math.min(chunk, rem); lens[i] += add; rem -= add; i = (i - 1 + n) % n; }
  return letters.split('').map((l, k) => ({ letter: l, bars: lens[k] }));
}

function resolveHR(hr, st, E) {
  if (hr && hr !== 'auto') return parseFloat(hr);
  let h = st.hr;
  if (E > 0.8 && h > 1) h = h / 2;
  if (E < 0.25 && h < 2) h = h * 2;
  return h;
}

export function generateSong(params, opts = {}) {
  const cycle = opts.cycle || 0;
  const st = STYLES[params.style] || STYLES.ambient;
  const rng = new RNG(params.seed);
  const ts = TIME_SIGS[params.timeSig] || TIME_SIGS['4/4'];
  const SPB = ts.steps;
  const beatsPerBar = SPB / 4;
  const G = groupStarts(ts);
  const E = params.energy / 100, T = params.tension / 100, B = params.brightness / 100;
  const D = params.density / 100, C = params.complexity / 100, V = params.variation / 100;
  const H = params.humanize / 100;

  // ── Key & scale ─────────────────────────────────────────────────────────
  const keyPc = params.key === 'auto' ? rng.fork('key').int(0, 11) : Math.max(0, NOTE_NAMES.indexOf(params.key));
  let scaleId = params.scale;
  if (!SCALES[scaleId]) {
    const target = B * 0.65 + (1 - T) * 0.35;
    scaleId = rng.fork('scale').weighted(st.scales.map((s, i) => [s, Math.exp(-Math.pow(SCALES[s].mood - target, 2) / 0.03) * (1 - i * 0.06) + 0.01]));
  }
  const mel = SCALES[scaleId].iv;
  const harm = harmonyScale(scaleId);
  const HL = harm.length, ML = mel.length;
  const flats = usesFlats(keyPc, mel);

  // ── Length & form ───────────────────────────────────────────────────────
  const bpm = params.bpm;
  const barSec = beatsPerBar * 60 / bpm;
  const oneshot = params.mode === 'oneshot';
  const totalTarget = Math.max(1, Math.round(params.length / barSec));
  let intro = 0, outro = 0, body;
  if (oneshot) {
    intro = Math.min(params.intro, Math.floor(totalTarget / 4));
    outro = Math.min(params.outro, Math.floor(totalTarget / 3));
    body = Math.max(2, totalTarget - intro - outro);
    if (body >= 8) body = Math.round(body / 2) * 2;
  } else {
    body = Math.max(4, Math.round(totalTarget / 4) * 4);
  }
  const form = resolveForm(params.form, body, rng.fork('form'));
  const hr = resolveHR(params.harmRhythm, st, E);

  // ── Harmony per section letter ─────────────────────────────────────────
  const progCache = {};
  const usedTemplates = [];
  function progression(letter, bars) {
    const key = letter + ':' + bars;
    if (progCache[key]) return progCache[key];
    const r = rng.fork('harm-' + letter);
    const chordBars = Math.min(hr, bars);
    const n = Math.max(1, Math.round(bars / chordBars));
    let options = st.progressions.filter((p) => !usedTemplates.includes(p));
    if (!options.length) options = st.progressions;
    const tmpl = r.pick(options);
    usedTemplates.push(tmpl);
    const rot = letter === 'A' ? 0 : r.int(0, 2);
    const seq = [];
    for (let i = 0; i < n; i++) {
      let deg = tmpl[(i + rot) % tmpl.length];
      const second = i >= tmpl.length;
      if (i > 0 && r.chance(C * (second ? 0.35 : 0.18))) deg = deg + r.pick([2, -2, 5]);
      if (i > 0 && r.chance(T * 0.2)) deg = r.pick([1, 4, 6]);
      seq.push(mod(deg, HL));
    }
    progCache[key] = { degs: seq, chordBars: bars / n };
    return progCache[key];
  }

  const isDim = (d) => { const c = buildChord(harm, mod(d, HL), 3); return c[1] - c[0] === 3 && c[2] - c[0] === 6; };
  function makeChord(deg, r) {
    if (HL === 7 && isDim(deg) && !(T > 0.5 && r.chance(T * 0.5))) {
      for (const alt of [deg - 2, deg + 1, deg - 1, deg + 2]) if (!isDim(alt)) { deg = mod(alt, HL); break; }
    }
    let size = r.chance((st.chord7 || 0) * (0.55 + C * 0.9)) ? 4 : 3;
    let color = null;
    if (r.chance((st.sus || 0) * (1 - T * 0.5))) color = r.chance(0.5) ? 'sus2' : 'sus4';
    else if (r.chance((st.add9 || 0) * (0.5 + C))) color = 'add9';
    const iv = buildChord(harm, deg, size, color);
    if (st.cluster && r.chance(st.cluster * T)) iv.push(iv[0] + 13);
    return { deg, iv, symbol: chordSymbol(keyPc, iv, flats) };
  }

  // ── Sections (with arrangement) ────────────────────────────────────────
  const evo = rng.fork('evo-' + cycle);
  const sections = [];
  let barCursor = 0;
  const allLayers = ['pad', 'chords', 'bass', 'lead', 'arp', 'drums', 'ambience'];
  if (intro > 0) {
    const lay = new Set(['pad', 'ambience']);
    if (st.bass === 'drone') lay.add('bass');
    if (E > 0.5) lay.add('arp');
    sections.push({ letter: 'I', label: 'Intro', bars: intro, energy: 0.45, layers: lay });
  }
  const occ = {};
  form.forEach((f, i) => {
    occ[f.letter] = (occ[f.letter] || 0) + 1;
    const k = occ[f.letter] - 1;
    let energy = f.letter === 'A' ? (k === 0 ? 0.8 : 0.9) : f.letter === 'B' ? 1 : 0.92;
    const lay = new Set(allLayers);
    if (form.length >= 3 && i === 0) { energy = 0.72; if (E < 0.75) lay.delete('arp'); }
    if (form.length === 1) energy = 0.92;
    sections.push({ letter: f.letter, label: f.letter === 'A' ? 'A' : f.letter, occurrence: k, bars: f.bars, energy, layers: lay });
  });
  if (outro > 0) sections.push({ letter: 'O', label: 'Outro', bars: outro, energy: 0.4, layers: new Set(['pad', 'ambience', 'bass', 'lead', 'chords']) });

  // Evolving loops: reshape arrangement per cycle so long sessions stay fresh.
  if (params.mode === 'evolve' && cycle > 0) {
    const phase = cycle % 4;
    for (const s of sections) {
      if (phase === 1 && evo.chance(0.4 + V * 0.5)) { s.layers.delete('lead'); s.layers.add('arp'); s.energy *= 0.9; }
      if (phase === 2) s.energy = Math.min(1.1, s.energy * (1 + V * 0.2));
      if (phase === 3 && evo.chance(0.3 + V * 0.6)) { s.layers.delete('drums'); s.energy *= 0.6; }
    }
  }

  let chordList = [];
  for (const s of sections) {
    s.startBar = barCursor;
    s.startBeat = barCursor * beatsPerBar;
    barCursor += s.bars;
    let degs, chordBars;
    if (s.letter === 'I') {
      const a = progression(form[0].letter, form[0].bars);
      degs = s.bars >= 2 ? [a.degs[0], a.degs[1 % a.degs.length]] : [a.degs[0]];
      chordBars = s.bars / degs.length;
    } else if (s.letter === 'O') {
      degs = [0]; chordBars = s.bars;
    } else {
      const p = progression(s.letter, s.bars);
      degs = p.degs.slice(); chordBars = p.chordBars;
    }
    const cr = rng.fork('chord-' + s.letter);
    s.chords = degs.map((d, i) => ({ ...makeChord(d, cr), t: s.startBeat + i * chordBars * beatsPerBar, d: chordBars * beatsPerBar }));
    chordList.push(...s.chords);
  }
  // Cadence handling
  const bodySecs = sections.filter((s) => s.letter !== 'I' && s.letter !== 'O');
  const lastBody = bodySecs[bodySecs.length - 1];
  if (lastBody && lastBody.chords.length > 1) {
    const lc = lastBody.chords[lastBody.chords.length - 1];
    const cr = rng.fork('cadence');
    if (!oneshot && lc.deg === 0) Object.assign(lc, makeChord(cr.pick([4, 3, HL - 1]) % HL, cr));
    if (oneshot && lc.deg !== 4 && cr.chance(0.6)) Object.assign(lc, makeChord(4 % HL, cr));
  }
  if (oneshot && !outro && lastBody) {
    const lc = lastBody.chords[lastBody.chords.length - 1];
    Object.assign(lc, makeChord(0, rng.fork('final')));
  }

  const totalBars = barCursor;
  const totalBeats = totalBars * beatsPerBar;
  const tracks = { pad: [], chords: [], bass: [], lead: [], arp: [], drums: [], ambience: [] };

  const chordAbs = (c, base) => c.iv.map((i) => base + keyPc + i);

  // ── Pad ────────────────────────────────────────────────────────────────
  {
    let prev = null, prevEv = null, prevSym = null;
    for (const s of sections) {
      if (!s.layers.has('pad')) { prev = null; prevSym = null; continue; }
      for (const c of s.chords) {
        const v = voiceLead(chordAbs(c, 48), prev, 58, C > 0.55);
        if (prevSym === c.symbol && prevEv && Math.abs(prevEv[0].t + prevEv[0].d - c.t) < 1e-6) {
          prevEv.forEach((e) => { e.d += c.d; });
        } else {
          prevEv = v.map((m) => ({ t: c.t, d: c.d, n: m, v: 0.7 }));
          tracks.pad.push(...prevEv);
        }
        prev = v; prevSym = c.symbol;
      }
    }
  }

  // ── Bass ───────────────────────────────────────────────────────────────
  {
    const r = rng.fork('bass-' + cycle);
    for (const s of sections) {
      if (!s.layers.has('bass')) continue;
      const se = clamp(E * s.energy * 1.15, 0, 1);
      s.chords.forEach((c, ci) => {
        let root = 36 + mod(keyPc + c.iv[0], 12); if (root > 45) root -= 12;
        const fifth = root + 7, oct = root + 12, third = root + (c.iv[1] - c.iv[0]);
        const startStep = Math.round(c.t * 4), steps = Math.round(c.d * 4);
        const add = (st0, len, n, v) => tracks.bass.push({ t: (startStep + st0) / 4, d: len / 4, n, v });
        const next = s.chords[ci + 1] || null;
        if (s.letter === 'O') { add(0, Math.min(steps, SPB * 2), root, 0.8); return; }
        let pat = st.bass;
        if (se < 0.3 && ['pulse16', 'pulse8', 'offbeat', 'chip', 'ostinato'].includes(pat)) pat = 'roots';
        if (se < 0.55 && pat === 'pulse16') pat = 'pulse8';
        for (let i = 0; i < steps; i++) {
          const pos = (startStep + i) % SPB;
          const isG = G.includes(pos);
          switch (pat) {
            case 'drone':
              if (i === 0) add(0, steps, root, 0.8);
              else if (se > 0.55 && pos === 0 && i > 0) add(i, Math.min(SPB, steps - i), root, 0.6);
              break;
            case 'sparse':
              if (i === 0) { if (T > 0.6 && r.chance(0.35)) add(0, 2, root + 1, 0.5), add(2, steps - 2, root, 0.75); else add(0, steps, root, 0.75); }
              break;
            case 'roots':
              if (isG) { const gi = G.indexOf(pos); add(i, Math.min(4, steps - i) * 0.9, gi === 2 && r.chance(0.4) ? fifth : root, gi === 0 ? 0.85 : 0.65); }
              break;
            case 'pulse8':
              if (pos % 2 === 0) add(i, 1.7, pos % 4 === 2 && r.chance(C * 0.35) ? oct : root, isG ? 0.9 : 0.68);
              break;
            case 'pulse16':
              add(i, 0.85, (pos === SPB - 2 && r.chance(0.5)) ? fifth : (pos % 8 === 6 && r.chance(C * 0.4)) ? oct : root, isG ? 0.95 : 0.62);
              break;
            case 'offbeat':
              if (pos % 4 === 2) add(i, 1.5, root, 0.85);
              else if (pos % 4 === 3 && r.chance(C * 0.3)) add(i, 0.8, r.chance(0.5) ? oct : fifth, 0.6);
              break;
            case 'chip': {
              if (pos % 2 === 0) { const seq = [root, oct, fifth, oct]; add(i, 1.6, seq[(pos / 2) % 4], 0.8); }
              break;
            }
            case 'ostinato': {
              const seq = [root, root, fifth, root, oct, root, fifth, root];
              const div = se > 0.5 ? 2 : 4;
              if (pos % div === 0) add(i, div * 0.8, seq[(pos / 2) % seq.length], isG ? 0.9 : 0.7);
              break;
            }
            case 'folk':
              if (isG) add(i, 2.5, root, 0.85);
              else if (G.some((g, gi) => pos === g + Math.floor(ts.groups[gi] / 2))) add(i, 1.5, fifth, 0.6);
              break;
            case 'syncopated': {
              if (i === 0) s._sync = r.pick([[0, 6, 10], [0, 3, 8, 11], [0, 7, 10], [0, 10, 11]]);
              if (s._sync.includes(pos)) add(i, pos === 0 ? 3 : 1.5, pos === 11 ? fifth : root, pos === 0 ? 0.9 : 0.7);
              break;
            }
            case 'walking': {
              if (pos % 4 === 0) {
                const q = Math.floor(i / 4), last = i + 4 >= steps;
                let n = q === 0 ? root : q % 2 === 1 ? r.pick([third, fifth]) : r.pick([fifth, oct - 2]);
                if (last && next) { let nr = 36 + mod(keyPc + next.iv[0], 12); if (nr > 45) nr -= 12; n = nr + r.pick([-1, 1, 2]); }
                add(i, 3.4, n, 0.78);
              }
              break;
            }
            default:
              if (i === 0) add(0, steps, root, 0.8);
          }
        }
      });
    }
  }

  // ── Chords (comping) ───────────────────────────────────────────────────
  {
    const r = rng.fork('comp-' + cycle);
    let prev = null;
    for (const s of sections) {
      if (!s.layers.has('chords')) continue;
      const se = clamp(E * s.energy, 0, 1);
      for (const c of s.chords) {
        const v = voiceLead(chordAbs(c, 48), prev, 64, false);
        prev = v;
        const startStep = Math.round(c.t * 4), steps = Math.round(c.d * 4);
        const hit = (st0, len, vel, strum = 0, up = false) => {
          const order = up ? v.slice().reverse() : v;
          order.forEach((m, k) => tracks.chords.push({ t: (startStep + st0) / 4 + k * strum, d: len / 4, n: m, v: vel }));
        };
        if (s.letter === 'O') { hit(0, Math.min(steps, SPB * 2), 0.6, 0.02); continue; }
        let pat = st.chords;
        if (se < 0.3 && ['staccato', 'pulse', 'chiparp', 'stabs'].includes(pat)) pat = 'sustain';
        for (let i = 0; i < steps; i++) {
          const pos = (startStep + i) % SPB;
          const isG = G.includes(pos);
          switch (pat) {
            case 'sustain': if (i === 0) hit(0, steps, 0.6); break;
            case 'staccato': { const div = se > 0.6 ? 2 : 4; if (pos % div === 0) hit(i, 1, isG ? 0.75 : 0.55); break; }
            case 'pulse': if (pos % 2 === 0) hit(i, 1.6, isG ? 0.65 : 0.5); break;
            case 'stabs': {
              if (pos === 0) s._stab = r.pick([[2, 6, 10, 14], [0, 3, 6, 10], [2, 7, 10, 13], [6, 14]]).filter((x) => x < SPB);
              if (s._stab && s._stab.includes(pos)) hit(i, 1.2, 0.7);
              break;
            }
            case 'chiparp': {
              const idx = pos % v.length;
              tracks.chords.push({ t: (startStep + i) / 4, d: 0.9 / 4, n: v[idx] + 12, v: isG ? 0.7 : 0.55 });
              break;
            }
            case 'lofi': {
              if (pos === 0) s._lofi = r.pick([[0, 7], [0, 10], [0, 6, 11], [3, 10]]).filter((x) => x < SPB);
              if (s._lofi && s._lofi.includes(pos)) hit(i, pos === 0 ? 6 : 4, pos === 0 ? 0.62 : 0.5, 0.018);
              break;
            }
            case 'strum': {
              if (isG) hit(i, 3, 0.68, 0.022);
              else if (se > 0.45 && G.some((g, gi) => pos === g + Math.floor(ts.groups[gi] / 2))) hit(i, 1.5, 0.45, 0.018, true);
              break;
            }
            case 'bounce':
              if (pos === 0) hit(i, 1.5, 0.62);
              else if (pos % 4 === 2) hit(i, 1, 0.48);
              break;
            default: if (i === 0) hit(0, steps, 0.6);
          }
        }
      }
    }
  }

  // ── Arpeggio ───────────────────────────────────────────────────────────
  {
    const r = rng.fork('arp-' + cycle);
    let prev = null;
    for (const s of sections) {
      if (!s.layers.has('arp') || s.letter === 'O') continue;
      const se = clamp(E * s.energy, 0, 1);
      let rate = st.arp.rate;
      if (D < 0.3 || se < 0.3) rate *= 2;
      if (D > 0.8 && rate > 1) rate /= 2;
      const octs = Math.max(1, Math.min(3, st.arp.oct + (C > 0.7 ? 1 : 0)));
      for (const c of s.chords) {
        const v = voiceLead(chordAbs(c, 60), prev, 70, false);
        prev = v;
        let tones = [];
        for (let o = 0; o < octs; o++) tones.push(...v.map((m) => m + 12 * o));
        const pattern = st.arp.pattern;
        let seq;
        if (pattern === 'up') seq = tones;
        else if (pattern === 'down') seq = tones.slice().reverse();
        else if (pattern === 'updown') seq = tones.concat(tones.slice(1, -1).reverse());
        else seq = null;
        const startStep = Math.round(c.t * 4), steps = Math.round(c.d * 4);
        let k = 0;
        for (let i = 0; i < steps; i += rate) {
          const pos = (startStep + i) % SPB;
          const n = seq ? seq[k % seq.length] : r.pick(tones);
          k++;
          tracks.arp.push({ t: (startStep + i) / 4, d: rate * 0.9 / 4, n, v: G.includes(pos) ? 0.72 : 0.52, pan: (k % 2 ? -1 : 1) });
        }
      }
    }
  }

  // ── Lead melody ────────────────────────────────────────────────────────
  {
    let rootMidi = 60 + keyPc; if (rootMidi > 65) rootMidi -= 12;
    const regShift = params.register === 'low' ? -ML : params.register === 'high' ? ML : 0;
    const idxToMidi = (i) => rootMidi + 12 * Math.floor(i / ML) + mel[mod(i, ML)];
    const center = Math.round(ML * 0.7) + regShift;
    const half = Math.max(2, Math.round((params.melRange / 2) / 12 * ML));
    const lo = center - half, hi = center + half;
    const res = st.melody.res;
    const dens = st.melody.density * (0.45 + D * 1.1) * (0.7 + E * 0.6);
    const legato = st.melody.legato;
    const ornament = (params.ornaments / 100) * (st.melody.ornament || 0.25);
    const rep = params.repetition / 100, rests = params.rests / 100;

    const chordAt = (t) => { let c = chordList[0]; for (const ch of chordList) { if (ch.t <= t + 1e-6) c = ch; else break; } return c; };
    const isChordTone = (i, c) => c.iv.some((x) => mod(x + keyPc, 12) === mod(idxToMidi(i), 12));
    const nearestChordTone = (near, c, r) => {
      let best = near, bd = Infinity;
      for (let i = near - ML; i <= near + ML; i++) {
        if (i < lo || i > hi) continue;
        if (!isChordTone(i, c)) continue;
        const d = Math.abs(i - near) + (r ? r.next() * 0.3 : 0);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };
    const fold = (i) => { while (i > hi) i -= 2; while (i < lo) i += 2; return i; };

    function genMotif(r, mBars) {
      const steps = mBars * SPB;
      const on = [];
      for (let s = 0; s < steps; s += res) {
        const w = stepWeight(s % SPB, ts);
        let p = clamp(dens * (0.35 + 0.9 * w) + C * 0.22 * (1 - w), 0, 0.95);
        if (s === 0) p = Math.max(p, 0.8);
        if (r.chance(p)) on.push(s);
      }
      if (on.length < 2) { on.length = 0; on.push(0, G[Math.min(G.length - 1, 2)] || Math.floor(SPB / 2)); }
      const contour = [0];
      for (let j = 1; j < on.length; j++) {
        contour.push(contour[j - 1] + r.weighted([[1, 4], [-1, 4], [2, 1.2 + C * 2], [-2, 1.2 + C * 2], [0, 0.8], [3, C], [-3, C], [4, C * 0.5], [-4, C * 0.5]]));
      }
      return { steps, on, contour };
    }
    function varyMotif(m, r, amt) {
      const on = m.on.slice(), contour = m.contour.slice();
      for (let j = 1; j < contour.length; j++) if (r.chance(amt * 0.5)) contour[j] += r.pick([-1, 1, 2, -2]);
      if (r.chance(amt * 0.5) && on.length > 2) { const j = r.int(1, on.length - 1); on.splice(j, 1); contour.splice(j, 1); }
      if (r.chance(amt * 0.4)) {
        const s = r.int(1, m.steps / res - 1) * res;
        if (!on.includes(s)) { on.push(s); on.sort((a, b) => a - b); const j = on.indexOf(s); contour.splice(j, 0, (contour[j - 1] || 0) + r.pick([-1, 1])); }
      }
      return { steps: m.steps, on, contour };
    }

    const motifs = {};
    let anchor = center;
    for (const s of sections) {
      if (!s.layers.has('lead') || s.letter === 'I') continue;
      if (s.letter === 'O') {
        const c = s.chords[0];
        const i = nearestChordTone(anchor, c);
        tracks.lead.push({ t: s.startBeat, d: Math.min(s.bars, 2) * beatsPerBar, n: idxToMidi(i), v: 0.7 });
        continue;
      }
      const mBars = (res >= 2 && s.bars >= 4) || (SPB > 16 && s.bars >= 2) ? 2 : 1;
      if (!motifs[s.letter]) motifs[s.letter] = genMotif(rng.fork('motif-' + s.letter), mBars);
      const base = motifs[s.letter];
      const r = rng.fork(`mel-${s.letter}-${s.occurrence}-${cycle}`);
      const vAmt = (s.occurrence > 0 || cycle > 0) ? V : V * 0.4;
      const units = Math.max(1, Math.floor(s.bars / mBars));
      for (let u = 0; u < units; u++) {
        const unitStart = s.startBeat + u * mBars * beatsPerBar;
        const isLast = u === units - 1;
        const role = units === 1 ? 'M' : ['M', 'V', 'M', 'C'][u % 4];
        if (!isLast && u % 2 === 1 && r.chance(rests * 0.55)) continue; // breathing space
        let m;
        if (role === 'M') m = r.chance((1 - rep) * 0.6) ? genMotif(r, mBars) : (vAmt > 0.05 ? varyMotif(base, r, vAmt * 0.6) : base);
        else if (role === 'V') m = r.chance((1 - rep) * 0.7) ? genMotif(r, mBars) : varyMotif(base, r, 0.4 + vAmt * 0.5);
        else {
          const half = base.on.filter((x) => x < base.steps / 2);
          const on = half.length ? half : [0];
          m = { steps: base.steps, on: on.concat([Math.floor(base.steps / 2)]), contour: base.contour.slice(0, on.length).concat([0]), cadence: true };
        }
        const c0 = chordAt(unitStart);
        const start = nearestChordTone(clamp(anchor + r.int(-1, 1), lo, hi), c0, r);
        let lastIdx = start;
        for (let j = 0; j < m.on.length; j++) {
          const step = m.on[j];
          const t = unitStart + step / 4;
          const nextStep = j + 1 < m.on.length ? m.on[j + 1] : m.steps;
          const c = chordAt(t);
          let idx = fold(start + m.contour[j]);
          const w = stepWeight(step % SPB, ts);
          if ((w >= 0.6 && r.chance(0.7)) || (m.cadence && j === m.on.length - 1)) idx = nearestChordTone(idx, c, r);
          let lenSteps = nextStep - step;
          let dur = lenSteps * (lenSteps <= 2 ? Math.min(legato, 0.9) : legato);
          if (j === m.on.length - 1 && legato >= 0.9) dur = Math.min(nextStep - step, SPB);
          if (ornament > 0 && lenSteps >= 3 && r.chance(ornament)) {
            tracks.lead.push({ t: t, d: 0.2, n: idxToMidi(idx + 1), v: 0.5 });
            tracks.lead.push({ t: t + 0.25, d: Math.max(0.2, (dur - 1) / 4), n: idxToMidi(idx), v: 0.75 });
          } else {
            tracks.lead.push({ t, d: Math.max(0.15, dur / 4), n: idxToMidi(idx), v: w >= 0.6 ? 0.82 : 0.68 });
          }
          lastIdx = idx;
        }
        anchor = lastIdx;
      }
    }
  }

  // ── Drums ──────────────────────────────────────────────────────────────
  {
    const feel = st.drums;
    for (const s of sections) {
      const introFill = s.letter === 'I' && E > 0.5 && s.bars >= 1;
      if (!s.layers.has('drums') && !introFill) continue;
      if (s.letter === 'O') {
        if (s.layers.has('drums') && !['sparse', 'light'].includes(feel)) {
          tracks.drums.push({ t: s.startBeat, d: 0.25, n: feel === 'chip' ? 'snare' : 'crash', v: 0.6 }, { t: s.startBeat, d: 0.25, n: feel === 'epic' ? 'taiko' : 'kick', v: 0.8 });
        }
        continue;
      }
      const r = rng.fork(`drums-${s.letter}-${s.occurrence || 0}-${cycle}`);
      const se = clamp(E * s.energy, 0, 1);
      for (let b = 0; b < s.bars; b++) {
        const barBeat = s.startBeat + b * beatsPerBar;
        if (s.letter === 'I') {
          if (b === s.bars - 1) for (let i = 0; i < 4; i++) tracks.drums.push({ t: barBeat + (SPB - 4 + i) / 4, d: 0.25, n: feel === 'epic' ? 'taiko' : 'snare', v: 0.4 + i * 0.12 });
          continue;
        }
        const ev = [];
        const hit = (pos, n, v) => { if (pos < SPB) ev.push({ pos, n, v }); };
        const hats = (sub, v0 = 0.42, kind = 'hat') => { for (let p = 0; p < SPB; p += sub) hit(p, kind, (p % 4 === 0 ? v0 + 0.12 : v0) * (0.85 + r.next() * 0.2)); };
        const evenG = G.filter((_, i) => i % 2 === 0), oddG = G.filter((_, i) => i % 2 === 1);
        switch (feel) {
          case 'four':
            G.forEach((g) => hit(g, 'kick', 0.95));
            if (SPB === 16) [4, 8, 12].forEach((p) => { if (!G.includes(p)) hit(p, 'kick', 0.9); });
            if (se > 0.35) oddG.forEach((g) => hit(g, 'clap', 0.8));
            if (se > 0.3) for (let p = 2; p < SPB; p += 4) hit(p, 'ohat', 0.45);
            if (se > 0.62) for (let p = 1; p < SPB; p += 2) hit(p, 'hat', 0.3 + r.next() * 0.12);
            if (r.chance(C * 0.5)) hit(r.pick([3, 7, 11, 15]), 'rim', 0.4);
            break;
          case 'backbeat':
            evenG.forEach((g) => hit(g, 'kick', 0.95));
            if (r.chance(0.3 + C * 0.5)) hit(r.pick([6, 10, 11, 14]), 'kick', 0.75);
            oddG.forEach((g) => hit(g, 'snare', 0.9));
            hats(se > 0.72 ? 1 : 2, 0.38);
            if (r.chance(0.3)) hit(SPB - 2, 'ohat', 0.45);
            break;
          case 'boom':
            hit(0, 'kick', 0.9); r.pick([[7], [10], [7, 10], [11], [9]]).forEach((p) => hit(p, 'kick', 0.7));
            oddG.forEach((g) => hit(g, 'snare', 0.8));
            hats(2, 0.36);
            if (r.chance(C * 0.45)) hit(r.pick([9, 15, 7]), 'snare', 0.25);
            break;
          case 'drive':
            hit(0, 'kick', 1); hit(G[2] ?? 8, 'kick', 0.9);
            if (r.chance(0.5 + C * 0.4)) hit(6, 'kick', 0.75);
            if (r.chance(C * 0.6)) hit(r.pick([10, 11, 3]), 'kick', 0.7);
            oddG.forEach((g) => hit(g, 'snare', 0.95));
            hats(se > 0.55 ? 1 : 2, 0.36);
            if (se > 0.9 && b % 4 === 3) for (let p = SPB - 4; p < SPB; p++) hit(p, 'kick', 0.7);
            break;
          case 'chip':
            hit(0, 'kick', 0.9); hit(G[2] ?? Math.floor(SPB / 2), 'kick', 0.85);
            if (r.chance(C * 0.6)) hit(6, 'kick', 0.7);
            oddG.forEach((g) => hit(g, 'snare', 0.85));
            hats(se > 0.7 ? 1 : 2, 0.35);
            break;
          case 'epic': {
            if (se < 0.5) { hit(0, 'taiko', 0.9); hit(G[Math.floor(G.length / 2)], 'taiko', 0.65); break; }
            r.pick([[0, 3, 6, 8, 10], [0, 6, 8, 12, 14], [0, 8, 11, 12], [0, 3, 8, 11, 14]]).forEach((p, i) => hit(p, 'taiko', i === 0 ? 1 : 0.7));
            hit(0, 'kick', 0.8);
            if (se > 0.7) oddG.forEach((g) => hit(g, 'snare', 0.7));
            if (se > 0.8) hats(2, 0.25, 'shaker');
            if (r.chance(0.4)) hit(SPB - 2, 'tomL', 0.6);
            break;
          }
          case 'folk':
            G.forEach((g, i) => hit(g, 'kick', i === 0 ? 0.9 : 0.72));
            oddG.forEach((g) => hit(g, 'snare', 0.7));
            for (let p = 2; p < SPB; p += 2) if (!G.includes(p) && r.chance(0.35 + C * 0.4)) hit(p, 'perc', 0.5);
            hats(se > 0.6 ? 1 : 2, 0.3, 'shaker');
            break;
          case 'light':
            hit(0, 'kick', 0.7); if (r.chance(0.5)) hit(G[2] ?? 8, 'kick', 0.55);
            oddG.forEach((g) => hit(g, 'rim', 0.6));
            hats(2, 0.3, 'shaker');
            if (r.chance(C * 0.5)) hit(r.pick([6, 10, 14]), 'perc', 0.4);
            break;
          case 'sparse':
          default:
            if (b % 2 === 0) hit(0, T > 0.5 ? 'taiko' : 'tomL', 0.55);
            if (se > 0.3 && r.chance(0.5)) hit(r.pick(G), 'rim', 0.3);
            if (se > 0.45) hats(4, 0.22, 'shaker');
        }
        // Fills & crashes
        const phraseEnd = b % 4 === 3, secEnd = b === s.bars - 1;
        const fillP = secEnd ? 0.35 + se * 0.55 : phraseEnd ? 0.12 + se * 0.3 : 0;
        if (feel !== 'sparse' && feel !== 'light' && r.chance(fillP)) {
          const from = SPB - (se > 0.7 && r.chance(0.5) ? 8 : 4);
          for (let k = ev.length - 1; k >= 0; k--) if (ev[k].pos >= from && ev[k].n !== 'kick') ev.splice(k, 1);
          const toms = feel === 'epic' ? ['taiko', 'tomL'] : feel === 'chip' ? ['snare'] : feel === 'folk' ? ['snare', 'perc', 'kick'] : ['snare', 'tomH', 'tomL'];
          for (let p = from; p < SPB; p++) {
            if (feel !== 'chip' && feel !== 'drive' && p % 2 === 1 && r.chance(0.5)) continue;
            const n = toms[Math.min(toms.length - 1, Math.floor((p - from) / ((SPB - from) / toms.length)))];
            hit(p, n, 0.5 + (p - from) / (SPB - from) * 0.45);
          }
        }
        if (b === 0 && se > 0.45 && !['sparse', 'light', 'folk'].includes(feel)) hit(0, feel === 'chip' ? 'ohat' : 'crash', 0.7);
        for (const e of ev) tracks.drums.push({ t: barBeat + e.pos / 4, d: 0.25, n: e.n, v: clamp(e.v, 0.05, 1) });
      }
    }
  }

  // ── Ambience sprinkles ────────────────────────────────────────────────
  {
    const r = rng.fork('amb-' + cycle);
    const kinds = [];
    if (params.sprinkles && params.sprinkles !== 'none') kinds.push(params.sprinkles);
    if (params.bed === 'fire' || params.bed === 'vinyl') kinds.push('crackle');
    if (params.bed === 'cave' && params.sprinkles !== 'drips') kinds.push('dripsLow');
    const sd = params.sprinkleDensity / 100;
    const rates = { birds: 0.9, drips: 1.2, dripsLow: 0.4, crickets: 2.2, stars: 2, bubbles: 1.6, thunder: 0.08, chimes: 0.35, crackle: 10 };
    const penta = [0, 2, 4, 7, 9].map((x) => mel.includes(x) ? x : mel[Math.min(mel.length - 1, Math.round(x / 12 * mel.length))]);
    for (const kind of kinds) {
      const rate = rates[kind] * (kind === 'crackle' ? (params.bedLevel / 100) + 0.3 : sd * 1.6 + 0.1);
      for (let bar = 0; bar < totalBars; bar++) {
        let count = 0; const lam = rate * beatsPerBar / 4;
        let p = Math.exp(-lam), f = p, u = r.next();
        while (u > f && count < 40) { count++; p *= lam / count; f += p; }
        for (let k = 0; k < count; k++) {
          const t = bar * beatsPerBar + r.next() * beatsPerBar;
          let n = 0, d = 0.5, extra = {};
          if (kind === 'stars') { n = 84 + keyPc + mel[r.int(0, ML - 1)] + 12 * r.int(0, 1); d = 2; }
          else if (kind === 'chimes') { n = 84 + keyPc + penta[r.int(0, 4)]; extra.c = r.int(3, 6); d = 3; }
          else if (kind === 'birds') { n = r.float(2200, 4200); extra.c = r.int(2, 6); extra.s = r.float(0.6, 1.6); }
          else if (kind === 'drips' || kind === 'dripsLow') { n = r.float(kind === 'drips' ? 900 : 500, kind === 'drips' ? 2200 : 1100); }
          else if (kind === 'crickets') { n = r.float(4200, 5200); extra.c = r.int(3, 8); }
          else if (kind === 'bubbles') { n = r.float(250, 700); extra.c = r.int(1, 5); }
          else if (kind === 'thunder') { d = 6; }
          else if (kind === 'crackle') { n = r.float(0.2, 1); d = 0.02; }
          tracks.ambience.push({ t, d, n, v: r.float(0.35, 1), k: kind, ...extra });
        }
      }
    }
    tracks.ambience.sort((a, b) => a.t - b.t);
  }

  // ── Groove: swing & humanize ──────────────────────────────────────────
  {
    const r = rng.fork('human-' + cycle);
    const sw = params.swing;
    const unit = st.swingUnit || 16;
    for (const [id, list] of Object.entries(tracks)) {
      if (id === 'ambience') continue;
      const hAmt = id === 'pad' ? 0.2 : id === 'drums' ? 0.6 : 1;
      for (const e of list) {
        const p16 = e.t * 4, rp = Math.round(p16);
        if (sw > 0 && Math.abs(p16 - rp) < 0.02) {
          if (unit === 16 && rp % 2 === 1) e.t += sw / 600;
          if (unit === 8 && rp % 4 === 2) e.t += sw / 300;
        }
        if (H > 0) {
          const onDown = Math.abs(e.t - Math.round(e.t)) < 0.01;
          e.t = Math.max(0, e.t + clamp(r.gauss() * H * 0.01 * hAmt * (onDown && id === 'drums' ? 0.3 : 1), -0.03, 0.03));
          e.v = clamp(e.v * (1 + r.gauss() * H * 0.09 * hAmt), 0.05, 1);
        }
      }
      list.sort((a, b) => a.t - b.t);
    }
  }

  return {
    params: structuredClone(params), cycle, seed: params.seed, style: params.style, styleName: st.name,
    mode: params.mode, loop: !oneshot,
    bpm, timeSig: ts.label, stepsPerBar: SPB, beatsPerBar, groups: ts.groups,
    keyPc, keyName: pcName(keyPc, flats), scaleId, scaleName: SCALES[scaleId].name,
    totalBars, totalBeats, duration: totalBeats * 60 / bpm,
    sections: sections.map((s) => ({ letter: s.letter, label: s.label, startBar: s.startBar, bars: s.bars, energy: s.energy, layers: [...s.layers] })),
    chords: chordList.map((c) => ({ t: c.t, d: c.d, symbol: c.symbol, deg: c.deg })),
    tracks,
  };
}
