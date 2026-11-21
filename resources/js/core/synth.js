// Web Audio synthesis: instruments, drum kits, ambience and the mix/FX graph.
// Used both for live playback (AudioContext) and export (OfflineAudioContext).

import { INSTRUMENTS, KITS } from './instruments.js';
import { midiToFreq } from './theory.js';
import { RNG } from './rng.js';
import { LAYER_IDS } from './styles.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
let NYQ = 20000;
const REV_SEND = { pad: 0.9, chords: 0.6, bass: 0.08, lead: 0.7, arp: 0.8, drums: 0.22, ambience: 0.6 };
const DLY_SEND = { pad: 0.15, chords: 0.3, bass: 0, lead: 0.55, arp: 0.75, drums: 0.04, ambience: 0.25 };
const PUMPED = new Set(['pad', 'chords', 'bass', 'arp']);
const DELAY_DIV = { off: 0, '16': 0.25, '8': 0.5, d8: 0.75, '4': 1, d4: 1.5 };

function makeWave(ctx, fn, H = 48) {
  const N = 1024, x = new Float32Array(N);
  for (let i = 0; i < N; i++) x[i] = fn(i / N);
  const re = new Float32Array(H), im = new Float32Array(H);
  for (let k = 1; k < H; k++) {
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) { const ph = 2 * Math.PI * k * i / N; a += x[i] * Math.cos(ph); b += x[i] * Math.sin(ph); }
    re[k] = a * 2 / N; im[k] = b * 2 / N;
  }
  return ctx.createPeriodicWave(re, im);
}
const hashPan = (t, salt = 0) => { const s = Math.sin(t * 12.9898 + salt * 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };

export class Synth {
  constructor(ctx, { offline = false, loopSec = null, soloLayer = null } = {}) {
    this.ctx = ctx; NYQ = ctx.sampleRate / 2 - 100; this.offline = offline; this.loopSec = loopSec; this.soloLayer = soloLayer;
    this.p = null; this.bpm = 100; this.keyPc = 0; this.bright = 1; this.pump = 0;
    const tri4 = (t) => Math.round(((1 - 4 * Math.abs(t - 0.5)) + 1) * 7.5) / 7.5 - 1;
    this.waves = {
      pulse50: makeWave(ctx, (t) => (t < 0.5 ? 1 : -1)),
      pulse25: makeWave(ctx, (t) => (t < 0.25 ? 1 : -1)),
      pulse125: makeWave(ctx, (t) => (t < 0.125 ? 1 : -1)),
      chipTri: makeWave(ctx, tri4),
      organ: makeWave(ctx, (t) => [1, 0.6, 0.4, 0.3, 0, 0.15, 0, 0.1].reduce((s, a, k) => s + a * Math.sin(2 * Math.PI * (k + 1) * t), 0) / 2),
      piano: makeWave(ctx, (t) => { let s = 0; for (let k = 1; k <= 10; k++) s += Math.sin(2 * Math.PI * k * t) / Math.pow(k, 1.4) * (k === 7 ? 0.3 : 1); return s / 1.6; }),
    };
    const nr = new RNG('noise');
    this.noise = this._buffer(2, () => nr.float(-1, 1));
    let hold = 0;
    this.chipNoise = this._buffer(1, (i) => { if (i % 6 === 0) hold = nr.chance(0.5) ? 1 : -1; return hold; });
    this.voices = [];
    this.beds = null;
    this.audible = {};
    this._build();
  }

  _buffer(sec, fn) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = fn(i);
    return b;
  }
  lfoRate(r) {
    if (!this.loopSec) return r;
    return Math.max(1, Math.round(r * this.loopSec)) / this.loopSec;
  }

  _build() {
    const c = this.ctx;
    this.mix = c.createGain();
    // master chain
    this.wow = c.createDelay(0.1); this.wow.delayTime.value = 0.006;
    this.wowLfo = c.createOscillator(); this.wowLfo.frequency.value = this.lfoRate(0.55);
    this.wowDepth = c.createGain(); this.wowDepth.gain.value = 0;
    this.wowLfo.connect(this.wowDepth).connect(this.wow.delayTime); this.wowLfo.start();
    this.shaper = c.createWaveShaper(); this.shaper.oversample = '2x';
    this.lofiLP = c.createBiquadFilter(); this.lofiLP.type = 'lowpass'; this.lofiLP.frequency.value = NYQ; this.lofiLP.Q.value = 0.5;
    this.warm = c.createBiquadFilter(); this.warm.type = 'lowpass'; this.warm.frequency.value = NYQ; this.warm.Q.value = 0.4;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.knee.value = 12; this.comp.ratio.value = 3; this.comp.attack.value = 0.008; this.comp.release.value = 0.22;
    this.out = c.createGain();
    this.mix.connect(this.wow).connect(this.shaper).connect(this.lofiLP).connect(this.warm).connect(this.comp).connect(this.out);
    if (!this.offline) {
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.78;
      this.out.connect(this.analyser);
    }
    this.out.connect(c.destination);

    // reverb
    this.revIn = c.createGain();
    this.conv = c.createConvolver();
    this.revRet = c.createGain();
    this.revIn.connect(this.conv).connect(this.revRet).connect(this.mix);
    // ping-pong delay
    this.dIn = c.createGain();
    this.dL = c.createDelay(4); this.dR = c.createDelay(4);
    this.fb1 = c.createGain(); this.fb2 = c.createGain();
    this.dLP = c.createBiquadFilter(); this.dLP.type = 'lowpass'; this.dLP.frequency.value = 3800;
    const merger = c.createChannelMerger(2);
    this.dRet = c.createGain();
    this.dIn.connect(this.dL);
    this.dL.connect(merger, 0, 0); this.dR.connect(merger, 0, 1);
    this.dL.connect(this.fb1).connect(this.dLP).connect(this.dR);
    this.dR.connect(this.fb2).connect(this.dL);
    merger.connect(this.dRet).connect(this.mix);
    this.dRetRev = c.createGain(); this.dRetRev.gain.value = 0.25;
    merger.connect(this.dRetRev).connect(this.revIn);

    // pump (sidechain-style ducking)
    this.pumpGain = c.createGain();
    this.pumpGain.connect(this.mix);

    // layers
    this.layers = {};
    for (const id of LAYER_IDS) {
      const L = { in: c.createGain(), pan: c.createStereoPanner(), rev: c.createGain(), dly: c.createGain() };
      L.in.connect(L.pan);
      L.pan.connect(PUMPED.has(id) ? this.pumpGain : this.mix);
      L.pan.connect(L.rev).connect(this.revIn);
      L.pan.connect(L.dly).connect(this.dIn);
      if (!this.offline) { L.meter = c.createAnalyser(); L.meter.fftSize = 512; L.pan.connect(L.meter); }
      this.layers[id] = L;
    }
    this.drumBus = c.createBiquadFilter(); this.drumBus.type = 'lowpass'; this.drumBus.frequency.value = NYQ;
    this.drumBus.connect(this.layers.drums.in);
    this.bedGain = c.createGain();
    this.bedGain.connect(this.layers.ambience.in);
  }

  _set(param, v, tc = 0.04) {
    if (this.offline) param.value = v;
    else param.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  setParams(p, { bpm, keyPc } = {}) {
    const prev = this.p;
    this.p = p;
    if (bpm) this.bpm = bpm;
    if (keyPc != null) this.keyPc = keyPc;
    this.bright = 0.55 + (p.brightness / 100) * 0.95;
    this.pump = p.pump / 100;
    const anySolo = LAYER_IDS.some((id) => p.layers[id]?.solo);
    const w = p.width / 100;
    for (const id of LAYER_IDS) {
      const lp = p.layers[id] || { vol: 0.8 };
      const L = this.layers[id];
      let on = !lp.mute && (!anySolo || lp.solo);
      if (this.soloLayer) on = id === this.soloLayer;
      this.audible[id] = on && lp.vol > 0.001;
      this._set(L.in.gain, on ? Math.pow(lp.vol, 1.6) * 1.2 : 0);
      this._set(L.pan.pan, clamp((lp.pan || 0) * w, -1, 1));
      this._set(L.rev.gain, REV_SEND[id]);
      this._set(L.dly.gain, DLY_SEND[id]);
    }
    const kit = KITS[p.layers.drums?.inst] || KITS.electro;
    this._set(this.drumBus.frequency, Math.min(NYQ, kit.lp || 20000));
    this._set(this.revRet.gain, Math.pow(p.reverbMix / 100, 1.3) * 1.4);
    const div = DELAY_DIV[p.delay] || 0;
    const dt = div * 60 / this.bpm;
    if (div) { this._set(this.dL.delayTime, dt, 0.02); this._set(this.dR.delayTime, dt, 0.02); }
    this._set(this.dRet.gain, div ? Math.pow(p.delayMix / 100, 1.2) * 1.2 : 0);
    this._set(this.fb1.gain, (p.delayFb / 100) * 0.85);
    this._set(this.fb2.gain, (p.delayFb / 100) * 0.85);
    const wf = 1600 * Math.pow(20000 / 1600, 1 - p.warmth / 100);
    this._set(this.warm.frequency, Math.min(NYQ, wf));
    const lofi = p.lofi / 100;
    this._set(this.lofiLP.frequency, Math.min(NYQ, 20000 * Math.pow(4200 / 20000, lofi)));
    this._set(this.wowDepth.gain, lofi * 0.0018);
    if (!prev || prev.lofi !== p.lofi || !this.shaper.curve) this.shaper.curve = this._satCurve(lofi);
    this._set(this.out.gain, Math.pow(p.master / 100, 1.5) * 1.1);
    this._set(this.bedGain.gain, Math.pow(p.bedLevel / 100, 1.4) * 1.2);
    if (!prev || prev.reverbSize !== p.reverbSize || !this.conv.buffer) this.conv.buffer = this._ir(p.reverbSize);
  }

  _satCurve(amt) {
    const n = 2048, curve = new Float32Array(n), k = amt * 6;
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = k > 0 ? Math.tanh(x * (1 + k)) / Math.tanh(1 + k) : x; }
    return curve;
  }

  _ir(size) {
    const sr = this.ctx.sampleRate;
    const len = 0.5 + (size / 100) * 6.5;
    const N = Math.floor(sr * len), pre = Math.floor(sr * (0.008 + size / 100 * 0.025));
    const buf = this.ctx.createBuffer(2, N + pre, sr);
    const r = new RNG('ir-' + size);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < N; i++) {
        const t = i / N;
        const a = 0.85 - 0.75 * t;
        y += a * (r.float(-1, 1) - y);
        d[i + pre] = y * Math.exp(-6.9 * t) * (i < 300 ? i / 300 : 1);
      }
    }
    return buf;
  }

  // ── Tonal voices ──────────────────────────────────────────────────────
  note(layer, instId, time, dur, midi, vel, pan = 0) {
    const def = INSTRUMENTS[instId];
    if (!def) return;
    const c = this.ctx;
    const f = midiToFreq(midi);
    const env = def.env;
    const a = Math.min(env.a, Math.max(0.003, dur * 0.9));
    const peak = vel * def.level;
    const off = time + Math.max(dur, a);
    let end = off + env.r * 1.6 + 0.05;
    if (env.s === 0) end = Math.min(end, time + a + env.d * 1.6 + 0.05);

    const amp = c.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(peak, time + a);
    if (env.s < 1) amp.gain.setTargetAtTime(peak * env.s, time + a, env.d / 3);
    if (env.s > 0 || off < time + a + env.d * 2) amp.gain.setTargetAtTime(0, off, env.r / 4);

    const vmix = c.createGain();
    let head = vmix;
    const oscs = [];
    let vib = null, fmMod = null;
    if (def.vib && dur > (def.vib.delay || 0) + 0.08) {
      const lfo = c.createOscillator(); lfo.frequency.value = def.vib.rate;
      const g = c.createGain();
      if (def.vib.delay) { g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(def.vib.depth, time + def.vib.delay + 0.2); }
      else g.gain.value = def.vib.depth;
      lfo.connect(g); vib = g; oscs.push(lfo);
    }
    if (def.fm) {
      const m = c.createOscillator(); m.frequency.value = Math.min(NYQ, f * def.fm.ratio);
      const mg = c.createGain();
      mg.gain.setValueAtTime(def.fm.index * f, time);
      mg.gain.setTargetAtTime(def.fm.index * f * 0.08, time, def.fm.decay / 3);
      m.connect(mg); fmMod = mg; oscs.push(m);
    }
    const oscDefs = def.tine ? def.osc.concat([{ type: 'sine', mult: 4.02, gain: def.tine, decay: 0.05 }]) : def.osc;
    for (const o of oscDefs) {
      const osc = c.createOscillator();
      if (this.waves[o.type]) osc.setPeriodicWave(this.waves[o.type]); else osc.type = o.type;
      osc.frequency.value = Math.min(NYQ, f * (o.mult || 1));
      const det = o.detune || 0;
      if (def.bend) { osc.detune.setValueAtTime(det + def.bend.semis * 100, time); osc.detune.linearRampToValueAtTime(det, time + def.bend.time); }
      else osc.detune.value = det;
      if (vib) vib.connect(osc.detune);
      if (fmMod) fmMod.connect(osc.frequency);
      const og = c.createGain();
      const g0 = o.gain ?? 1;
      if (o.decay) { og.gain.setValueAtTime(g0, time); og.gain.setTargetAtTime(0, time, o.decay); } else og.gain.value = g0;
      osc.connect(og).connect(vmix);
      oscs.push(osc);
    }
    if (def.breath) {
      const n = c.createBufferSource(); n.buffer = this.noise; n.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, NYQ, f * 3); bp.Q.value = 1.2;
      const g = c.createGain(); g.gain.value = def.breath * 3;
      n.connect(bp).connect(g).connect(vmix);
      oscs.push(n);
    }
    if (def.filter) {
      const fl = c.createBiquadFilter(); fl.type = def.filter.type || 'lowpass'; fl.Q.value = def.filter.q ?? 0.7;
      const base = clamp(def.filter.freq * this.bright * Math.pow(f / 261.6, def.filter.key || 0), 40, NYQ);
      if (def.filter.env) {
        const pk = clamp(base * (1 + def.filter.env * vel), 40, NYQ);
        const fa = def.filter.a || 0.002;
        fl.frequency.setValueAtTime(base, time);
        fl.frequency.linearRampToValueAtTime(pk, time + fa);
        fl.frequency.exponentialRampToValueAtTime(base, time + fa + (def.filter.decay || 0.3));
      } else fl.frequency.value = base;
      if (def.filter.lfo) {
        const lfo = c.createOscillator(); lfo.frequency.value = this.lfoRate(def.filter.lfo.rate);
        const lg = c.createGain(); lg.gain.value = def.filter.lfo.depth;
        lfo.connect(lg).connect(fl.frequency); oscs.push(lfo);
      }
      head.connect(fl); head = fl;
    }
    if (def.formants) {
      const sum = c.createGain();
      for (const [ff, q, g] of def.formants) {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff * (0.9 + this.bright * 0.1); bp.Q.value = q;
        const gg = c.createGain(); gg.gain.value = g;
        head.connect(bp).connect(gg).connect(sum);
      }
      head = sum;
    }
    if (def.hp) { const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = def.hp; head.connect(hp); head = hp; }
    head.connect(amp);
    let tail = amp;
    if (def.trem && dur > 0.3) {
      const tg = c.createGain(); tg.gain.value = 1 - def.trem.depth / 2;
      const lfo = c.createOscillator(); lfo.frequency.value = def.trem.rate;
      const lg = c.createGain(); lg.gain.value = def.trem.depth / 2;
      lfo.connect(lg).connect(tg.gain); oscs.push(lfo);
      tail.connect(tg); tail = tg;
    }
    if (pan) {
      const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
      tail.connect(p); tail = p;
    }
    tail.connect(this.layers[layer].in);
    for (const o of oscs) { o.start(time); o.stop(end); }
    this._track(amp, end, tail);
  }

  // Track voices so they can be silenced (live) and detached once finished,
  // which keeps the audio graph small during long renders.
  _track(gainNode, end, out = gainNode) {
    this.voices.push({ g: gainNode, end, out });
  }
  cleanup(now = this.ctx.currentTime) {
    const keep = [];
    for (const v of this.voices) {
      if (v.end < now - 0.05) { try { v.out.disconnect(); } catch (e) { /* noop */ } }
      else keep.push(v);
    }
    this.voices = keep;
  }

  // Quickly fade every scheduled/active voice (seek, stop, regenerate).
  silence(fade = 0.04) {
    const now = this.ctx.currentTime;
    for (const v of this.voices) {
      if (v.end <= now) continue;
      try { v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(v.g.gain.value, now); v.g.gain.setTargetAtTime(0, now, fade); } catch (e) { /* ignore */ }
      v.end = Math.min(v.end, now + fade * 8);
    }
    this.pumpGain.gain.cancelScheduledValues(now);
    this.pumpGain.gain.setValueAtTime(1, now);
  }

  // ── Drums ─────────────────────────────────────────────────────────────
  _noiseSrc(time, dur, chip = false) {
    const s = this.ctx.createBufferSource(); s.buffer = chip ? this.chipNoise : this.noise; s.loop = true;
    s.start(time, (time * 7.31) % 1); s.stop(time + dur + 0.05);
    return s;
  }
  _env(time, peak, decay, attack = 0.001) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, time + attack + decay);
    this._track(g, time + attack + decay + 0.05);
    return g;
  }
  _filt(type, freq, q = 0.7) { const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = Math.min(freq, NYQ); f.Q.value = q; return f; }

  drum(kitId, voice, time, vel) {
    const kit = KITS[kitId] || KITS.electro;
    const c = this.ctx, out = this.drumBus;
    const v = vel * (kit.gain || 1);
    const chip = !!kit.chip;
    const tone = (type, f0, f1, pd, decay, peak) => {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, time); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), time + pd);
      const g = this._env(time, peak, decay);
      o.connect(g).connect(out); o.start(time); o.stop(time + decay + 0.1);
    };
    const noise = (filters, decay, peak, attack = 0.001) => {
      const s = this._noiseSrc(time, attack + decay, chip);
      let h = s; for (const f of filters) { h.connect(f); h = f; }
      const g = this._env(time, peak, decay, attack); h.connect(g).connect(out);
    };
    switch (voice) {
      case 'kick': {
        const k = kit.kick;
        tone(chip ? 'square' : 'sine', k.f0, k.f1, k.pd, k.decay, v * (chip ? 0.35 : 1.1));
        if (k.click) noise([this._filt('highpass', 2500)], 0.012, v * k.click * 0.5);
        break;
      }
      case 'snare': {
        const s = kit.snare;
        if (chip) { noise([this._filt('highpass', 1200)], s.decay, v * 0.5); break; }
        noise([this._filt('highpass', 900), this._filt('peaking', s.bp, 1)], s.decay, v * 0.55);
        tone('triangle', s.tone * 1.4, s.tone, 0.03, s.decay * 0.6, v * s.toneAmt);
        break;
      }
      case 'clap': {
        const s = kit.clap;
        for (let i = 0; i < 3; i++) {
          const t = time + i * 0.011;
          const src = this._noiseSrc(t, 0.02 + (i === 2 ? s.decay : 0), chip);
          const bp = this._filt('bandpass', s.bp, 1.4);
          const g = c.createGain();
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.9, t + 0.001);
          g.gain.exponentialRampToValueAtTime(0.001, t + (i === 2 ? s.decay : 0.012));
          src.connect(bp).connect(g).connect(out); this._track(g, t + 0.25);
        }
        break;
      }
      case 'hat': case 'ohat': case 'ride': {
        const h = kit[voice === 'ride' ? 'ohat' : voice] || kit.hat;
        if (chip) { noise([this._filt('highpass', 6000)], h.decay, v * 0.3); break; }
        noise([this._filt('highpass', h.hp), this._filt('peaking', 10000, 1)], voice === 'ride' ? 0.5 : h.decay, v * (voice === 'hat' ? 0.3 : 0.24));
        break;
      }
      case 'crash':
        noise([this._filt('highpass', chip ? 3000 : 4500)], chip ? 0.4 : 1.7, v * 0.26);
        break;
      case 'tomL': case 'tomH': {
        const f = voice === 'tomL' ? 110 : 175;
        tone(chip ? 'triangle' : 'sine', f * 1.5, f, 0.12, voice === 'tomL' ? 0.45 : 0.32, v * 0.8);
        break;
      }
      case 'taiko':
        tone('sine', 95, 48, 0.12, 0.95, v * 1.15);
        noise([this._filt('lowpass', 900)], 0.18, v * 0.4);
        break;
      case 'shaker':
        noise([this._filt('bandpass', 6500, 1.2)], 0.06, v * 0.35, 0.012);
        break;
      case 'rim':
        tone('triangle', 1750, 1650, 0.02, 0.035, v * 0.45);
        noise([this._filt('highpass', 3000)], 0.015, v * 0.2);
        break;
      case 'perc':
        tone('sine', 420, 350, 0.04, 0.14, v * 0.55);
        noise([this._filt('bandpass', 2600, 1)], 0.03, v * 0.25);
        break;
    }
  }

  // ── Ambience ──────────────────────────────────────────────────────────
  sprinkle(ev, time) {
    const c = this.ctx, out = this.layers.ambience.in;
    const pan = hashPan(ev.t, ev.n);
    const p = c.createStereoPanner(); p.pan.value = pan * 0.8; p.connect(out);
    this._track(p, time + (ev.k === 'thunder' ? 6 : ev.k === 'chimes' ? 5 : 2.5));
    const blip = (t, f0, f1, sweep, att, dec, peak, type = 'sine') => {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(Math.min(NYQ, f0), t); o.frequency.exponentialRampToValueAtTime(Math.min(NYQ, f1), t + sweep);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0005, t + att + dec);
      o.connect(g).connect(p); o.start(t); o.stop(t + att + dec + 0.05);
    };
    const v = ev.v;
    switch (ev.k) {
      case 'birds': {
        for (let i = 0; i < ev.c; i++) {
          const t = time + i * 0.1 * ev.s, f = ev.n * (1 + 0.12 * Math.sin(i * 2.1 + ev.n));
          blip(t, f * 0.85, f * 1.3, 0.05, 0.006, 0.06, v * 0.12);
        }
        break;
      }
      case 'drips': case 'dripsLow':
        blip(time, ev.n * 0.6, ev.n * 1.7, 0.035, 0.002, 0.12, v * 0.22);
        break;
      case 'crickets':
        for (let tr = 0; tr < 2; tr++) for (let i = 0; i < ev.c; i++) blip(time + tr * 0.35 + i * 0.03, ev.n, ev.n * 1.01, 0.01, 0.003, 0.018, v * 0.045);
        break;
      case 'stars': {
        const f = midiToFreq(ev.n);
        blip(time, f, f, 0.01, 0.003, 1.6, v * 0.07);
        blip(time, f * 2, f * 2, 0.01, 0.003, 0.7, v * 0.025);
        break;
      }
      case 'chimes': {
        const offs = [0, 2, 4, 7, 9, 12, 14];
        for (let i = 0; i < ev.c; i++) {
          const t = time + i * (0.12 + 0.2 * Math.abs(Math.sin(i * 3.3 + ev.t)));
          const f = midiToFreq(ev.n + offs[(i * 3 + Math.floor(ev.t)) % offs.length]);
          blip(t, f, f, 0.01, 0.002, 2.2, v * 0.05);
          if (f * 2.76 < NYQ) blip(t, f * 2.76, f * 2.76, 0.01, 0.002, 0.5, v * 0.015);
        }
        break;
      }
      case 'bubbles':
        for (let i = 0; i < ev.c; i++) { const f = ev.n * (1 + i * 0.18); blip(time + i * 0.07, f, f * 2.6, 0.06 + i * 0.01, 0.004, 0.07, v * 0.12); }
        break;
      case 'thunder': {
        const s = this._noiseSrc(time, 6);
        const lp = this._filt('lowpass', 160, 0.5);
        const g = c.createGain();
        g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(v * 0.9, time + 0.4); g.gain.exponentialRampToValueAtTime(0.001, time + 5.5);
        s.connect(lp).connect(g).connect(p);
        break;
      }
      case 'crackle': {
        const s = this._noiseSrc(time, 0.01);
        const hp = this._filt('highpass', 1800);
        const g = c.createGain();
        g.gain.setValueAtTime(v * ev.n * 0.35, time); g.gain.exponentialRampToValueAtTime(0.0005, time + 0.004 + ev.n * 0.006);
        s.connect(hp).connect(g).connect(p);
        break;
      }
    }
  }

  startBed(type, time, { fadeIn = 1.5, bedNoiseSec = 8 } = {}) {
    this.stopBed(time);
    if (!type || type === 'none') return;
    const c = this.ctx;
    const nodes = [];
    const bus = c.createGain();
    bus.gain.setValueAtTime(0, time); bus.gain.linearRampToValueAtTime(1, time + fadeIn);
    bus.connect(this.bedGain);
    const nb = this._bedNoise || (this._bedNoise = (() => { const r = new RNG('bed'); return this._buffer(bedNoiseSec, () => r.float(-1, 1)); })());
    const src = (offset = 0) => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; s.start(time, offset); nodes.push(s); return s; };
    const lfo = (rate, depth, target, base) => {
      const o = c.createOscillator(); o.frequency.value = this.lfoRate(rate);
      const g = c.createGain(); g.gain.value = depth;
      if (base != null) target.value = base;
      o.connect(g).connect(target); o.start(time); nodes.push(o);
    };
    const chain = (s, filters, gain) => { let h = s; for (const f of filters) { h.connect(f); h = f; } const g = c.createGain(); g.gain.value = gain; h.connect(g).connect(bus); return g; };
    const F = (t, f, q) => this._filt(t, f, q);
    const tone = (freq, gain) => { const o = c.createOscillator(); o.frequency.value = freq; const g = c.createGain(); g.gain.value = gain; o.connect(g).connect(bus); o.start(time); nodes.push(o); return g; };
    switch (type) {
      case 'wind': {
        const f1 = F('bandpass', 500, 0.9), f2 = F('bandpass', 1300, 2.2);
        const g1 = chain(src(0), [f1], 0.55), g2 = chain(src(3.1), [f2], 0.22);
        lfo(0.07, 320, f1.frequency); lfo(0.11, 600, f2.frequency); lfo(0.05, 0.3, g1.gain); lfo(0.09, 0.12, g2.gain);
        break;
      }
      case 'rain':
        chain(src(0), [F('highpass', 900), F('lowpass', 7500)], 0.32);
        chain(src(2.3), [F('lowpass', 350)], 0.18);
        break;
      case 'ocean': {
        const f = F('lowpass', 700, 0.4);
        const g = chain(src(0), [f], 0.5);
        lfo(0.085, 550, f.frequency); lfo(0.085, 0.42, g.gain);
        chain(src(1.7), [F('highpass', 2500)], 0.03);
        break;
      }
      case 'space': {
        const root = midiToFreq(36 + this.keyPc);
        const a = tone(root, 0.12); tone(root * 1.004, 0.1); tone(root * 1.5, 0.05); tone(root * 2.003, 0.03);
        lfo(0.06, 0.06, a.gain);
        chain(src(0), [F('lowpass', 160)], 0.25);
        break;
      }
      case 'fire':
        chain(src(0), [F('lowpass', 280)], 0.45);
        chain(src(1.1), [F('bandpass', 1100, 0.6)], 0.05);
        break;
      case 'vinyl':
        chain(src(0), [F('highpass', 4200)], 0.05);
        tone(55, 0.008);
        break;
      case 'cave': {
        chain(src(0), [F('lowpass', 170)], 0.6);
        const f = F('bandpass', 320, 3); const g = chain(src(2.2), [f], 0.15);
        lfo(0.06, 120, f.frequency); lfo(0.04, 0.08, g.gain);
        break;
      }
      case 'night':
        chain(src(0), [F('bandpass', 750, 0.5)], 0.1);
        chain(src(1.4), [F('lowpass', 130)], 0.12);
        break;
      case 'city': {
        chain(src(0), [F('lowpass', 240)], 0.45);
        tone(55, 0.04);
        const f = F('bandpass', 900, 0.8); const g = chain(src(2.7), [f], 0.1);
        lfo(0.045, 0.08, g.gain); lfo(0.03, 300, f.frequency);
        break;
      }
      case 'underwater': {
        const f = F('lowpass', 320, 1.2);
        chain(src(0), [f], 0.6);
        lfo(0.1, 140, f.frequency);
        tone(38, 0.1);
        break;
      }
    }
    this.beds = { nodes, bus };
  }

  stopBed(time, fade = 0.4) {
    if (!this.beds) return;
    const { nodes, bus } = this.beds;
    const t = time ?? this.ctx.currentTime;
    try { bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, fade / 3); } catch (e) { /* noop */ }
    for (const n of nodes) { try { n.stop(t + fade + 0.1); } catch (e) { /* noop */ } }
    this.beds = null;
  }

  // ── Event dispatch ────────────────────────────────────────────────────
  play(layer, ev, time, spb) {
    const p = this.p;
    const lp = p.layers[layer];
    const dur = ev.d * spb;
    if (!this.audible[layer] && !(layer === 'drums' && ev.n === 'kick')) return;
    if (layer === 'drums') {
      if (this.audible.drums) this.drum(lp.inst, ev.n, time, ev.v);
      if (ev.n === 'kick' && this.pump > 0) {
        const g = this.pumpGain.gain;
        g.setTargetAtTime(1 - this.pump * 0.72, time, 0.004);
        g.setTargetAtTime(1, time + 0.02, spb * 0.2);
      }
      return;
    }
    if (layer === 'ambience') { this.sprinkle(ev, time); return; }
    const w = p.width / 100;
    let pan = 0;
    if (layer === 'arp' && ev.pan) pan = ev.pan * 0.45 * w;
    else if (layer === 'pad' || layer === 'chords') pan = clamp((ev.n - 62) / 18, -0.7, 0.7) * w;
    this.note(layer, lp.inst, time, dur, ev.n, ev.v, pan);
  }
}
