// "New track" wizard: purpose → setting → feel → length → pick a variation.
// The mapping lives in core/wizard.js; this file is only the dialog.
import { PURPOSES, purposeById, TEMPOS, wizardBase, wizardToParams, tempoFor } from '../core/wizard.js';
import { PRESETS } from '../core/presets.js';
import { STYLES } from '../core/styles.js';
import { planLength } from '../core/generator.js';
import { randomSeed } from '../core/rng.js';
import { icon } from './icons.js';

const STEPS = ['Purpose', 'Setting', 'Feel', 'Length', 'Pick one'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const moodWords = (e, b) => `${e < 25 ? 'Calm' : e < 50 ? 'Relaxed' : e < 75 ? 'Lively' : 'Intense'} and ${b < 25 ? 'dark' : b < 50 ? 'moody' : b < 75 ? 'warm' : 'bright'}`;

export class Wizard {
  // deps: { generate(params, opts) → Promise<song>, preview(params, song), stopPreview(), restore(), apply(params, song), master() }
  constructor(deps) {
    this.deps = deps;
    this.el = document.createElement('div');
    this.el.className = 'modal-bg';
    this.el.id = 'wizardModal';
    this.el.innerHTML = `
      <div class="modal wz" role="dialog" aria-modal="true" aria-labelledby="wzTitle">
        <div class="modal-h">
          <div><div class="modal-title" id="wzTitle">New track</div><div class="wz-steps" id="wzSteps"></div></div>
          <button type="button" class="btn icon ghost" id="wzClose" title="Close" aria-label="Close">${icon('x', 16)}</button>
        </div>
        <div class="modal-b wz-body" id="wzBody"></div>
        <div class="modal-f">
          <button type="button" class="btn ghost wz-skip" id="wzSkip">Open the editor instead</button>
          <span style="flex:1"></span>
          <button type="button" class="btn" id="wzBack">Back</button>
          <button type="button" class="btn primary" id="wzNext">Next</button>
        </div>
      </div>`;
    document.body.append(this.el);
    this.$ = (s) => this.el.querySelector(s);
    this.$('#wzClose').onclick = () => this.close();
    this.$('#wzSkip').onclick = () => this.close();
    this.$('#wzBack').onclick = () => this.go(this.step - 1);
    this.$('#wzNext').onclick = () => this.next();
    this.el.onclick = (e) => { if (e.target === this.el) this.close(); };
  }

  get isOpen() { return this.el.classList.contains('open'); }

  open() {
    this.a = { purpose: null, preset: null, style: null, energy: undefined, brightness: undefined, tempo: 'default', length: null };
    this.cands = null; this.sel = 0; this.playing = -1; this.showAll = false;
    this.el.classList.add('open');
    this.go(0);
  }

  close({ applied = false } = {}) {
    if (!this.isOpen) return;
    this.el.classList.remove('open');
    if (!applied && this.previewed) this.deps.restore();
    this.previewed = false; this.playing = -1;
  }

  go(step) {
    if (step < 0) return;
    if (step > 0 && !this.a.purpose) return;
    if (step > 1 && !this.a.preset && !this.a.style) return;
    if (this.step === 4 && step !== 4 && this.playing >= 0) { this.deps.stopPreview(); this.playing = -1; }
    this.step = step;
    this.$('#wzSteps').innerHTML = STEPS.map((s, i) => `<span class="${i === step ? 'on' : i < step ? 'done' : ''}">${i + 1}. ${s}</span>`).join('<i></i>');
    this.$('#wzBack').classList.toggle('hidden', step === 0);
    this.$('#wzNext').innerHTML = step === 4 ? `${icon('check', 15)}Use this track` : 'Next';
    this[`step${step}`]();
    this.syncNext();
    const first = this.$('#wzBody').querySelector('.on, button, [tabindex]');
    if (first) setTimeout(() => first.focus(), 0);
  }
  syncNext() {
    const ok = [this.a.purpose, this.a.preset || this.a.style, true, this.a.length, this.cands && this.cands[this.sel]?.song][this.step];
    this.$('#wzNext').disabled = !ok;
  }
  next() {
    if (this.$('#wzNext').disabled) return;
    if (this.step < 4) { this.go(this.step + 1); return; }
    const c = this.cands[this.sel];
    this.deps.apply(c.params, c.song);
    this.close({ applied: true });
  }

  // Cards are buttons in a radio group: click or Enter selects, double-click advances.
  cards(items, selected, onPick, cls = '') {
    const wrap = document.createElement('div');
    wrap.className = 'wz-cards ' + cls;
    wrap.setAttribute('role', 'radiogroup');
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wz-card' + (it.id === selected ? ' on' : '');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(it.id === selected));
      b.innerHTML = `<span class="wz-ic" ${it.bg ? `style="background:${it.bg}"` : ''}>${icon(it.icon, 18)}</span><span class="wz-t"><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></span>`;
      b.onclick = () => { onPick(it.id); wrap.querySelectorAll('.wz-card').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); this.syncNext(); };
      b.ondblclick = () => this.next();
      wrap.append(b);
    }
    return wrap;
  }

  step0() {
    const body = this.$('#wzBody');
    body.innerHTML = '<div class="wz-q">What is the music for?</div>';
    body.append(this.cards(PURPOSES.map((p) => ({ id: p.id, label: p.label, sub: p.desc, icon: p.icon })), this.a.purpose, (id) => {
      if (this.a.purpose !== id) Object.assign(this.a, { purpose: id, preset: null, style: null, length: null, energy: undefined, brightness: undefined });
    }, 'list'));
  }

  step1() {
    const pu = purposeById(this.a.purpose);
    const body = this.$('#wzBody');
    body.innerHTML = '<div class="wz-q">Pick a setting</div><div class="wz-h">Themes</div>';
    const pick = (fn) => (id) => { fn(id); this.a.energy = this.a.brightness = undefined; this.cands = null; };
    const list = this.showAll ? [...pu.presets.map((id) => PRESETS.find((x) => x.id === id)), ...PRESETS.filter((x) => !pu.presets.includes(x.id))] : pu.presets.map((id) => PRESETS.find((x) => x.id === id));
    const themes = this.cards(list.map((pr) => ({ id: pr.id, label: pr.name, sub: pr.use, icon: pr.icon, bg: `linear-gradient(135deg,${pr.colors[0]},${pr.colors[1]})` })),
      this.a.preset, pick((id) => { this.a.preset = id; this.a.style = null; body.querySelectorAll('.wz-genres .wz-card').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); }); }), 'grid');
    body.append(themes);
    const more = document.createElement('button');
    more.type = 'button'; more.className = 'wz-link';
    more.textContent = this.showAll ? 'Show only suggested themes' : `Show all ${PRESETS.length} themes`;
    more.onclick = () => { this.showAll = !this.showAll; this.step1(); };
    body.append(more);
    const h = document.createElement('div'); h.className = 'wz-h'; h.textContent = '…or just a genre';
    body.append(h);
    body.append(this.cards(pu.styles.map((id) => ({ id, label: STYLES[id].name, sub: STYLES[id].desc.split('.')[0], icon: 'music' })),
      this.a.style, pick((id) => { this.a.style = id; this.a.preset = null; themes.querySelectorAll('.wz-card').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); }); }), 'grid wz-genres'));
  }

  base() { return wizardBase(this.a, { master: this.deps.master() }); }

  step2() {
    const base = this.base();
    const e = this.a.energy ?? base.energy, b = this.a.brightness ?? base.brightness;
    const body = this.$('#wzBody');
    body.innerHTML = `<div class="wz-q">How should it feel?</div>
      <div class="wz-feel">
        <div class="wz-pad-wrap">
          <span class="wz-ax top">Bright</span><span class="wz-ax bottom">Dark</span><span class="wz-ax left">Calm</span><span class="wz-ax right">Intense</span>
          <div class="wz-pad" id="wzPad" role="slider" tabindex="0" aria-label="Mood: energy and brightness" aria-valuetext="${moodWords(e, b)}">
            <div class="wz-home" id="wzHome" title="Theme default"></div><div class="wz-knob" id="wzKnob"></div>
          </div>
        </div>
        <div class="wz-side">
          <div class="wz-mood" id="wzMood"></div>
          <div class="wz-sub">Drag the dot, or use the arrow keys. The ring marks the theme's own mood.</div>
          <button type="button" class="wz-link" id="wzMoodReset">Back to the theme's mood</button>
          <div class="wz-h">Tempo</div>
          <div class="seg" role="group" aria-label="Tempo" id="wzTempo">${TEMPOS.map((t) => `<button type="button" data-v="${t.id}">${t.label}<small>${tempoFor(base, t.id)} BPM</small></button>`).join('')}</div>
        </div>
      </div>`;
    const pad = this.$('#wzPad'), knob = this.$('#wzKnob'), home = this.$('#wzHome');
    home.style.left = base.energy + '%'; home.style.top = (100 - base.brightness) + '%';
    const draw = () => {
      const ee = this.a.energy ?? base.energy, bb = this.a.brightness ?? base.brightness;
      knob.style.left = ee + '%'; knob.style.top = (100 - bb) + '%';
      this.$('#wzMood').textContent = moodWords(ee, bb);
      pad.setAttribute('aria-valuetext', `${moodWords(ee, bb)} (energy ${ee}, brightness ${bb})`);
      this.cands = null;
    };
    const set = (ev) => {
      const r = pad.getBoundingClientRect();
      this.a.energy = Math.round(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * 100);
      this.a.brightness = Math.round((1 - Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))) * 100);
      draw();
    };
    let drag = false;
    pad.onpointerdown = (ev) => { drag = true; pad.setPointerCapture(ev.pointerId); set(ev); };
    pad.onpointermove = (ev) => { if (drag) set(ev); };
    pad.onpointerup = pad.onpointercancel = () => { drag = false; };
    pad.onkeydown = (ev) => {
      const d = ev.shiftKey ? 10 : 4;
      const mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[ev.key];
      if (!mv) return;
      ev.preventDefault(); ev.stopPropagation();
      this.a.energy = Math.max(0, Math.min(100, (this.a.energy ?? base.energy) + mv[0]));
      this.a.brightness = Math.max(0, Math.min(100, (this.a.brightness ?? base.brightness) + mv[1]));
      draw();
    };
    this.$('#wzMoodReset').onclick = () => { this.a.energy = this.a.brightness = undefined; draw(); };
    const tempo = this.$('#wzTempo');
    const syncTempo = () => tempo.querySelectorAll('button').forEach((x) => { const on = x.dataset.v === this.a.tempo; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    tempo.querySelectorAll('button').forEach((x) => { x.onclick = () => { this.a.tempo = x.dataset.v; this.cands = null; syncTempo(); }; });
    syncTempo(); draw();
  }

  step3() {
    const pu = purposeById(this.a.purpose);
    if (!this.a.length) this.a.length = pu.defaultLength;
    const body = this.$('#wzBody');
    body.innerHTML = `<div class="wz-q">How long?</div>`;
    const items = pu.lengths.map((l) => {
      const p = wizardToParams({ ...this.a, length: l.id });
      const pl = planLength(p);
      return { id: l.id, label: l.label, sub: `${l.sub} · ${fmtTime(pl.seconds)}, ${pl.bars} bars`, icon: l.mode === 'evolve' ? 'infinity' : pu.mode === 'oneshot' ? 'arrow' : 'repeat' };
    });
    body.append(this.cards(items, this.a.length, (id) => { this.a.length = id; this.cands = null; }, 'list'));
    if (pu.mode === 'oneshot') body.insertAdjacentHTML('beforeend', '<div class="wz-sub">Plays once with an ending — for jingles and scenes. You can switch to a loop later in <b>Length &amp; Looping</b>.</div>');
    else body.insertAdjacentHTML('beforeend', '<div class="wz-sub">Loops seamlessly in your game engine. <b>Endless</b> keeps varying every cycle — best for long fights and exploration.</div>');
  }

  async step4() {
    const body = this.$('#wzBody');
    body.innerHTML = `<div class="wz-q">Pick your favourite <button type="button" class="btn sm" id="wzReroll">${icon('dice', 14)}Three more</button></div>
      <div class="wz-sub">Same choices, three different seeds. Press play to listen; everything can be fine-tuned afterwards in the Parameters panel.</div>
      <div class="wz-vars" id="wzVars"></div>`;
    this.$('#wzReroll').onclick = () => { this.cands = null; this.sel = 0; this.step4(); };
    if (!this.cands) {
      const token = (this._tok = (this._tok || 0) + 1);
      this.cands = [0, 1, 2].map(() => ({ params: wizardToParams(this.a, { seed: randomSeed(), master: this.deps.master() }), song: null }));
      this.renderVars();
      await Promise.all(this.cands.map(async (c) => { c.song = await this.deps.generate(c.params, { cycle: 0 }); }));
      if (token !== this._tok || this.step !== 4) return;
    }
    this.renderVars(); this.syncNext();
  }

  renderVars() {
    const root = this.$('#wzVars');
    if (!root) return;
    root.innerHTML = '';
    root.setAttribute('role', 'radiogroup');
    this.cands.forEach((c, i) => {
      const s = c.song;
      const d = document.createElement('div');
      d.className = 'wz-var' + (i === this.sel ? ' on' : '');
      d.tabIndex = 0; d.setAttribute('role', 'radio'); d.setAttribute('aria-checked', String(i === this.sel));
      d.setAttribute('aria-label', `Variation ${i + 1}`);
      d.innerHTML = `<button type="button" class="wz-play" aria-label="${this.playing === i ? 'Stop' : 'Play'} variation ${i + 1}" ${s ? '' : 'disabled'}>${icon(this.playing === i ? 'stop' : 'play', 16)}</button>
        <div class="wz-vt"><b>Variation ${i + 1}</b><small>${esc(c.params.seed)}</small></div>
        <div class="wz-vm">${s ? `${esc(s.keyName)} ${esc(s.scaleName)}<br>${s.bpm} BPM · ${fmtTime(s.duration)} · ${s.totalBars} bars` : 'Composing…'}</div>`;
      d.onclick = (ev) => {
        this.sel = i; this.syncNext();
        if (ev.target.closest('.wz-play') || this.playing >= 0) this.toggle(i, ev.target.closest('.wz-play') != null);
        else this.renderVars();
      };
      d.ondblclick = (ev) => { if (!ev.target.closest('.wz-play')) this.next(); };
      d.onkeydown = (ev) => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); this.sel = i; if (ev.key === 'Enter') this.next(); else this.toggle(i, true); } };
      root.append(d);
    });
  }

  // Play/stop a variation through the main player. Selecting another card
  // while one is playing switches playback to it.
  toggle(i, fromButton) {
    const c = this.cands[i];
    if (!c.song) return;
    if (this.playing === i && !fromButton) { this.renderVars(); return; }
    if (this.playing === i) { this.deps.stopPreview(); this.playing = -1; }
    else { this.deps.preview(c.params, c.song); this.previewed = true; this.playing = i; }
    this.renderVars();
    const el = this.$('#wzVars').children[i]; if (el) el.focus();
  }

  // Keys while the dialog is open (called by the app's global key handler).
  onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    const t = document.activeElement;
    if (e.key === 'Enter' && !(t && (t.tagName === 'BUTTON' || t.getAttribute('role') === 'radio' || t.getAttribute('role') === 'slider'))) { e.preventDefault(); this.next(); return; }
    if (this.step === 4 && e.code === 'Space' && !(t && t.tagName === 'BUTTON')) { e.preventDefault(); this.toggle(this.sel, true); }
  }
}
