// Motivo — UI controller.
import { STYLES, DEFAULT_PARAMS, applyStyle, LAYER_IDS, LAYER_NAMES, LAYER_COLORS } from './core/styles.js';
import { PRESETS, PRESET_GROUPS } from './core/presets.js';
import { generateSong, planLength, GENERATOR_VERSION } from './core/generator.js';
import { GenClient } from './core/genclient.js';
import { presetParams as buildPresetParams, normalizeParams, normalizeEntry } from './core/params.js';
import { Player, renderAudio, estimateRender } from './core/engine.js';
import { encodeWAV, encodeMIDI } from './core/export.js';
import { SCALES, NOTE_NAMES, NOTE_SHARPS, NOTE_FLATS, TIME_SIGS } from './core/theory.js';
import { KITS, BEDS, SPRINKLES, instrumentsFor } from './core/instruments.js';
import { randomSeed, RNG } from './core/rng.js';
import { icon } from './ui/icons.js';
import { initNative, saveFile, folderWriter, openTextFile, store, isMac, setStoreErrorHandler } from './ui/native.js';
import { ArrangementView } from './ui/arrangement.js';
import { Visualizer } from './ui/visualizer.js';
import { History } from './ui/history.js';
import { Wizard } from './ui/wizard.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmtTime = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), x = Math.floor(s % 60); return `${m}:${String(x).padStart(2, '0')}`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const debounce = (fn, ms) => {
  let t, args;
  const d = (...a) => { args = a; clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
  d.flush = () => { if (t) { clearTimeout(t); t = null; return fn(...args); } };
  return d;
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'track';
// Keeps the user's spelling; only removes characters no file system accepts.
const safeFileName = (s) => String(s).replace(/[/\\:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 100) || 'track';
const fmtBytes = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? Math.round(b / 1e6) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' kB');
const MOD = isMac() ? '⌘' : 'Ctrl';
const modKey = (k) => (isMac() ? `<kbd>⌘</kbd><kbd>${k}</kbd>` : `<kbd>Ctrl</kbd>+<kbd>${k}</kbd>`);

const state = { params: null, song: null, autoRegen: true, stale: false, library: [], recent: [], genMs: 0, libId: null, booted: false };
const gen = new GenClient();
const player = new Player({ generate: (p, o) => gen.generate(p, o) });
const history = new History();
let arrangement, viz, wizard;

// ── Parameter schema ─────────────────────────────────────────────────────
const LENGTHS = [8, 10, 12, 15, 20, 25, 30, 40, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360, 420, 480, 600];
const MODES = [['loop', 'Loop', 'repeat'], ['evolve', 'Evolving', 'infinity'], ['oneshot', 'One-shot', 'arrow']];
const pct = (v) => `${Math.round(v)}%`;
const keyLabel = (i) => (NOTE_SHARPS[i] === NOTE_FLATS[i] ? NOTE_SHARPS[i] : `${NOTE_SHARPS[i]} / ${NOTE_FLATS[i]}`);

const GROUPS = [
  { id: 'style', title: 'Genre & Harmony', icon: 'music', sum: (p) => STYLES[p.style].name, fields: [
    { key: 'style', label: 'Genre', type: 'select', kind: 'style', options: () => Object.entries(STYLES).map(([k, s]) => [k, s.name]),
      hint: (p) => STYLES[p.style].desc },
    { row: [
      { key: 'key', label: 'Key', type: 'select', kind: 'gen', options: () => [['auto', 'Auto'], ...NOTE_NAMES.map((n, i) => [n, keyLabel(i)])] },
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
  { id: 'structure', title: 'Length & Looping', icon: 'repeat', sum: (p) => `${MODES.find((m) => m[0] === p.mode)[1]} · ${fmtTime(planLength(p).seconds)}`, fields: [
    { key: 'mode', label: 'Playback mode', type: 'seg', tall: true, kind: 'gen', options: () => MODES,
      hint: (p) => p.mode === 'loop' ? 'Seamless loop: no intro/outro, last chord leads back to the first. Exports wrap reverb tails so the file loops cleanly.'
        : p.mode === 'evolve' ? 'Infinite loop that keeps varying each cycle (melody, drums, arrangement) over the same harmony. Great for long exploration.'
          : 'Linear piece with intro, development and an ending — for stingers, cutscenes and jingles.' },
    // The value shown is what the generator will actually produce (whole phrases), not the raw target.
    { key: 'length', label: (p) => p.mode === 'evolve' ? 'Cycle length' : 'Length', type: 'steps', kind: 'gen', values: LENGTHS,
      fmt: (v, p) => { const pl = planLength(p); return `${fmtTime(pl.seconds)} · ${pl.bars} bars`; },
      hint: (p) => { const pl = planLength(p); return Math.abs(pl.seconds - p.length) >= 1 ? `Target ${fmtTime(p.length)}, rounded to whole ${p.mode === 'oneshot' ? 'bars' : '4-bar phrases'} so it loops and resolves cleanly.` : ''; } },
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
const FIELD_LABELS = {};
for (const g of GROUPS) for (const f of g.fields.flatMap((x) => x.row || [x])) FIELD_LABELS[f.key] = typeof f.label === 'string' ? f.label : 'Length';

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
let fieldSeq = 0;
function buildInspector() {
  const root = $('#inspector');
  const collapsed = new Set(JSON.parse(localStorage.getItem('motivo.collapsed') || '["melody","ambience"]'));
  for (const grp of GROUPS) {
    const g = h('div', 'grp' + (collapsed.has(grp.id) ? ' closed' : ''));
    const head = h('button', 'grp-h', `<span class="gi">${icon(grp.icon, 14)}</span><span>${grp.title}</span><span class="gs"></span><span class="chev">${icon('chevron', 14)}</span>`);
    head.type = 'button';
    head.setAttribute('aria-expanded', String(!collapsed.has(grp.id)));
    head.onclick = () => {
      g.classList.toggle('closed');
      const closed = g.classList.contains('closed');
      head.setAttribute('aria-expanded', String(!closed));
      if (closed) collapsed.add(grp.id); else collapsed.delete(grp.id);
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
  const id = `f-${f.key}-${++fieldSeq}`;
  const label = typeof f.label === 'function' ? '' : f.label;
  const top = h('div', 'field-row', `<label for="${id}" id="${id}-l">${esc(label)}</label><span class="val" aria-live="off"></span>`);
  wrap.append(top);
  const valEl = top.querySelector('.val'), labEl = top.querySelector('label');
  const c = { f, wrap, valEl, labEl };
  if (f.type === 'slider' || f.type === 'steps') {
    const inp = h('input'); inp.type = 'range'; inp.id = id;
    if (f.type === 'steps') { inp.min = 0; inp.max = f.values.length - 1; inp.step = 1; }
    else { inp.min = f.min; inp.max = f.max; inp.step = f.step || 1; }
    if (f.track) inp.style.setProperty('--track', f.track);
    inp.oninput = () => {
      const v = f.type === 'steps' ? f.values[+inp.value] : +inp.value;
      setParam(f.key, v, f.kind);
    };
    inp.onchange = () => history.seal();
    inp.ondblclick = () => { if (f.type === 'slider') { history.seal(); setParam(f.key, defaultFor(f.key, state.params), f.kind); history.seal(); } };
    inp.title = 'Double-click to reset';
    wrap.append(inp);
    c.input = inp;
    if (f.ends) wrap.append(h('div', 'ends', `<span>${f.ends[0]}</span><span>${f.ends[1]}</span>`));
  } else if (f.type === 'select') {
    const sel = h('select', 'select'); sel.id = id;
    for (const [v, l] of f.options()) { const o = h('option'); o.value = v; o.textContent = l; sel.append(o); }
    sel.onchange = () => { setParam(f.key, sel.value, f.kind); history.seal(); };
    wrap.append(sel); c.input = sel;
    valEl.remove();
  } else if (f.type === 'seg') {
    labEl.removeAttribute('for');
    const seg = h('div', 'seg' + (f.tall ? ' tall' : ''));
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-labelledby', `${id}-l`);
    for (const [v, l, ic] of f.options()) {
      const b = h('button', '', (ic ? icon(ic, 14) : '') + `<span>${l}</span>`);
      b.type = 'button';
      b.dataset.v = v;
      b.onclick = () => { setParam(f.key, v, f.kind); history.seal(); };
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
    if (c.seg) c.seg.querySelectorAll('button').forEach((b) => { const on = String(b.dataset.v) === String(v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    if (c.valEl.isConnected) {
      c.valEl.textContent = f.fmt ? f.fmt(v, p) : String(v);
      const d = f.type === 'slider' ? defaultFor(f.key, p) : undefined;
      c.valEl.classList.toggle('mod', d !== undefined && d !== v);
      if (c.input) c.input.setAttribute('aria-valuetext', c.valEl.textContent);
    }
    if (c.hintEl) {
      const t = typeof f.hint === 'function' ? f.hint(p) : f.hint;
      c.hintEl.textContent = t; c.hintEl.classList.toggle('hidden', !t);
    }
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
    const nm = LAYER_NAMES[id];
    s.innerHTML = `
      <div class="strip-h"><div class="strip-name"><i></i>${nm}</div></div>
      <select class="select" aria-label="${nm} instrument"></select>
      <div><div class="mini-l"><span>VOL</span><b class="vv"></b></div><input type="range" class="vol" min="0" max="1" step="0.01" aria-label="${nm} volume"></div>
      <div><div class="mini-l"><span>PAN</span><b class="pv"></b></div><input type="range" class="pan" min="-1" max="1" step="0.05" style="--track:#4fd1c5" aria-label="${nm} pan"></div>
      <div class="strip-f"><div class="meter"><i></i></div><div class="ms"><button type="button" class="m" title="Mute ${nm}" aria-label="Mute ${nm}">M</button><button type="button" class="s" title="Solo ${nm}" aria-label="Solo ${nm}">S</button></div></div>`;
    const sel = s.querySelector('select');
    let opts;
    if (id === 'drums') opts = Object.entries(KITS).map(([k, v]) => [k, v.name]);
    else if (id === 'ambience') opts = Object.entries(BEDS);
    else opts = instrumentsFor(id).map(([k, v]) => [k, v.name]);
    for (const [v, l] of opts) { const o = h('option'); o.value = v; o.textContent = l; sel.append(o); }
    sel.onchange = () => {
      if (id === 'ambience') setParam('bed', sel.value, 'bed');
      else setLayer(id, 'inst', sel.value);
      history.seal();
    };
    s.querySelector('.m').onclick = () => { setLayer(id, 'mute', !state.params.layers[id].mute); history.seal(); };
    s.querySelector('.s').onclick = () => { setLayer(id, 'solo', !state.params.layers[id].solo); history.seal(); };
    const vol = s.querySelector('.vol'), pan = s.querySelector('.pan');
    vol.oninput = () => setLayer(id, 'vol', +vol.value);
    vol.onchange = pan.onchange = () => history.seal();
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
    <div><div class="mini-l"><span>VOL</span><b class="vv"></b></div><input type="range" class="vol" min="0" max="100" step="1" aria-label="Master volume"></div>
    <div><div class="mini-l"><span>WIDTH</span><b class="pv"></b></div><input type="range" class="pan" min="0" max="100" step="1" style="--track:#4fd1c5" aria-label="Stereo width"></div>
    <div class="strip-f"><div class="meter"><i></i></div></div>`;
  const mv = m.querySelector('.vol'), mw = m.querySelector('.pan');
  mv.oninput = () => setParam('master', +mv.value, 'mix');
  mw.oninput = () => setParam('width', +mw.value, 'mix');
  mv.onchange = mw.onchange = () => history.seal();
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
    S.m.setAttribute('aria-pressed', String(!!L.mute)); S.so.setAttribute('aria-pressed', String(!!L.solo));
    S.s.classList.toggle('muted', !!L.mute || (anySolo && !L.solo));
  }
  const M = strips.master;
  M.vol.value = p.master; M.vol.style.setProperty('--fill', p.master + '%'); M.vv.textContent = p.master;
  M.pan.value = p.width; M.pan.style.setProperty('--fill', p.width + '%'); M.pv.textContent = p.width + '%';
}

function setLayer(id, key, value) {
  if (state.params.layers[id][key] === value) return;
  history.record(state.params, `${LAYER_NAMES[id]} ${({ inst: 'instrument', vol: 'volume', pan: 'pan', mute: 'mute', solo: 'solo' })[key]}`, `layer:${id}:${key}`);
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
  if (p[key] === value) return;
  history.record(p, FIELD_LABELS[key] || key, 'param:' + key);
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

// Generation runs in a worker. Only the latest request is applied; while
// playing, the new version takes over at the next bar.
let genToken = 0;
async function regenerate({ newSeed = false, record = false, immediate = false } = {}) {
  const p = state.params;
  if (newSeed) p.seed = randomSeed();
  const token = ++genToken;
  const cycle = p.mode === 'evolve' && player.playing ? player.cycle : 0;
  const t0 = performance.now();
  let song;
  try { song = await gen.generate(p, { cycle }); } catch (e) { console.error(e); toast('Generation failed: ' + e.message, { err: true }); return null; }
  if (token !== genToken) return null; // superseded by a newer request
  state.genMs = performance.now() - t0;
  state.song = song;
  player.setParams(state.params);
  player.setSong(song, { immediate });
  clearStale();
  updateHero(); syncInspector();
  $('#seedInput').value = p.seed;
  const notes = Object.values(song.tracks).reduce((s, l) => s + l.length, 0);
  status(`Generated ${song.totalBars} bars · ${notes.toLocaleString()} events in ${state.genMs.toFixed(0)} ms${player.playing ? ' · applying at next bar' : ''}`);
  if (record) pushRecent();
  return song;
}

function updateHero() {
  const p = state.params, s = player.song || state.song;
  const pr = PRESETS.find((x) => x.id === p.preset);
  $('#heroKicker').textContent = pr ? `Theme · ${pr.group}` : `Custom · ${STYLES[p.style].name}`;
  $('#heroTitle').textContent = p.name;
  $('#heroDesc').textContent = pr ? `${pr.desc} Use for: ${pr.use}.` : STYLES[p.style].desc;
  const hero = $('.hero');
  hero.style.setProperty('--hero-tint', pr ? pr.colors[0] + '40' : 'rgba(242,181,68,.10)');
  if (pr) viz.setTint([pr.colors[0], '#8b7cf6', '#f2b544']); else viz.setTint(['#4fd1c5', '#8b7cf6', '#f2b544']);
  if (!s) return;
  const shortScale = s.scaleName.replace('Natural ', '').replace('Pentatonic', 'Pent.').replace('Harmonic', 'Harm.').replace('Phrygian Dominant', 'Phryg. Dom.');
  const stats = [
    ['Genre', STYLES[p.style].name.split(' ')[0]], ['Key', `${s.keyName} ${shortScale}`],
    ['Tempo', `${s.bpm} BPM`], ['Meter', s.timeSig],
    ['Form', s.sections.length > 6 ? s.sections.map((x) => x.letter).join('') : s.sections.map((x) => x.letter === 'I' ? 'In' : x.letter === 'O' ? 'Out' : x.letter).join('·')], ['Bars', s.totalBars],
    ['Length', fmtTime(s.duration)], ['Mode', MODES.find((m) => m[0] === s.mode)[1] + (s.mode === 'evolve' ? ` · cycle ${(s.cycle || 0) + 1}` : '')],
  ];
  $('#stats').innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('');
  $('#tLen').textContent = fmtTime(s.duration);
  const rep = $('#btnRepeat');
  rep.classList.toggle('on', s.loop || player.repeat);
  rep.setAttribute('aria-pressed', String(s.loop || player.repeat));
  rep.disabled = s.loop;
  rep.title = s.loop ? 'Loop modes always repeat' : 'Repeat one-shot preview';
}

function syncAll() {
  syncInspector(); syncMixer(); renderPresets(); renderLibrary();
  $('#trackName').value = state.params.name;
  $('#seedInput').value = state.params.seed;
}

// ── Undo / redo ──────────────────────────────────────────────────────────
function restoreSnapshot(s, verb) {
  state.params = normalizeParams(s.params);
  player.setParams(state.params);
  syncAll(); updateHero();
  regenerate();
  saveSession();
  toast(`${verb}: ${s.label}`);
}
function undo() {
  regenSoon.flush();
  const s = history.undo(state.params);
  if (!s) return toast('Nothing to undo');
  restoreSnapshot(s, 'Undo');
}
function redo() {
  const s = history.redo(state.params);
  if (!s) return toast('Nothing to redo');
  restoreSnapshot(s, 'Redo');
}
function syncHistoryButtons() {
  $('#btnUndo').disabled = !history.canUndo;
  $('#btnRedo').disabled = !history.canRedo;
  $('#btnUndo').title = history.canUndo ? `Undo ${history.undoStack[history.undoStack.length - 1].label} (${MOD}+Z)` : `Undo (${MOD}+Z)`;
  $('#btnRedo').title = history.canRedo ? `Redo ${history.redoStack[history.redoStack.length - 1].label} (${MOD}+Shift+Z)` : `Redo (${MOD}+Shift+Z)`;
  $('#btnUndo').setAttribute('aria-label', $('#btnUndo').title);
  $('#btnRedo').setAttribute('aria-label', $('#btnRedo').title);
}
const undoAction = { label: 'Undo', fn: () => undo() };

// ── Presets ──────────────────────────────────────────────────────────────
function presetParams(pr) {
  return buildPresetParams(pr, { seed: randomSeed(), master: state.params ? state.params.master : DEFAULT_PARAMS.master });
}
async function applyPreset(pr, { play = false, recordHistory = true } = {}) {
  if (recordHistory && state.params) { history.seal(); history.record(state.params, `Theme “${pr.name}”`, 'preset'); history.seal(); }
  state.params = presetParams(pr);
  state.libId = null;
  player.setParams(state.params);
  syncAll();
  await regenerate({ record: true });
  if (play) player.play();
  saveSession();
}
function activateOnKey(el, fn) {
  el.tabIndex = 0; el.setAttribute('role', 'button');
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fn(e); } });
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
      const active = state.params?.preset === pr.id;
      const el = h('div', 'preset' + (active ? ' active' : ''));
      el.innerHTML = `<div class="ico" style="background:linear-gradient(135deg,${pr.colors[0]},${pr.colors[1]})">${icon(pr.icon, 19)}</div>
        <div style="min-width:0"><div class="name">${esc(pr.name)}</div><div class="meta">${esc(STYLES[pr.params.style].name)} · ${esc(pr.use)}</div></div>`;
      el.title = pr.desc + '\nDouble-click (or Shift+Enter) to generate and play.';
      el.setAttribute('aria-label', `${pr.name} theme — ${pr.use}`);
      el.setAttribute('aria-current', String(active));
      el.onclick = () => applyPreset(pr);
      el.ondblclick = () => player.play();
      activateOnKey(el, (e) => applyPreset(pr, { play: e.shiftKey }));
      root.append(el);
    }
  }
  if (!root.children.length) root.append(h('div', 'empty', 'No themes match your search.'));
}

// ── Library ──────────────────────────────────────────────────────────────
function summary(p, s) { return `${STYLES[p.style].name} · ${s ? s.keyName + ' ' + s.scaleName : ''} · ${p.bpm} BPM`; }
function makeEntry(id = Date.now()) {
  const p = state.params;
  return { id, name: p.name, params: structuredClone(p), sum: summary(p, state.song), at: Date.now(), gen: GENERATOR_VERSION };
}
function pushRecent() {
  const p = state.params;
  state.recent = state.recent.filter((r) => r.params.seed !== p.seed);
  state.recent.unshift(makeEntry());
  state.recent = state.recent.slice(0, 15);
  store.set('recent', state.recent); renderLibrary();
}
// Ctrl/⌘+S updates the entry you're working on; Shift adds a new copy.
async function saveToLibrary({ asNew = false } = {}) {
  const p = state.params;
  const i = state.libId != null ? state.library.findIndex((e) => e.id === state.libId) : -1;
  let msg;
  if (!asNew && i >= 0) {
    state.library[i] = makeEntry(state.libId);
    msg = `Updated “${p.name}” · ${MOD}+Shift+S saves a copy`;
  } else {
    const e = makeEntry();
    state.library.unshift(e); state.libId = e.id;
    msg = `Saved “${p.name}” to your library`;
  }
  const ok = await store.set('library', state.library);
  renderLibrary();
  if (ok) toast(msg);
}
function deleteEntry(e) {
  const idx = state.library.findIndex((x) => x.id === e.id);
  if (idx < 0) return;
  state.library.splice(idx, 1);
  if (state.libId === e.id) state.libId = null;
  store.set('library', state.library); renderLibrary();
  toast(`Deleted “${e.name}”`, { action: { label: 'Undo', fn: () => {
    state.library.splice(Math.min(idx, state.library.length), 0, e);
    store.set('library', state.library); renderLibrary();
  } } });
}
function warnGenerator(v) {
  if (v != null && v !== GENERATOR_VERSION) toast(`Made with generator v${v} (now v${GENERATOR_VERSION}) — it may sound different from when it was saved.`, { err: true });
}
function loadEntry(e, { fromLibrary = false } = {}) {
  history.seal(); history.record(state.params, `Load “${e.name}”`, 'load'); history.seal();
  state.params = normalizeParams(structuredClone(e.params));
  state.libId = fromLibrary ? e.id : null;
  player.setParams(state.params);
  syncAll(); regenerate(); saveSession();
  warnGenerator(e.gen);
}
function renderLibrary() {
  $('#libCount').textContent = state.library.length;
  const mk = (list, root, deletable) => {
    root.innerHTML = '';
    if (!list.length) { root.append(h('div', 'empty', deletable ? `Nothing saved yet. Press ${modKey('S')} to keep the current track — seed and all parameters.` : 'Your generated variations will appear here.')); return; }
    for (const e of list) {
      const pr = PRESETS.find((x) => x.id === e.params.preset);
      const active = deletable && e.id === state.libId;
      const it = h('div', 'lib-item' + (active ? ' active' : ''));
      it.innerHTML = `<span class="sw" style="background:${pr ? pr.colors[0] : LAYER_COLORS.lead}"></span>
        <div style="min-width:0"><div class="nm">${esc(e.name)}</div><div class="mt">${esc(e.params.seed)} · ${esc(e.sum)}</div></div>
        ${deletable ? `<button type="button" class="del" title="Delete “${esc(e.name)}”" aria-label="Delete ${esc(e.name)}">${icon('trash', 14)}</button>` : `<span class="mt">${new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`}`;
      it.setAttribute('aria-label', `Load ${e.name}`);
      if (active) it.setAttribute('aria-current', 'true');
      it.onclick = (ev) => {
        if (ev.target.closest('.del')) { deleteEntry(e); return; }
        loadEntry(e, { fromLibrary: deletable });
      };
      activateOnKey(it, (ev) => { if (!ev.target.closest('.del')) loadEntry(e, { fromLibrary: deletable }); });
      root.append(it);
    }
  };
  mk(state.library, $('#libSaved'), true);
  mk(state.recent, $('#libRecent'), false);
  const b = $('#btnSave');
  b.title = state.libId != null && state.library.some((x) => x.id === state.libId) ? `Update library entry (${MOD}+S) · Shift-click to save a copy` : `Save to library (${MOD}+S)`;
  b.setAttribute('aria-label', b.title);
}

async function importFile() {
  try {
    const txt = await openTextFile([{ name: 'Motivo project or library', extensions: ['json'] }]);
    if (!txt) return;
    const data = JSON.parse(txt);
    if (Array.isArray(data)) {
      const seen = new Set(state.library.map((e) => `${e.id}|${e.params.seed}|${e.name}`));
      const seenKey = new Set(state.library.map((e) => `${e.params.seed}|${e.name}`));
      let added = 0, dup = 0, bad = 0;
      const fresh = [];
      data.forEach((raw, i) => {
        const e = normalizeEntry(raw, Date.now() + i);
        if (!e) { bad++; return; }
        if (seen.has(`${e.id}|${e.params.seed}|${e.name}`) || seenKey.has(`${e.params.seed}|${e.name}`)) { dup++; return; }
        if (state.library.some((x) => x.id === e.id) || fresh.some((x) => x.id === e.id)) e.id = Date.now() + 1000 + i;
        seenKey.add(`${e.params.seed}|${e.name}`);
        fresh.push(e); added++;
      });
      state.library = fresh.concat(state.library);
      await store.set('library', state.library); renderLibrary();
      toast(`Imported ${added} track${added === 1 ? '' : 's'}${dup ? ` · ${dup} already in library` : ''}${bad ? ` · ${bad} invalid skipped` : ''}`, { err: !added && bad > 0 });
      return;
    }
    const p = normalizeParams(data.params || data);
    if (!p) throw new Error('Not a Motivo project');
    history.seal(); history.record(state.params, `Import “${p.name}”`, 'import'); history.seal();
    state.params = p; state.libId = null;
    player.setParams(p); syncAll(); regenerate({ record: true }); saveSession();
    toast(`Loaded “${p.name}”`);
    warnGenerator(data.generatorVersion);
  } catch (e) { toast('Import failed: ' + e.message, { err: true }); }
}

// ── Export ───────────────────────────────────────────────────────────────
const ex = { format: 'wav', sr: 44100, bits: 16, normalize: true, loopPts: true, stemMix: true, from: 'first', busy: false, abort: null };
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
const exportLayers = (p, song) => {
  const anySolo = LAYER_IDS.some((id) => p.layers[id].solo);
  return LAYER_IDS.filter((id) => !p.layers[id].mute && (!anySolo || p.layers[id].solo) && (song.tracks[id].length || (id === 'ambience' && p.bed !== 'none')));
};
const startCycle = () => (state.song?.mode === 'evolve' && ex.from === 'current' ? player.cycle : 0);
function openExport() {
  if (!state.song || ex.busy) return;
  ex.name = baseName();
  $('#exportModal').classList.add('open');
  renderExport();
  setTimeout(() => $('#exGo').focus(), 0);
}
function closeExport() {
  if (ex.busy) { cancelExport(); return; }
  $('#exportModal').classList.remove('open');
}
function cancelExport() {
  if (!ex.busy || !ex.abort) return;
  ex.abort.aborted = true;
  $('#exCancel').textContent = 'Cancelling…'; $('#exCancel').disabled = true;
}
function renderExport() {
  const s = state.song, p = state.params;
  const audio = ex.format === 'wav' || ex.format === 'stems';
  const dur = s.mode === 'evolve' ? s.duration * p.cycles : s.duration;
  $('#exSub').textContent = `${p.name} · ${s.keyName} ${s.scaleName} · ${s.bpm} BPM · ${fmtTime(dur)}`;
  $('#exFormats').innerHTML = FORMATS.map(([k, ic, t, d]) => `<button type="button" class="fmt ${ex.format === k ? 'on' : ''}" data-k="${k}" aria-pressed="${ex.format === k}"><div class="fi">${icon(ic, 17)}</div><div><div class="ft">${t}</div><div class="fd">${d}</div></div></button>`).join('');
  $('#exFormats').querySelectorAll('.fmt').forEach((el) => el.onclick = () => { if (ex.busy) return; ex.format = el.dataset.k; renderExport(); });
  const seg = (key, opts) => `<div class="seg" data-key="${key}" role="group">${opts.map(([v, l]) => `<button type="button" class="${String(ex[key]) === String(v) ? 'on' : ''}" aria-pressed="${String(ex[key]) === String(v)}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const ext = { wav: '.wav', midi: '.mid', project: '.motivo.json', stems: '_<layer>.wav' }[ex.format];
  let html = `<div class="full"><label class="lbl" for="exName">${ex.format === 'stems' ? 'Stem prefix' : 'File name'}</label><input type="text" id="exName" value="${esc(ex.name)}" spellcheck="false"><div class="hint ex-file" id="exFile"></div></div>`;
  if (audio) {
    html += `<div><div class="lbl">Sample rate</div>${seg('sr', [[44100, '44.1 kHz'], [48000, '48 kHz']])}</div>`;
    html += `<div><div class="lbl">Bit depth</div>${seg('bits', [[16, '16-bit'], [24, '24-bit']])}</div>`;
    if (ex.format === 'wav') html += `<label class="chk"><span class="switch"><input type="checkbox" id="exNorm" ${ex.normalize ? 'checked' : ''}><i></i></span>Normalize to −1 dBFS</label>`;
    else html += `<label class="chk"><span class="switch"><input type="checkbox" id="exStemMix" ${ex.stemMix ? 'checked' : ''}><i></i></span>Also export a matching mix</label>`;
    if (s.loop) html += `<label class="chk"><span class="switch"><input type="checkbox" id="exLoop" ${ex.loopPts ? 'checked' : ''}><i></i></span>Embed loop points</label>`;
  }
  if (s.mode === 'evolve' && ex.format !== 'project') {
    html += `<div class="full"><div class="lbl">Start from</div>${seg('from', [['first', 'Cycle 1'], ['current', `Current cycle (${player.cycle + 1})`]])}</div>`;
    html += `<div class="full"><label class="lbl" for="exCycles">Evolving cycles to render: <b style="font-family:var(--mono)">${p.cycles}</b> (${fmtTime(s.duration * p.cycles)})</label><input type="range" id="exCycles" min="2" max="16" value="${p.cycles}" style="--fill:${(p.cycles - 2) / 14 * 100}%"></div>`;
  }
  $('#exOpts').innerHTML = html;
  $('#exOpts').querySelectorAll('.seg').forEach((sg) => sg.querySelectorAll('button').forEach((b) => b.onclick = () => {
    const v = b.dataset.v; ex[sg.dataset.key] = sg.dataset.key === 'from' ? v : +v; renderExport();
  }));
  const nm = $('#exName');
  const showFile = () => { $('#exFile').textContent = `Saves as: ${safeFileName(ex.name || baseName())}${ext}`; };
  nm.oninput = () => { ex.name = nm.value; showFile(); }; showFile();
  const nrm = $('#exNorm'); if (nrm) nrm.onchange = () => { ex.normalize = nrm.checked; };
  const sm = $('#exStemMix'); if (sm) sm.onchange = () => { ex.stemMix = sm.checked; renderExport(); };
  const lp = $('#exLoop'); if (lp) lp.onchange = () => { ex.loopPts = lp.checked; };
  const cy = $('#exCycles'); if (cy) {
    cy.oninput = () => { history.record(p, 'Cycles to export', 'param:cycles'); p.cycles = +cy.value; syncInspector(); saveSession(); renderExport(); $('#exCycles').focus(); };
    cy.onchange = () => history.seal();
  }
  let note;
  if (ex.format === 'midi') note = 'Type-1 MIDI with tempo, meter, section markers and one track per audible layer (mute and solo apply; drums on channel 10, GM mapping).';
  else if (ex.format === 'project') note = 'Saves the seed and every parameter. Re-importing regenerates the exact same track.';
  else if (s.mode === 'loop') note = 'Seamless loop: the render is pre-rolled one full cycle so reverb and delay tails wrap into the start. The file loops sample-accurately with no gap or click.';
  else if (s.mode === 'evolve') note = `Evolving: ${p.cycles} varied cycles rendered as one long seamless loop. Loop the whole file in-engine for hours of non-repetitive music.`;
  else note = 'One-shot: includes the natural reverb tail; trailing silence is trimmed.';
  if (ex.format === 'stems') note += ' Stems skip the master compressor and saturation and are not normalized, so they sum back to the matching mix when layered in an engine.';
  let warn = false;
  if (audio) {
    const est = estimateRender(s, { sampleRate: ex.sr, cycles: s.mode === 'evolve' ? p.cycles : 1, bits: ex.bits, reverbSize: p.reverbSize });
    const files = ex.format === 'stems' ? exportLayers(p, s).length + (ex.stemMix ? 1 : 0) : 1;
    note += ` Output ≈ ${fmtBytes(est.fileBytes * files)}${files > 1 ? ` in ${files} files` : ''}.`;
    if (est.peakBytes > 600e6) { warn = true; note += ` This render needs about ${fmtBytes(est.peakBytes)} of memory — lower the cycle count or sample rate if the app struggles.`; }
  }
  const noteEl = $('#exNote');
  noteEl.classList.toggle('warn', warn);
  noteEl.innerHTML = icon(warn ? 'info' : 'info', 15) + `<span>${note}</span>`;
}
async function doExport() {
  if (ex.busy) return;
  const p = state.params;
  const from = startCycle();
  const song = state.song.mode === 'evolve' ? await gen.generate(p, { cycle: from }) : state.song;
  const name = safeFileName(ex.name || baseName());
  const prog = $('#exProgress'), bar = prog.querySelector('i'), lab = prog.querySelector('span');
  const setProg = (v, txt) => { bar.style.width = (v * 100) + '%'; if (txt) lab.textContent = txt; };
  ex.busy = true; ex.abort = { aborted: false };
  $('#exGo').disabled = true; $('#exCancel').textContent = 'Cancel'; $('#exCancel').disabled = false;
  const signal = ex.abort;
  let done = false;
  try {
    if (ex.format === 'project') {
      const path = await saveFile(name + '.motivo.json', JSON.stringify({ app: 'motivo', version: 1, generatorVersion: GENERATOR_VERSION, params: p }, null, 2), [{ name: 'Motivo project', extensions: ['json'] }]);
      if (path) toast('Project saved · ' + path);
    } else if (ex.format === 'midi') {
      const songs = song.mode === 'evolve' ? Array.from({ length: p.cycles }, (_, i) => generateSong(p, { cycle: from + i })) : [song];
      const path = await saveFile(name + '.mid', encodeMIDI(song, p, songs), [{ name: 'MIDI', extensions: ['mid'] }]);
      if (path) toast('MIDI saved · ' + path);
    } else if (ex.format === 'wav') {
      prog.classList.remove('hidden'); setProg(0.02, 'Rendering audio…');
      const res = await renderAudio(p, song, { sampleRate: ex.sr, cycles: p.cycles, startCycle: from, normalize: ex.normalize, signal, onProgress: (v) => setProg(v * 0.9) });
      setProg(0.95, 'Encoding WAV…');
      const wav = encodeWAV(res, { bits: ex.bits, loop: res.loop && ex.loopPts, title: p.name });
      setProg(1, 'Saving…');
      const path = await saveFile(name + '.wav', wav, [{ name: 'WAV audio', extensions: ['wav'] }]);
      if (path) toast(`Exported ${fmtTime(res.duration)} WAV · ${path}`);
    } else if (ex.format === 'stems') {
      const writer = await folderWriter();
      if (writer) {
        prog.classList.remove('hidden');
        const jobs = exportLayers(p, song).map((id) => ({ id, label: LAYER_NAMES[id], file: `${name}_${id}.wav` }));
        if (ex.stemMix) jobs.push({ id: null, label: 'Mix', file: `${name}_mix.wav` });
        for (let i = 0; i < jobs.length; i++) {
          const j = jobs[i];
          setProg(i / jobs.length, `Rendering ${j.id ? 'stem' : 'mix'} ${i + 1}/${jobs.length} · ${j.label}`);
          const res = await renderAudio(p, song, { sampleRate: ex.sr, cycles: p.cycles, startCycle: from, normalize: false, soloLayer: j.id, linearMaster: true, signal, onProgress: (v) => setProg((i + v) / jobs.length) });
          await writer.write(j.file, encodeWAV(res, { bits: ex.bits, loop: res.loop && ex.loopPts, title: `${p.name} – ${j.label}` }));
        }
        setProg(1, 'Done');
        toast(`Exported ${jobs.length} files → ${writer.label}`);
      }
    }
    done = true;
  } catch (e) {
    if (e.name === 'AbortError') toast('Export cancelled');
    else { console.error(e); toast('Export failed: ' + (e.message || e), { err: true }); }
  } finally {
    ex.busy = false; ex.abort = null;
    $('#exGo').disabled = false; $('#exCancel').textContent = 'Cancel'; $('#exCancel').disabled = false;
    setTimeout(() => { prog.classList.add('hidden'); setProg(0); }, 300);
    if (done) $('#exportModal').classList.remove('open');
  }
}

// ── Misc UI ──────────────────────────────────────────────────────────────
// toast(msg, { err, action: { label, fn } }) — also accepts toast(msg, true) for errors.
function toast(msg, opts = {}) {
  if (opts === true) opts = { err: true };
  const t = h('div', 'toast' + (opts.err ? ' err' : ''));
  t.setAttribute('role', opts.err ? 'alert' : 'status');
  const span = h('span'); span.textContent = msg; t.append(span);
  let timer;
  const close = () => { clearTimeout(timer); t.classList.add('out'); setTimeout(() => t.remove(), 300); };
  if (opts.action) {
    const b = h('button', 'toast-act'); b.type = 'button'; b.textContent = opts.action.label;
    b.onclick = () => { close(); opts.action.fn(); };
    t.append(b); t.classList.add('has-act');
  }
  $('#toasts').append(t);
  timer = setTimeout(close, opts.err ? 6000 : opts.action ? 6000 : 3800);
}
function status(msg) { $('#statusText').textContent = msg; }
const saveSession = debounce(() => store.set('session', state.params), 500);
const storeErrAt = {};
setStoreErrorHandler((key, e) => {
  console.warn('store.set failed', key, e);
  if (Date.now() - (storeErrAt[key] || 0) < 10000) return;
  storeErrAt[key] = Date.now();
  const what = { library: 'your library', recent: 'recent generations', session: 'the current session' }[key] || key;
  toast(`Couldn't save ${what} to disk (${e?.message || e?.code || 'storage error'}). Use Library → Backup to keep a copy.`, { err: true });
});

function randomizeMood() {
  const p = state.params, st = STYLES[p.style];
  history.seal(); history.record(p, 'Randomize', 'randomize'); history.seal();
  const r = new RNG(Date.now() + ':' + Math.random());
  for (const k of ['energy', 'tension', 'brightness', 'density', 'complexity']) p[k] = Math.round(Math.max(0, Math.min(100, st.mood[k] + r.float(-30, 30))));
  p.variation = r.int(20, 80); p.repetition = r.int(35, 85);
  p.bpm = r.int(st.bpmRange[0], st.bpmRange[1]);
  p.key = 'auto'; p.scale = 'auto'; p.harmRhythm = 'auto';
  p.preset = null;
  syncAll();
  regenerate({ newSeed: true, record: true });
  saveSession();
  toast('Randomized mood and seed', { action: undoAction });
}
function newVariation() {
  if (state.stale) { regenerate({ record: true }); return; }
  const d = $('#btnDice'); d.classList.remove('spin'); void d.offsetWidth; d.classList.add('spin');
  history.seal(); history.record(state.params, 'New seed', 'seed'); history.seal();
  regenerate({ newSeed: true, record: true }).then((s) => { if (s) toast(`New variation · ${s.seed}`, { action: undoAction }); });
}
function setSeed(v) {
  v = v.trim() || randomSeed();
  if (v === state.params.seed) return;
  history.seal(); history.record(state.params, 'Seed', 'seed'); history.seal();
  state.params.seed = v;
  regenerate({ record: true }); saveSession();
}

// The animation loop only runs while something moves: playback, a fading
// spectrum after stop, or a scrub. Idle, it costs nothing.
let lastUi = {}, rafId = 0, idleFrames = 0;
function kick() { idleFrames = 0; if (!rafId) rafId = requestAnimationFrame(frame); }
function frame() {
  rafId = 0;
  const s = player.song || state.song;
  if (s) {
    const beat = arrangement.scrub != null ? arrangement.scrub : player.position();
    arrangement.drawHead(beat);
    const sec = beat * 60 / s.bpm;
    const bar = Math.floor(beat / s.beatsPerBar), inBar = beat - bar * s.beatsPerBar;
    const pos = fmtTime(sec), bb = `Bar ${bar + 1}.${Math.floor(inBar) + 1}`;
    if (lastUi.pos !== pos) { $('#tPos').textContent = pos; lastUi.pos = pos; }
    if (lastUi.bb !== bb) { $('#tBar').textContent = bb; lastUi.bb = bb; }
    const cyc = s.mode === 'evolve' ? `Cycle ${player.cycle + 1}` : '';
    if (lastUi.cyc !== cyc) { $('#tCycle').textContent = cyc; lastUi.cyc = cyc; }
    let ci = lastUi.ci != null && lastUi.song === s && s.chords[lastUi.ci]?.t <= beat + 1e-6 ? lastUi.ci : 0;
    while (ci + 1 < s.chords.length && s.chords[ci + 1].t <= beat + 1e-6) ci++;
    lastUi.ci = ci; lastUi.song = s;
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
  } else { strips.master.meter.style.width = '0%'; lastUi.peak = 0; strips.master.peak.textContent = '-∞'; }
  if (live || arrangement.scrub != null) idleFrames = 0; else idleFrames++;
  if (idleFrames < 60) rafId = requestAnimationFrame(frame);
}

function setPlayState(on) {
  const b = $('#btnPlay');
  b.classList.toggle('playing', on);
  b.innerHTML = icon(on ? 'pause' : 'play', 18);
  b.setAttribute('aria-label', on ? 'Pause' : 'Play'); b.setAttribute('aria-pressed', String(on));
  $('.viz').classList.toggle('live', on);
  $('#audioDot').classList.toggle('live', on);
  $('#vizHint').classList.toggle('hidden', on);
  if (on) status(`Playing · ${player.ctx.sampleRate / 1000} kHz`);
  kick();
}

// Icon-only buttons get their accessible name from their tooltip.
function labelIconButtons() {
  document.querySelectorAll('button[title]').forEach((b) => { if (!b.textContent.trim()) b.setAttribute('aria-label', b.title); });
}

// ── New-track wizard ────────────────────────────────────────────────────
// Variations are auditioned through the main player; cancelling puts the
// current track back exactly as it was.
let wzPrev = null;
function setupWizard() {
  wizard = new Wizard({
    generate: (p, o) => gen.generate(p, o),
    master: () => state.params?.master ?? DEFAULT_PARAMS.master,
    preview: (params, song) => {
      if (!wzPrev) wzPrev = { playing: player.playing };
      player.setParams(params);
      player.setSong(song, { immediate: true });
      player.seek(0);
      if (!player.playing) player.play(0);
    },
    stopPreview: () => player.pause(),
    restore: () => {
      player.setParams(state.params);
      if (state.song) player.setSong(state.song, { immediate: true });
      if (!wzPrev?.playing) player.stop();
      wzPrev = null;
      updateHero();
    },
    apply: (params, song) => {
      history.seal(); history.record(state.params, `New track “${params.name}”`, 'wizard'); history.seal();
      state.params = params; state.libId = null; state.song = song;
      player.setParams(params);
      player.setSong(song, { immediate: true });
      wzPrev = null;
      clearStale(); syncAll(); updateHero();
      pushRecent(); saveSession();
      $('#seedInput').value = params.seed;
      status(`Created “${params.name}” — fine-tune it in the Parameters panel`);
      toast(`Created “${params.name}”`, { action: undoAction });
    },
  });
}
function openWizard() {
  if ($('#exportModal').classList.contains('open')) return;
  try { localStorage.setItem('motivo.wizardSeen', '1'); } catch (e) { /* noop */ }
  wizard.open();
}

// ── Boot ─────────────────────────────────────────────────────────────────
async function boot() {
  await initNative({ beforeClose: async () => { saveSession.flush(); await store.set('session', state.params); } });
  // static icons
  $('#btnBack').innerHTML = icon('back', 15);
  $('#btnStop').innerHTML = icon('stop', 14);
  $('#btnRepeat').innerHTML = icon('repeat', 15);
  $('#btnDice').innerHTML = icon('dice', 16);
  $('#btnSave').innerHTML = icon('bookmark', 15);
  $('#btnUndo').innerHTML = icon('undo', 15);
  $('#btnRedo').innerHTML = icon('redo', 15);
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
  $('#btnNew').innerHTML = icon('plus', 14) + 'New';
  $('#btnExport').title = `Export (E · ${MOD}+E)`;
  $('#statusKeys').innerHTML = `<span><kbd>Space</kbd> play</span><span><kbd>G</kbd> new seed</span><span><kbd>R</kbd> randomize</span>
    <span><kbd>N</kbd> new</span><span><kbd>E</kbd> export</span><span>${modKey('S')} save</span><span>${modKey('Z')} undo</span>`;
  clearStale();
  $('#arrLegend').innerHTML = [['A', '#f2b544'], ['B', '#4fd1c5'], ['C', '#a58bff']].map(([l, c]) => `<span><i style="background:${c}"></i>Section ${l}</span>`).join('');

  viz = new Visualizer($('#vizCanvas'));
  arrangement = new ArrangementView($('#arrWrap'), $('#arrCanvas'), $('#arrHead'), { onSeek: (b) => { player.seek(b); kick(); }, onScrub: () => kick() });
  buildInspector(); buildMixer();
  history.onChange = syncHistoryButtons; syncHistoryButtons();

  const clean = (list) => (Array.isArray(list) ? list : []).map((e, i) => normalizeEntry(e, Date.now() + i)).filter(Boolean);
  state.library = clean(await store.get('library', []));
  state.recent = clean(await store.get('recent', []));
  player.on('swap', (song) => {
    arrangement.setSong(song, state.params); updateHero(); kick();
    const st = $('#statusText'); if (st.textContent.endsWith(' · applying at next bar')) st.textContent = st.textContent.replace(' · applying at next bar', '');
  });
  player.on('cycle', (n, song) => { arrangement.setSong(song, state.params); updateHero(); status(`Evolving · cycle ${n + 1}`); kick(); });
  setupWizard();
  const saved = normalizeParams(await store.get('session', null));
  if (saved) { state.params = saved; syncAll(); await regenerate(); }
  else await applyPreset(PRESETS.find((x) => x.id === 'forest'), { recordHistory: false });
  renderLibrary();
  state.booted = true;
  // First launch: start with the wizard (the default theme is loaded behind it).
  let seen = true; try { seen = !!localStorage.getItem('motivo.wizardSeen'); } catch (e) { /* noop */ }
  if (!saved && !seen) openWizard();

  // events
  player.on('state', setPlayState);
  player.on('seek', () => kick());
  player.on('ended', () => status('Finished'));
  $('#btnPlay').onclick = () => player.toggle();
  $('#btnStop').onclick = () => player.stop();
  $('#btnBack').onclick = () => player.seek(0);
  $('#btnRepeat').onclick = () => { player.repeat = !player.repeat; updateHero(); };
  $('#btnGenerate').onclick = newVariation;
  $('#btnDice').onclick = newVariation;
  $('#btnUndo').onclick = undo;
  $('#btnRedo').onclick = redo;
  $('#seedInput').onkeydown = (e) => { if (e.key === 'Enter') { setSeed(e.target.value); e.target.blur(); } };
  $('#seedInput').onblur = (e) => { if (e.target.value.trim()) setSeed(e.target.value); else e.target.value = state.params.seed; };
  $('#trackName').oninput = (e) => {
    history.record(state.params, 'Rename', 'name');
    state.params.name = e.target.value || 'Untitled Track'; $('#heroTitle').textContent = state.params.name; saveSession();
  };
  $('#trackName').onchange = () => history.seal();
  $('#trackName').onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
  $('#btnSave').onclick = (e) => saveToLibrary({ asNew: e.shiftKey });
  $('#btnExport').onclick = openExport;
  $('#btnNew').onclick = openWizard;
  $('#exClose').onclick = closeExport; $('#exCancel').onclick = closeExport; $('#exGo').onclick = doExport;
  $('#exportModal').onclick = (e) => { if (e.target.id === 'exportModal' && !ex.busy) closeExport(); };
  $('#btnRandomize').onclick = randomizeMood;
  $('#btnResetStyle').onclick = () => {
    history.seal(); history.record(state.params, 'Reset to defaults', 'reset'); history.seal();
    const pr = PRESETS.find((x) => x.id === state.params.preset);
    if (pr) {
      const seed = state.params.seed;
      state.params = presetParams(pr); state.params.seed = seed;
      player.setParams(state.params); syncAll(); regenerate();
    } else { state.params = applyStyle(state.params, state.params.style, { keepMood: false }); player.setParams(state.params); syncAll(); regenerate(); }
    saveSession();
    toast('Reset to defaults', { action: undoAction });
  };
  $('#autoRegen').onchange = (e) => { state.autoRegen = e.target.checked; if (state.autoRegen && state.stale) regenerate(); };
  $('#presetSearch').oninput = renderPresets;
  document.querySelectorAll('.tab').forEach((t) => t.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', String(x === t)); });
    $('#pane-themes').classList.toggle('hidden', t.dataset.tab !== 'themes');
    $('#pane-library').classList.toggle('hidden', t.dataset.tab !== 'library');
  });
  $('#btnImport').onclick = importFile;
  $('#btnExportLib').onclick = async () => {
    if (!state.library.length) return toast('Library is empty');
    const path = await saveFile('motivo_library.json', JSON.stringify(state.library, null, 2), [{ name: 'JSON', extensions: ['json'] }]);
    if (path) toast('Library backed up · ' + path);
  };

  document.addEventListener('keydown', (e) => {
    if (wizard?.isOpen) { wizard.onKey(e); return; }
    const el = document.activeElement;
    const textEntry = /INPUT|SELECT|TEXTAREA/.test(el?.tagName) && el.type !== 'range' && el.type !== 'checkbox';
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') { if ($('#exportModal').classList.contains('open')) closeExport(); else el?.blur(); return; }
    if (mod && k === 's') { e.preventDefault(); saveToLibrary({ asNew: e.shiftKey }); return; }
    if (mod && k === 'e') { e.preventDefault(); openExport(); return; }
    // Text fields keep their own undo; everywhere else it's the track's history.
    if (mod && !textEntry && ((k === 'z' && e.shiftKey) || k === 'y')) { e.preventDefault(); redo(); return; }
    if (mod && !textEntry && k === 'z') { e.preventDefault(); undo(); return; }
    if (textEntry || mod || e.altKey) return;
    if ($('#exportModal').classList.contains('open')) { if (e.key === 'Enter' && el?.tagName !== 'BUTTON') doExport(); return; }
    // Enter/Space on a focused button or list item activates it, not playback.
    if (e.code === 'Space' && (el?.tagName === 'BUTTON' || el?.getAttribute('role') === 'button')) return;
    if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
    else if (k === 'g') newVariation();
    else if (k === 'r') randomizeMood();
    else if (k === 'e') openExport();
    else if (k === 'n') openWizard();
    else if (e.key === 'Home' || k === '0') player.seek(0);
  });

  labelIconButtons();
  kick();
  status('Ready — pick a theme or press Space to play');
}

boot().catch((e) => { console.error(e); toast('Startup error: ' + e.message, { err: true }); });
