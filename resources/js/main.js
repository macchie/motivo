// Motivo — UI controller.
import { STYLES, DEFAULT_PARAMS, applyStyle, LAYER_IDS, LAYER_NAMES, LAYER_COLORS } from './core/styles.js';
import { PRESETS, PRESET_GROUPS } from './core/presets.js';
import { generateSong } from './core/generator.js';
import { Player, renderAudio } from './core/engine.js';
import { encodeWAV, encodeMIDI } from './core/export.js';
import { SCALES, NOTE_NAMES, TIME_SIGS } from './core/theory.js';
import { KITS, BEDS, SPRINKLES, instrumentsFor } from './core/instruments.js';
import { randomSeed, RNG } from './core/rng.js';
import { icon } from './ui/icons.js';
import { initNative, saveFile, folderWriter, openTextFile, store } from './ui/native.js';
import { ArrangementView } from './ui/arrangement.js';
import { Visualizer } from './ui/visualizer.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmtTime = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), x = Math.floor(s % 60); return `${m}:${String(x).padStart(2, '0')}`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'track';

const state = { params: null, song: null, autoRegen: true, stale: false, library: [], recent: [], genMs: 0 };
const player = new Player();
let arrangement, viz;

// ── Parameter schema ─────────────────────────────────────────────────────
const LENGTHS = [8, 10, 12, 15, 20, 25, 30, 40, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360, 420, 480, 600];
const MODES = [['loop', 'Loop', 'repeat'], ['evolve', 'Evolving', 'infinity'], ['oneshot', 'One-shot', 'arrow']];
const pct = (v) => `${Math.round(v)}%`;
const barsFor = (p) => { const ts = TIME_SIGS[p.timeSig]; const bar = ts.steps / 4 * 60 / p.bpm; return Math.max(1, Math.round(p.length / bar)); };

const GROUPS = [
  { id: 'style', title: 'Genre & Harmony', icon: 'music', sum: (p) => STYLES[p.style].name, fields: [
    { key: 'style', label: 'Genre', type: 'select', kind: 'style', options: () => Object.entries(STYLES).map(([k, s]) => [k, s.name]),
      hint: (p) => STYLES[p.style].desc },
    { row: [
      { key: 'key', label: 'Key', type: 'select', kind: 'gen', options: () => [['auto', 'Auto'], ...NOTE_NAMES.map((n) => [n, n])] },
      { key: 'scale', label: 'Scale / Mode', type: 'select', kind: 'gen', options: () => [['auto', 'Auto (by mood)'], ...Object.entries(SCALES).map(([k, s]) => [k, s.name])] },
    ] },
    { key: 'timeSig', label: 'Meter', type: 'seg', kind: 'gen', options: () => Object.keys(TIME_SIGS).map((k) => [k, k]) },
    { key: 'harmRhythm', label: 'Chord changes', type: 'select', kind: 'gen',
      options: () => [['auto', 'Auto (genre)'], ['0.5', 'Every ½ bar'], ['1', 'Every bar'], ['2', 'Every 2 bars'], ['4', 'Every 4 bars']] },
  ] },
  { id: 'mood', title: 'Mood', icon: 'sliders', sum: (p) => `E${p.energy} T${p.tension} B${p.brightness}`, fields: [
    { key: 'energy', label: 'Energy', type: 'slider', kind: 'gen', min: 0, max: 100, ends: ['Calm', 'Intense'], hint: 'Drives rhythm density, drums and section intensity.' },
    { key: 'tension', label: 'Tension', type: 'slider', kind: 'gen', min: 0, max: 100, ends: ['Resolved', 'Unsettling'], hint: 'Darker modes, suspended & diminished harmony.' },
    { key: 'brightness', label: 'Brightness', type: 'slider', kind: 'gen', min: 0, max: 100, ends: ['Dark', 'Bright'], hint: 'Picks brighter scales and opens instrument filters.' },
    { key: 'density', label: 'Density', type: 'slider', kind: 'gen', min: 0, max: 100, ends: ['Sparse', 'Busy'] },
    { key: 'complexity', label: 'Complexity', type: 'slider', kind: 'gen', min: 0, max: 100, ends: ['Simple', 'Rich'], hint: 'Chord extensions, syncopation, melodic leaps.' },
  ] },
  { id: 'tempo', title: 'Tempo & Groove', icon: 'clock', sum: (p) => `${p.bpm} BPM`, fields: [
    { key: 'bpm', label: 'Tempo', type: 'slider', kind: 'gen', min: 40, max: 200, fmt: (v) => `${v} BPM`, track: '#4fd1c5' },
    { row: [
      { key: 'swing', label: 'Swing', type: 'slider', kind: 'gen', min: 0, max: 60, fmt: pct, track: '#4fd1c5' },
      { key: 'humanize', label: 'Humanize', type: 'slider', kind: 'gen', min: 0, max: 100, fmt: pct, track: '#4fd1c5' },
    ] },
  ] },
  { id: 'structure', title: 'Length & Looping', icon: 'repeat', sum: (p) => `${MODES.find((m) => m[0] === p.mode)[1]} · ${fmtTime(p.length)}`, fields: [
    { key: 'mode', label: 'Playback mode', type: 'seg', tall: true, kind: 'gen', options: () => MODES,
      hint: (p) => p.mode === 'loop' ? 'Seamless loop: no intro/outro, last chord leads back to the first. Exports wrap reverb tails so the file loops cleanly.'
        : p.mode === 'evolve' ? 'Infinite loop that keeps varying each cycle (melody, drums, arrangement) over the same harmony. Great for long exploration.'
          : 'Linear piece with intro, development and an ending — for stingers, cutscenes and jingles.' },
    { key: 'length', label: (p) => p.mode === 'evolve' ? 'Cycle length' : 'Length', type: 'steps', kind: 'gen', values: LENGTHS,
      fmt: (v, p) => `${fmtTime(v)} · ≈${barsFor(p)} bars` },
    { key: 'form', label: 'Form', type: 'select', kind: 'gen',
      options: () => [['auto', 'Auto'], ['A', 'A (single theme)'], ['AB', 'A B'], ['ABA', 'A B A'], ['AABA', 'A A B A'], ['ABAC', 'A B A C'], ['ABACABA', 'A B A C A B A (rondo)']] },
    { row: [
      { key: 'intro', label: 'Intro', type: 'seg', kind: 'gen', options: () => [[0, 'None'], [1, '1'], [2, '2'], [4, '4']], show: (p) => p.mode === 'oneshot' },
      { key: 'outro', label: 'Outro', type: 'seg', kind: 'gen', options: () => [[0, 'None'], [1, '1'], [2, '2'], [4, '4']], show: (p) => p.mode === 'oneshot' },
    ] },
    { key: 'variation', label: 'Variation', type: 'slider', kind: 'gen', min: 0, max: 100, ends: ['Repetitive', 'Ever-changing'],
      hint: 'How much repeated sections and loop cycles differ.' },
    { key: 'cycles', label: 'Cycles to export', type: 'slider', kind: 'mix', min: 2, max: 16, fmt: (v, p) => `${v} × ≈ ${fmtTime(v * (state.song?.duration || p.length))}`, show: (p) => p.mode === 'evolve' },
  ] },
  { id: 'melody', title: 'Melody', icon: 'wave', sum: (p) => ({ low: 'Low', mid: 'Mid', high: 'High' })[p.register] + ' register', fields: [
    { key: 'register', label: 'Register', type: 'seg', kind: 'gen', options: () => [['low', 'Low'], ['mid', 'Mid'], ['high', 'High']] },
    { key: 'melRange', label: 'Range', type: 'slider', kind: 'gen', min: 7, max: 24, fmt: (v) => `${v} semitones` },
    { key: 'repetition', label: 'Motif repetition', type: 'slider', kind: 'gen', min: 0, max: 100, ends: ['Free', 'Catchy'], hint: 'Higher values reuse the main motif — memorable, hummable themes.' },
    { row: [
      { key: 'rests', label: 'Rests', type: 'slider', kind: 'gen', min: 0, max: 100, fmt: pct },
      { key: 'ornaments', label: 'Ornaments', type: 'slider', kind: 'gen', min: 0, max: 100, fmt: pct },
    ] },
  ] },
  { id: 'ambience', title: 'Ambience', icon: 'drop', sum: (p) => BEDS[p.bed], fields: [
    { key: 'bed', label: 'Environment bed', type: 'select', kind: 'bed', options: () => Object.entries(BEDS) },
    { key: 'bedLevel', label: 'Bed level', type: 'slider', kind: 'mix', min: 0, max: 100, fmt: pct, track: '#7bc67e', show: (p) => p.bed !== 'none' },
    { key: 'sprinkles', label: 'Details', type: 'select', kind: 'gen', options: () => Object.entries(SPRINKLES), hint: 'Procedural one-shots scattered over the track: birds, drips, star twinkles…' },
    { key: 'sprinkleDensity', label: 'Detail density', type: 'slider', kind: 'gen', min: 0, max: 100, fmt: pct, track: '#7bc67e', show: (p) => p.sprinkles !== 'none' },
  ] },
  { id: 'fx', title: 'Effects & Master', icon: 'spectrum', sum: (p) => `Rev ${p.reverbMix}% · ${p.delay === 'off' ? 'no delay' : 'delay'}`, fields: [
    { row: [
      { key: 'reverbSize', label: 'Reverb size', type: 'slider', kind: 'mix', min: 0, max: 100, fmt: pct, track: '#8b7cf6' },
      { key: 'reverbMix', label: 'Reverb mix', type: 'slider', kind: 'mix', min: 0, max: 100, fmt: pct, track: '#8b7cf6' },
    ] },
    { key: 'delay', label: 'Delay', type: 'seg', kind: 'mix', options: () => [['off', 'Off'], ['16', '1/16'], ['8', '1/8'], ['d8', '1/8·'], ['4', '1/4']] },
    { row: [
      { key: 'delayFb', label: 'Feedback', type: 'slider', kind: 'mix', min: 0, max: 90, fmt: pct, track: '#8b7cf6', show: (p) => p.delay !== 'off' },
      { key: 'delayMix', label: 'Delay mix', type: 'slider', kind: 'mix', min: 0, max: 100, fmt: pct, track: '#8b7cf6', show: (p) => p.delay !== 'off' },
    ] },
    { row: [
      { key: 'warmth', label: 'Warmth', type: 'slider', kind: 'mix', min: 0, max: 100, fmt: pct },
      { key: 'lofi', label: 'Lo-fi / Tape', type: 'slider', kind: 'mix', min: 0, max: 100, fmt: pct },
    ] },
    { row: [
      { key: 'pump', label: 'Sidechain pump', type: 'slider', kind: 'mix', min: 0, max: 100, fmt: pct },
      { key: 'width', label: 'Stereo width', type: 'slider', kind: 'mix', min: 0, max: 100, fmt: pct },
    ] },
    { key: 'master', label: 'Master volume', type: 'slider', kind: 'mix', min: 0, max: 100, fmt: pct },
  ] },
];

function defaultFor(key, p) {
  const st = STYLES[p.style];
  if (key in st.fx) return st.fx[key];
  if (key in st.mood) return st.mood[key];
  if (key === 'bpm') return st.bpm;
  if (key === 'swing') return st.swing;
  return DEFAULT_PARAMS[key];
}

// ── Inspector ────────────────────────────────────────────────────────────
const controls = [];
function buildInspector() {
  const root = $('#inspector');
  const collapsed = new Set(JSON.parse(localStorage.getItem('motivo.collapsed') || '["melody","ambience"]'));
  for (const grp of GROUPS) {
    const g = h('div', 'grp' + (collapsed.has(grp.id) ? ' closed' : ''));
    const head = h('div', 'grp-h', `<span class="gi">${icon(grp.icon, 14)}</span><span>${grp.title}</span><span class="gs"></span><span class="chev">${icon('chevron', 14)}</span>`);
    head.onclick = () => {
      g.classList.toggle('closed');
      if (g.classList.contains('closed')) collapsed.add(grp.id); else collapsed.delete(grp.id);
      localStorage.setItem('motivo.collapsed', JSON.stringify([...collapsed]));
    };
    const body = h('div', 'grp-b');
    g.append(head, body);
    grp._sum = head.querySelector('.gs');
    for (const f of grp.fields) {
      if (f.row) { const row = h('div', 'two'); f.row.forEach((ff) => row.append(buildField(ff))); body.append(row); }
      else body.append(buildField(f));
    }
    root.append(g);
  }
}

function buildField(f) {
  const wrap = h('div', 'field');
  const label = typeof f.label === 'function' ? '' : f.label;
  const top = h('div', 'field-row', `<label>${esc(label)}</label><span class="val"></span>`);
  wrap.append(top);
  const valEl = top.querySelector('.val'), labEl = top.querySelector('label');
  const c = { f, wrap, valEl, labEl };
  if (f.type === 'slider' || f.type === 'steps') {
    const inp = h('input'); inp.type = 'range';
    if (f.type === 'steps') { inp.min = 0; inp.max = f.values.length - 1; inp.step = 1; }
    else { inp.min = f.min; inp.max = f.max; inp.step = f.step || 1; }
    if (f.track) inp.style.setProperty('--track', f.track);
    inp.oninput = () => {
      const v = f.type === 'steps' ? f.values[+inp.value] : +inp.value;
      setParam(f.key, v, f.kind);
    };
    inp.ondblclick = () => { if (f.type === 'slider') setParam(f.key, defaultFor(f.key, state.params), f.kind); };
    inp.title = 'Double-click to reset';
    wrap.append(inp);
    c.input = inp;
    if (f.ends) wrap.append(h('div', 'ends', `<span>${f.ends[0]}</span><span>${f.ends[1]}</span>`));
  } else if (f.type === 'select') {
    const sel = h('select', 'select');
    for (const [v, l] of f.options()) { const o = h('option'); o.value = v; o.textContent = l; sel.append(o); }
    sel.onchange = () => setParam(f.key, sel.value, f.kind);
    wrap.append(sel); c.input = sel;
    valEl.remove();
  } else if (f.type === 'seg') {
    const seg = h('div', 'seg' + (f.tall ? ' tall' : ''));
    for (const [v, l, ic] of f.options()) {
      const b = h('button', '', (ic ? icon(ic, 14) : '') + `<span>${l}</span>`);
      b.dataset.v = v;
      b.onclick = () => setParam(f.key, typeof v === 'number' ? v : v, f.kind);
      seg.append(b);
    }
    wrap.append(seg); c.seg = seg;
    valEl.remove();
  }
  if (f.hint) { c.hintEl = h('div', 'hint'); wrap.append(c.hintEl); }
  controls.push(c);
  return wrap;
}

function syncInspector() {
  const p = state.params;
  for (const c of controls) {
    const f = c.f, v = p[f.key];
    if (typeof f.label === 'function') c.labEl.textContent = f.label(p);
    if (c.input && f.type === 'slider') {
      if (document.activeElement !== c.input) c.input.value = v;
      c.input.style.setProperty('--fill', ((v - f.min) / (f.max - f.min) * 100) + '%');
    } else if (c.input && f.type === 'steps') {
      let idx = f.values.indexOf(v); if (idx < 0) idx = f.values.reduce((bi, x, i) => Math.abs(x - v) < Math.abs(f.values[bi] - v) ? i : bi, 0);
      if (document.activeElement !== c.input) c.input.value = idx;
      c.input.style.setProperty('--fill', (idx / (f.values.length - 1) * 100) + '%');
    } else if (c.input) c.input.value = v;
    if (c.seg) c.seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(b.dataset.v) === String(v)));
    if (c.valEl.isConnected) {
      c.valEl.textContent = f.fmt ? f.fmt(v, p) : String(v);
      const d = f.type === 'slider' ? defaultFor(f.key, p) : undefined;
      c.valEl.classList.toggle('mod', d !== undefined && d !== v);
    }
    if (c.hintEl) c.hintEl.textContent = typeof f.hint === 'function' ? f.hint(p) : f.hint;
    c.wrap.classList.toggle('hidden', !!(f.show && !f.show(p)));
  }
  for (const grp of GROUPS) grp._sum.textContent = grp.sum(p);
}

// ── Mixer ────────────────────────────────────────────────────────────────
const strips = {};
function buildMixer() {
  const root = $('#mixer');
  for (const id of LAYER_IDS) {
    const s = h('div', 'strip');
    s.style.setProperty('--c', LAYER_COLORS[id]);
    s.innerHTML = `
      <div class="strip-h"><div class="strip-name"><i></i>${LAYER_NAMES[id]}</div></div>
      <select class="select"></select>
      <div><div class="mini-l"><span>VOL</span><b class="vv"></b></div><input type="range" class="vol" min="0" max="1" step="0.01"></div>
      <div><div class="mini-l"><span>PAN</span><b class="pv"></b></div><input type="range" class="pan" min="-1" max="1" step="0.05" style="--track:#4fd1c5"></div>
      <div class="strip-f"><div class="meter"><i></i></div><div class="ms"><button class="m" title="Mute">M</button><button class="s" title="Solo">S</button></div></div>`;
    const sel = s.querySelector('select');
    let opts;
    if (id === 'drums') opts = Object.entries(KITS).map(([k, v]) => [k, v.name]);
    else if (id === 'ambience') opts = Object.entries(BEDS);
    else opts = instrumentsFor(id).map(([k, v]) => [k, v.name]);
    for (const [v, l] of opts) { const o = h('option'); o.value = v; o.textContent = l; sel.append(o); }
    sel.onchange = () => {
      if (id === 'ambience') setParam('bed', sel.value, 'bed');
      else setLayer(id, 'inst', sel.value);
    };
    s.querySelector('.m').onclick = () => setLayer(id, 'mute', !state.params.layers[id].mute);
    s.querySelector('.s').onclick = () => setLayer(id, 'solo', !state.params.layers[id].solo);
    const vol = s.querySelector('.vol'), pan = s.querySelector('.pan');
    vol.oninput = () => setLayer(id, 'vol', +vol.value);
    vol.ondblclick = () => setLayer(id, 'vol', STYLES[state.params.style].layers[id].vol);
    pan.oninput = () => setLayer(id, 'pan', +pan.value);
    pan.ondblclick = () => setLayer(id, 'pan', 0);
    root.append(s);
    strips[id] = { s, sel, vol, pan, meter: s.querySelector('.meter i'), vv: s.querySelector('.vv'), pv: s.querySelector('.pv'), m: s.querySelector('.m'), so: s.querySelector('.s') };
  }
  const m = h('div', 'strip');
  m.style.setProperty('--c', '#f2b544');
  m.innerHTML = `
    <div class="strip-h"><div class="strip-name"><i></i>Master</div></div>
    <div class="peak-box" title="Output peak level (dBFS)"><span>PEAK dB</span><b class="peak">-∞</b></div>
    <div><div class="mini-l"><span>VOL</span><b class="vv"></b></div><input type="range" class="vol" min="0" max="100" step="1"></div>
    <div><div class="mini-l"><span>WIDTH</span><b class="pv"></b></div><input type="range" class="pan" min="0" max="100" step="1" style="--track:#4fd1c5"></div>
    <div class="strip-f"><div class="meter"><i></i></div></div>`;
  const mv = m.querySelector('.vol'), mw = m.querySelector('.pan');
  mv.oninput = () => setParam('master', +mv.value, 'mix');
  mw.oninput = () => setParam('width', +mw.value, 'mix');
  $('#mixer').append(m);
  strips.master = { vol: mv, pan: mw, meter: m.querySelector('.meter i'), vv: m.querySelector('.vv'), pv: m.querySelector('.pv'), peak: m.querySelector('.peak') };
}

function syncMixer() {
  const p = state.params;
  const anySolo = LAYER_IDS.some((id) => p.layers[id].solo);
  for (const id of LAYER_IDS) {
    const L = p.layers[id], S = strips[id];
    S.sel.value = id === 'ambience' ? p.bed : L.inst;
    S.vol.value = L.vol; S.vol.style.setProperty('--fill', (L.vol * 100) + '%');
    S.pan.value = L.pan; S.pan.style.setProperty('--fill', ((L.pan + 1) / 2 * 100) + '%');
    S.vv.textContent = Math.round(L.vol * 100);
    S.pv.textContent = Math.abs(L.pan) < 0.03 ? 'C' : (L.pan < 0 ? 'L' : 'R') + Math.round(Math.abs(L.pan) * 100);
    S.m.classList.toggle('on', !!L.mute); S.so.classList.toggle('on', !!L.solo);
    S.s.classList.toggle('muted', !!L.mute || (anySolo && !L.solo));
  }
  const M = strips.master;
  M.vol.value = p.master; M.vol.style.setProperty('--fill', p.master + '%'); M.vv.textContent = p.master;
  M.pan.value = p.width; M.pan.style.setProperty('--fill', p.width + '%'); M.pv.textContent = p.width + '%';
}

function setLayer(id, key, value) {
  state.params.layers[id][key] = value;
  player.setParams(state.params);
  syncMixer();
  if (key === 'mute' || key === 'solo') arrangement.draw();
  saveSession();
}

// ── Param changes / generation ───────────────────────────────────────────
const regenSoon = debounce(() => regenerate(), 220);
function setParam(key, value, kind) {
  const p = state.params;
  if (kind === 'style') {
    state.params = applyStyle(p, value, { keepMood: true });
    state.params.preset = null;
    state.params.scale = 'auto'; state.params.harmRhythm = 'auto';
    player.setParams(state.params);
    syncAll();
    if (state.autoRegen) regenerate(); else markStale();
    saveSession();
    return;
  }
  p[key] = value;
  if (key === 'master' || key === 'width') syncMixer();
  if (kind === 'mix') { player.setParams(p); }
  else if (kind === 'bed') {
    player.setParams(p);
    if (player.playing) player.synth.startBed(value, player.ctx.currentTime + 0.05, { fadeIn: 1 });
    if (state.autoRegen) regenSoon(); else markStale();
  } else {
    if (state.autoRegen) regenSoon(); else markStale();
  }
  syncInspector(); syncMixer();
  saveSession();
}

function markStale() {
  state.stale = true;
  const b = $('#btnGenerate'); b.classList.add('stale'); b.innerHTML = icon('check', 15) + 'Apply';
}
function clearStale() {
  state.stale = false;
  const b = $('#btnGenerate'); b.classList.remove('stale'); b.innerHTML = icon('sparkles', 15) + 'Generate';
}

function regenerate({ newSeed = false, record = false } = {}) {
  const p = state.params;
  if (newSeed) p.seed = randomSeed();
  const t0 = performance.now();
  let song;
  try { song = generateSong(p); } catch (e) { console.error(e); toast('Generation failed: ' + e.message, true); return; }
  state.genMs = performance.now() - t0;
  state.song = song;
  player.setParams(p);
  player.setSong(song);
  arrangement.setSong(song, p);
  clearStale();
  updateHero(); syncInspector();
  $('#seedInput').value = p.seed;
  const notes = Object.values(song.tracks).reduce((s, l) => s + l.length, 0);
  status(`Generated ${song.totalBars} bars · ${notes.toLocaleString()} events in ${state.genMs.toFixed(0)} ms`);
  if (record) pushRecent();
}

function updateHero() {
  const p = state.params, s = state.song;
  const pr = PRESETS.find((x) => x.id === p.preset);
  $('#heroKicker').textContent = pr ? `Theme · ${pr.group}` : `Custom · ${STYLES[p.style].name}`;
  $('#heroTitle').textContent = p.name;
  $('#heroDesc').textContent = pr ? `${pr.desc} Use for: ${pr.use}.` : STYLES[p.style].desc;
  const hero = $('.hero');
  hero.style.setProperty('--hero-tint', pr ? pr.colors[0] + '40' : 'rgba(242,181,68,.10)');
  if (pr) viz.setTint([pr.colors[0], '#8b7cf6', '#f2b544']); else viz.setTint(['#4fd1c5', '#8b7cf6', '#f2b544']);
  if (!s) return;
  const stats = [
    ['Genre', STYLES[p.style].name.split(' ')[0]], ['Key', `${s.keyName} ${s.scaleName.replace('Natural ', '').replace('Pentatonic', 'Pent.').replace('Harmonic', 'Harm.').replace('Phrygian Dominant', 'Phryg. Dom.')}`],
    ['Tempo', `${s.bpm} BPM`], ['Meter', s.timeSig],
    ['Form', s.sections.length > 6 ? s.sections.map((x) => x.letter).join('') : s.sections.map((x) => x.letter === 'I' ? 'In' : x.letter === 'O' ? 'Out' : x.letter).join('·')], ['Bars', s.totalBars],
    ['Length', fmtTime(s.duration)], ['Mode', MODES.find((m) => m[0] === s.mode)[1]],
  ];
  $('#stats').innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('');
  $('#tLen').textContent = fmtTime(s.duration);
  const rep = $('#btnRepeat');
  rep.classList.toggle('on', s.loop || player.repeat);
  rep.disabled = s.loop;
  rep.title = s.loop ? 'Loop modes always repeat' : 'Repeat one-shot preview';
}

function syncAll() {
  syncInspector(); syncMixer(); renderPresets();
  $('#trackName').value = state.params.name;
  $('#seedInput').value = state.params.seed;
}

// ── Presets ──────────────────────────────────────────────────────────────
function presetParams(pr) {
  const base = structuredClone(DEFAULT_PARAMS);
  base.master = state.params ? state.params.master : DEFAULT_PARAMS.master;
  let p = applyStyle(base, pr.params.style, { keepMood: false });
  const { layers, ...rest } = pr.params;
  Object.assign(p, rest);
  if (layers) for (const [id, v] of Object.entries(layers)) Object.assign(p.layers[id], v);
  p.name = pr.name; p.preset = pr.id; p.seed = randomSeed();
  return p;
}
function applyPreset(pr, { play = false } = {}) {
  state.params = presetParams(pr);
  player.setParams(state.params);
  syncAll();
  regenerate({ record: true });
  if (play) player.play();
  saveSession();
}
function renderPresets() {
  const q = ($('#presetSearch').value || '').toLowerCase().trim();
  const root = $('#presetList');
  root.innerHTML = '';
  for (const grp of PRESET_GROUPS) {
    const items = PRESETS.filter((p) => p.group === grp && (!q || (p.name + ' ' + p.desc + ' ' + p.use + ' ' + STYLES[p.params.style].name).toLowerCase().includes(q)));
    if (!items.length) continue;
    root.append(h('div', 'group-h', grp));
    for (const pr of items) {
      const el = h('div', 'preset' + (state.params?.preset === pr.id ? ' active' : ''));
      el.innerHTML = `<div class="ico" style="background:linear-gradient(135deg,${pr.colors[0]},${pr.colors[1]})">${icon(pr.icon, 19)}</div>
        <div style="min-width:0"><div class="name">${esc(pr.name)}</div><div class="meta">${esc(STYLES[pr.params.style].name)} · ${esc(pr.use)}</div></div>`;
      el.title = pr.desc + '\nDouble-click to generate and play.';
      el.onclick = () => applyPreset(pr);
      el.ondblclick = () => player.play();
      root.append(el);
    }
  }
  if (!root.children.length) root.append(h('div', 'empty', 'No themes match your search.'));
}

// ── Library ──────────────────────────────────────────────────────────────
function summary(p, s) { return `${STYLES[p.style].name} · ${s ? s.keyName + ' ' + s.scaleName : ''} · ${p.bpm} BPM`; }
function pushRecent() {
  const p = state.params, s = state.song;
  state.recent = state.recent.filter((r) => r.params.seed !== p.seed);
  state.recent.unshift({ id: Date.now(), name: p.name, params: structuredClone(p), sum: summary(p, s), at: Date.now() });
  state.recent = state.recent.slice(0, 15);
  store.set('recent', state.recent); renderLibrary();
}
async function saveToLibrary() {
  const p = state.params;
  state.library.unshift({ id: Date.now(), name: p.name, params: structuredClone(p), sum: summary(p, state.song), at: Date.now() });
  await store.set('library', state.library);
  renderLibrary();
  toast(`Saved “${p.name}” to your library`);
}
function loadEntry(e) {
  state.params = normalizeParams(structuredClone(e.params));
  player.setParams(state.params);
  syncAll(); regenerate(); saveSession();
}
function renderLibrary() {
  $('#libCount').textContent = state.library.length;
  const mk = (list, root, deletable) => {
    root.innerHTML = '';
    if (!list.length) { root.append(h('div', 'empty', deletable ? 'Nothing saved yet. Press <kbd>Ctrl</kbd>+<kbd>S</kbd> to keep the current track — seed and all parameters.' : 'Your generated variations will appear here.')); return; }
    for (const e of list) {
      const pr = PRESETS.find((x) => x.id === e.params.preset);
      const it = h('div', 'lib-item');
      it.innerHTML = `<span class="sw" style="background:${pr ? pr.colors[0] : LAYER_COLORS.lead}"></span>
        <div style="min-width:0"><div class="nm">${esc(e.name)}</div><div class="mt">${esc(e.params.seed)} · ${esc(e.sum)}</div></div>
        ${deletable ? `<button class="del" title="Delete">${icon('trash', 14)}</button>` : `<span class="mt">${new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`}`;
      it.onclick = (ev) => {
        if (ev.target.closest('.del')) {
          state.library = state.library.filter((x) => x.id !== e.id); store.set('library', state.library); renderLibrary(); return;
        }
        loadEntry(e);
      };
      root.append(it);
    }
  };
  mk(state.library, $('#libSaved'), true);
  mk(state.recent, $('#libRecent'), false);
}

function normalizeParams(p) {
  if (!p || !STYLES[p.style]) return null;
  const base = applyStyle(structuredClone(DEFAULT_PARAMS), p.style, { keepMood: false });
  const out = { ...base, ...p, layers: base.layers };
  for (const id of LAYER_IDS) Object.assign(out.layers[id], (p.layers || {})[id] || {});
  return out;
}

// ── Export ───────────────────────────────────────────────────────────────
const ex = { format: 'wav', sr: 44100, bits: 16, normalize: true, loopPts: true, busy: false };
const FORMATS = [
  ['wav', 'download', 'WAV audio', 'Full mix, engine-ready'],
  ['stems', 'layers', 'Stems', 'One WAV per layer — adaptive music'],
  ['midi', 'music', 'MIDI', 'Notes per layer for your DAW'],
  ['project', 'file', 'Project', 'Seed + parameters (.json)'],
];
function baseName() {
  const p = state.params, s = state.song;
  return `${slug(p.name)}_${s.bpm}bpm_${s.keyName.replace('♯', 's').replace('♭', 'b')}${s.scaleId === 'major' ? '' : '_' + slug(s.scaleName)}${s.loop ? '_loop' : ''}`;
}
function openExport() {
  if (!state.song) return;
  ex.name = baseName();
  $('#exportModal').classList.add('open');
  renderExport();
}
function closeExport() { if (!ex.busy) $('#exportModal').classList.remove('open'); }
function renderExport() {
  const s = state.song, p = state.params;
  const audio = ex.format === 'wav' || ex.format === 'stems';
  const dur = s.mode === 'evolve' ? s.duration * p.cycles : s.duration;
  $('#exSub').textContent = `${p.name} · ${s.keyName} ${s.scaleName} · ${s.bpm} BPM · ${fmtTime(dur)}`;
  $('#exFormats').innerHTML = FORMATS.map(([k, ic, t, d]) => `<div class="fmt ${ex.format === k ? 'on' : ''}" data-k="${k}"><div class="fi">${icon(ic, 17)}</div><div><div class="ft">${t}</div><div class="fd">${d}</div></div></div>`).join('');
  $('#exFormats').querySelectorAll('.fmt').forEach((el) => el.onclick = () => { ex.format = el.dataset.k; renderExport(); });
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button class="${String(ex[key]) === String(v) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  let html = '';
  if (ex.format !== 'stems') {
    const ext = { wav: '.wav', midi: '.mid', project: '.motivo.json' }[ex.format];
    html += `<div class="full"><div class="lbl">File name</div><input type="text" id="exName" value="${esc(ex.name)}" spellcheck="false"><div class="hint" style="font-size:11px;color:var(--text-3);margin-top:4px">${ext}</div></div>`;
  } else html += `<div class="full"><div class="lbl">Stem prefix</div><input type="text" id="exName" value="${esc(ex.name)}" spellcheck="false"></div>`;
  if (audio) {
    html += `<div><div class="lbl">Sample rate</div>${seg('sr', [[44100, '44.1 kHz'], [48000, '48 kHz']])}</div>`;
    html += `<div><div class="lbl">Bit depth</div>${seg('bits', [[16, '16-bit'], [24, '24-bit']])}</div>`;
    html += `<label class="chk"><span class="switch"><input type="checkbox" id="exNorm" ${ex.normalize ? 'checked' : ''}><i></i></span>Normalize to −1 dBFS</label>`;
    if (s.loop) html += `<label class="chk"><span class="switch"><input type="checkbox" id="exLoop" ${ex.loopPts ? 'checked' : ''}><i></i></span>Embed loop points</label>`;
  }
  if (s.mode === 'evolve' && ex.format !== 'project') {
    html += `<div class="full"><div class="lbl">Evolving cycles to render: <b style="font-family:var(--mono)">${p.cycles}</b> (${fmtTime(s.duration * p.cycles)})</div><input type="range" id="exCycles" min="2" max="16" value="${p.cycles}" style="--fill:${(p.cycles - 2) / 14 * 100}%"></div>`;
  }
  $('#exOpts').innerHTML = html;
  $('#exOpts').querySelectorAll('.seg').forEach((sg) => sg.querySelectorAll('button').forEach((b) => b.onclick = () => { ex[sg.dataset.key] = +b.dataset.v; renderExport(); }));
  const nm = $('#exName'); if (nm) nm.oninput = () => { ex.name = nm.value; };
  const nrm = $('#exNorm'); if (nrm) nrm.onchange = () => { ex.normalize = nrm.checked; };
  const lp = $('#exLoop'); if (lp) lp.onchange = () => { ex.loopPts = lp.checked; };
  const cy = $('#exCycles'); if (cy) cy.oninput = () => { p.cycles = +cy.value; syncInspector(); renderExport(); };
  let note;
  if (ex.format === 'midi') note = 'Type-1 MIDI with tempo, meter, section markers and one track per unmuted layer (drums on channel 10, GM mapping).';
  else if (ex.format === 'project') note = 'Saves the seed and every parameter. Re-importing regenerates the exact same track.';
  else if (s.mode === 'loop') note = 'Seamless loop: the render is pre-rolled one full cycle so reverb and delay tails wrap into the start. The file loops sample-accurately with no gap or click.';
  else if (s.mode === 'evolve') note = `Evolving: ${p.cycles} varied cycles rendered as one long seamless loop. Loop the whole file in-engine for hours of non-repetitive music.`;
  else note = 'One-shot: includes the natural reverb tail; trailing silence is trimmed.';
  if (ex.format === 'stems') note += ' Stems are not normalized individually, so they stay balanced when layered.';
  $('#exNote').innerHTML = icon('info', 15) + `<span>${note}</span>`;
}
async function doExport() {
  if (ex.busy) return;
  const p = state.params;
  const song = state.song.mode === 'evolve' ? generateSong(p, { cycle: 0 }) : state.song;
  const name = slug(ex.name || baseName()).slice(0, 80) || 'track';
  const prog = $('#exProgress'), bar = prog.querySelector('i'), lab = prog.querySelector('span');
  const setProg = (v, txt) => { bar.style.width = (v * 100) + '%'; if (txt) lab.textContent = txt; };
  ex.busy = true; $('#exGo').disabled = true; $('#exCancel').disabled = true;
  try {
    if (ex.format === 'project') {
      const path = await saveFile(name + '.motivo.json', JSON.stringify({ app: 'motivo', version: 1, params: p }, null, 2), [{ name: 'Motivo project', extensions: ['json'] }]);
      if (path) toast('Project saved · ' + path);
    } else if (ex.format === 'midi') {
      const songs = song.mode === 'evolve' ? Array.from({ length: p.cycles }, (_, i) => generateSong(p, { cycle: i })) : [song];
      const path = await saveFile(name + '.mid', encodeMIDI(song, p, songs), [{ name: 'MIDI', extensions: ['mid'] }]);
      if (path) toast('MIDI saved · ' + path);
    } else if (ex.format === 'wav') {
      prog.classList.remove('hidden'); setProg(0.02, 'Rendering audio…');
      const res = await renderAudio(p, song, { sampleRate: ex.sr, cycles: p.cycles, normalize: ex.normalize, onProgress: (v) => setProg(v * 0.9) });
      setProg(0.95, 'Encoding WAV…');
      const wav = encodeWAV(res, { bits: ex.bits, loop: res.loop && ex.loopPts, title: p.name });
      setProg(1, 'Saving…');
      const path = await saveFile(name + '.wav', wav, [{ name: 'WAV audio', extensions: ['wav'] }]);
      if (path) toast(`Exported ${fmtTime(res.duration)} WAV · ${path}`);
    } else if (ex.format === 'stems') {
      const writer = await folderWriter();
      if (writer) {
        prog.classList.remove('hidden');
        const anySolo = LAYER_IDS.some((id) => p.layers[id].solo);
        const layers = LAYER_IDS.filter((id) => !p.layers[id].mute && (!anySolo || p.layers[id].solo) && (song.tracks[id].length || (id === 'ambience' && p.bed !== 'none')));
        for (let i = 0; i < layers.length; i++) {
          const id = layers[i];
          setProg(i / layers.length, `Rendering stem ${i + 1}/${layers.length} · ${LAYER_NAMES[id]}`);
          const res = await renderAudio(p, song, { sampleRate: ex.sr, cycles: p.cycles, normalize: false, soloLayer: id, onProgress: (v) => setProg((i + v) / layers.length) });
          await writer.write(`${name}_${id}.wav`, encodeWAV(res, { bits: ex.bits, loop: res.loop && ex.loopPts, title: `${p.name} – ${LAYER_NAMES[id]}` }));
        }
        setProg(1, 'Done');
        toast(`Exported ${layers.length} stems → ${writer.label}`);
      }
    }
    ex.busy = false; closeExport();
  } catch (e) {
    console.error(e); toast('Export failed: ' + (e.message || e), true);
  } finally {
    ex.busy = false; $('#exGo').disabled = false; $('#exCancel').disabled = false;
    setTimeout(() => { prog.classList.add('hidden'); setProg(0); }, 300);
  }
}

// ── Misc UI ──────────────────────────────────────────────────────────────
function toast(msg, err = false) {
  const t = h('div', 'toast' + (err ? ' err' : ''));
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, err ? 6000 : 3800);
}
function status(msg) { $('#statusText').textContent = msg; }
const saveSession = debounce(() => store.set('session', state.params), 500);

function randomizeMood() {
  const p = state.params, st = STYLES[p.style];
  const r = new RNG(Date.now() + ':' + Math.random());
  for (const k of ['energy', 'tension', 'brightness', 'density', 'complexity']) p[k] = Math.round(Math.max(0, Math.min(100, st.mood[k] + r.float(-30, 30))));
  p.variation = r.int(20, 80); p.repetition = r.int(35, 85);
  p.bpm = r.int(st.bpmRange[0], st.bpmRange[1]);
  p.key = 'auto'; p.scale = 'auto'; p.harmRhythm = 'auto';
  p.preset = null;
  syncAll();
  regenerate({ newSeed: true, record: true });
  saveSession();
}

let lastUi = {};
function frame() {
  const s = state.song;
  if (s) {
    const beat = player.position();
    arrangement.drawHead(beat);
    const sec = beat * 60 / s.bpm;
    const bar = Math.floor(beat / s.beatsPerBar), inBar = beat - bar * s.beatsPerBar;
    const pos = fmtTime(sec), bb = `Bar ${bar + 1}.${Math.floor(inBar) + 1}`;
    if (lastUi.pos !== pos) { $('#tPos').textContent = pos; lastUi.pos = pos; }
    if (lastUi.bb !== bb) { $('#tBar').textContent = bb; lastUi.bb = bb; }
    const cyc = s.mode === 'evolve' ? `Cycle ${player.cycle + 1}` : '';
    if (lastUi.cyc !== cyc) { $('#tCycle').textContent = cyc; lastUi.cyc = cyc; }
    let ci = 0; for (let i = 0; i < s.chords.length; i++) if (s.chords[i].t <= beat + 1e-6) ci = i;
    const c = s.chords[ci], n = s.chords[ci + 1] || (s.loop ? s.chords[0] : null);
    const secObj = s.sections.find((x) => bar >= x.startBar && bar < x.startBar + x.bars) || s.sections[0];
    const chordTxt = c ? c.symbol : '—', nextTxt = n ? n.symbol : '—';
    const secTxt = `${secObj.letter === 'I' || secObj.letter === 'O' ? secObj.label : 'Section ' + secObj.letter} · ${s.keyName} ${s.scaleName}`;
    if (lastUi.chord !== chordTxt) { $('#nowChord').textContent = chordTxt; lastUi.chord = chordTxt; }
    if (lastUi.next !== nextTxt) { $('#nextChord').textContent = nextTxt; lastUi.next = nextTxt; }
    if (lastUi.sec !== secTxt) { $('#nowSection').textContent = secTxt; lastUi.sec = secTxt; }
  }
  const live = player.playing;
  viz.draw(player.synth?.analyser, live);
  const m = player.meters();
  for (const id of LAYER_IDS) strips[id].meter.style.width = m ? Math.min(100, Math.sqrt(m[id]) * 190) + '%' : '0%';
  if (player.synth && live) {
    const a = player.synth.analyser, buf = lastUi.mbuf || (lastUi.mbuf = new Float32Array(a.fftSize));
    a.getFloatTimeDomainData(buf);
    let pk = 0, ss = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > pk) pk = v; ss += v * v; }
    strips.master.meter.style.width = Math.min(100, Math.sqrt(Math.sqrt(ss / buf.length)) * 150) + '%';
    lastUi.peak = Math.max(pk, (lastUi.peak || 0) * 0.97);
    const db = 20 * Math.log10(lastUi.peak + 1e-9);
    strips.master.peak.textContent = db < -60 ? '-∞' : db.toFixed(1);
  } else strips.master.meter.style.width = '0%';
  requestAnimationFrame(frame);
}

function setPlayState(on) {
  const b = $('#btnPlay');
  b.classList.toggle('playing', on);
  b.innerHTML = icon(on ? 'pause' : 'play', 18);
  $('.viz').classList.toggle('live', on);
  $('#audioDot').classList.toggle('live', on);
  if (on) status(`Playing · ${player.ctx.sampleRate / 1000} kHz`);
}

// ── Boot ─────────────────────────────────────────────────────────────────
async function boot() {
  await initNative();
  // static icons
  $('#btnBack').innerHTML = icon('back', 15);
  $('#btnStop').innerHTML = icon('stop', 14);
  $('#btnRepeat').innerHTML = icon('repeat', 15);
  $('#btnDice').innerHTML = icon('dice', 16);
  $('#btnSave').innerHTML = icon('bookmark', 15);
  $('#btnExport').innerHTML = icon('download', 15) + 'Export';
  $('#searchIc').innerHTML = icon('search', 14);
  $('#btnImport').innerHTML = icon('upload', 13) + 'Import';
  $('#btnExportLib').innerHTML = icon('download', 13) + 'Backup';
  $('#arrIc').innerHTML = icon('layers', 13);
  $('#mixIc').innerHTML = icon('mixer', 13);
  $('#inspIc').innerHTML = icon('sliders', 15);
  $('#btnRandomize').innerHTML = icon('wand', 14);
  $('#btnResetStyle').innerHTML = icon('reset', 14);
  $('#exClose').innerHTML = icon('x', 16);
  $('#btnPlay').innerHTML = icon('play', 18);
  clearStale();
  $('#arrLegend').innerHTML = [['A', '#f2b544'], ['B', '#4fd1c5'], ['C', '#a58bff']].map(([l, c]) => `<span><i style="background:${c}"></i>Section ${l}</span>`).join('');

  viz = new Visualizer($('#vizCanvas'));
  arrangement = new ArrangementView($('#arrWrap'), $('#arrCanvas'), $('#arrHead'), { onSeek: (b) => player.seek(b) });
  buildInspector(); buildMixer();

  state.library = (await store.get('library', [])) || [];
  state.recent = (await store.get('recent', [])) || [];
  const saved = normalizeParams(await store.get('session', null));
  if (saved) { state.params = saved; syncAll(); regenerate(); }
  else applyPreset(PRESETS.find((x) => x.id === 'forest'));
  renderLibrary();

  // events
  player.on('state', setPlayState);
  player.on('ended', () => status('Finished'));
  player.on('cycle', (n, song) => { state.song = song; arrangement.setSong(song, state.params); status(`Evolving · cycle ${n + 1}`); });
  $('#btnPlay').onclick = () => player.toggle();
  $('#btnStop').onclick = () => player.stop();
  $('#btnBack').onclick = () => player.seek(0);
  $('#btnRepeat').onclick = () => { player.repeat = !player.repeat; updateHero(); };
  $('#btnGenerate').onclick = () => { if (state.stale) regenerate({ record: true }); else { $('#btnDice').classList.remove('spin'); void $('#btnDice').offsetWidth; $('#btnDice').classList.add('spin'); regenerate({ newSeed: true, record: true }); } };
  $('#btnDice').onclick = () => $('#btnGenerate').onclick();
  $('#seedInput').onkeydown = (e) => { if (e.key === 'Enter') { state.params.seed = e.target.value.trim() || randomSeed(); regenerate({ record: true }); saveSession(); e.target.blur(); } };
  $('#seedInput').onblur = (e) => { if (e.target.value.trim() && e.target.value.trim() !== state.params.seed) { state.params.seed = e.target.value.trim(); regenerate({ record: true }); saveSession(); } };
  $('#trackName').oninput = (e) => { state.params.name = e.target.value || 'Untitled Track'; $('#heroTitle').textContent = state.params.name; saveSession(); };
  $('#trackName').onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
  $('#btnSave').onclick = saveToLibrary;
  $('#btnExport').onclick = openExport;
  $('#exClose').onclick = closeExport; $('#exCancel').onclick = closeExport; $('#exGo').onclick = doExport;
  $('#exportModal').onclick = (e) => { if (e.target.id === 'exportModal') closeExport(); };
  $('#btnRandomize').onclick = randomizeMood;
  $('#btnResetStyle').onclick = () => { const pr = PRESETS.find((x) => x.id === state.params.preset); if (pr) applyPreset(pr); else { state.params = applyStyle(state.params, state.params.style, { keepMood: false }); syncAll(); regenerate(); } toast('Reset to defaults'); };
  $('#autoRegen').onchange = (e) => { state.autoRegen = e.target.checked; if (state.autoRegen && state.stale) regenerate(); };
  $('#presetSearch').oninput = renderPresets;
  document.querySelectorAll('.tab').forEach((t) => t.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $('#pane-themes').classList.toggle('hidden', t.dataset.tab !== 'themes');
    $('#pane-library').classList.toggle('hidden', t.dataset.tab !== 'library');
  });
  $('#btnImport').onclick = async () => {
    try {
      const txt = await openTextFile([{ name: 'Motivo project', extensions: ['json'] }]);
      if (!txt) return;
      const data = JSON.parse(txt);
      if (Array.isArray(data)) { state.library = data.concat(state.library); await store.set('library', state.library); renderLibrary(); toast(`Imported ${data.length} tracks`); return; }
      const p = normalizeParams(data.params || data);
      if (!p) throw new Error('Not a Motivo project');
      state.params = p; player.setParams(p); syncAll(); regenerate({ record: true }); saveSession();
      toast(`Loaded “${p.name}”`);
    } catch (e) { toast('Import failed: ' + e.message, true); }
  };
  $('#btnExportLib').onclick = async () => {
    if (!state.library.length) return toast('Library is empty');
    const path = await saveFile('motivo_library.json', JSON.stringify(state.library, null, 2), [{ name: 'JSON', extensions: ['json'] }]);
    if (path) toast('Library backed up · ' + path);
  };

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox';
    if (e.key === 'Escape') { closeExport(); document.activeElement?.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveToLibrary(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); openExport(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('#exportModal').classList.contains('open')) { if (e.key === 'Enter') doExport(); return; }
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
    else if (k === 'g') $('#btnGenerate').onclick();
    else if (k === 'r') randomizeMood();
    else if (k === 'e') openExport();
    else if (e.key === 'Home' || k === '0') player.seek(0);
  });

  requestAnimationFrame(frame);
  status('Ready — pick a theme or press Space to play');
}

boot().catch((e) => { console.error(e); toast('Startup error: ' + e.message, true); });
