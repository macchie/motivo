// Real-time player (look-ahead scheduler) and offline renderer.

import { Synth } from './synth.js';
import { generateSong } from './generator.js';
import { LAYER_IDS } from './styles.js';

function flatten(song) {
  const out = [];
  for (const id of LAYER_IDS) for (const e of song.tracks[id]) out.push({ t: e.t, e, layer: id });
  out.sort((a, b) => a.t - b.t);
  return out;
}
function lowerBound(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < t - 1e-9) lo = m + 1; else hi = m; }
  return lo;
}

export class Player {
  constructor() {
    this.ctx = null; this.synth = null;
    this.song = null; this.events = []; this.params = null;
    this.playing = false; this.repeat = true; this.pausedBeat = 0;
    this.lookahead = 0.16; this.timer = null; this.anchors = [];
    this.listeners = {};
    this.cycle = 0; this.nextSong = null;
  }
  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach((f) => f(...a)); }

  async init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'playback' });
      this.synth = new Synth(this.ctx);
      if (this.params) this.synth.setParams(this.params, this._meta());
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }
  _meta() { return { bpm: this.song?.bpm, keyPc: this.song?.keyPc }; }

  setParams(params) {
    this.params = params;
    if (this.synth) this.synth.setParams(params, this._meta());
  }

  setSong(song) {
    const prev = this.song;
    const wasPlaying = this.playing;
    const pos = wasPlaying ? this.position() : this.pausedBeat;
    this.song = song; this.events = flatten(song);
    this.cycle = song.cycle || 0; this.nextSong = null;
    if (this.synth && this.params) this.synth.setParams(this.params, this._meta());
    let beat = pos;
    if (beat >= song.totalBeats) beat = song.loop ? beat % song.totalBeats : 0;
    if (wasPlaying) {
      this.synth.silence(0.05);
      const now = this.ctx.currentTime;
      if (!prev || prev.params.bed !== song.params.bed || prev.keyPc !== song.keyPc) this.synth.startBed(song.params.bed, now + 0.05, { fadeIn: 1 });
      this._startAt(beat, now + 0.06);
    } else this.pausedBeat = beat;
  }

  _startAt(beat, time) {
    this.cursorBeat = beat; this.cursorTime = time;
    this.idx = lowerBound(this.events, beat);
    this.anchors = [{ time, beat }];
    this.endAt = null;
  }

  async play(fromBeat) {
    if (!this.song) return;
    await this.init();
    if (this.playing) return;
    this.playing = true;
    const now = this.ctx.currentTime;
    let beat = fromBeat ?? this.pausedBeat ?? 0;
    if (beat >= this.song.totalBeats) beat = 0;
    this.synth.setParams(this.params, this._meta());
    this.synth.startBed(this.song.params.bed, now + 0.03, { fadeIn: 1.2 });
    this._startAt(beat, now + 0.05);
    this._tick();
    this.timer = setInterval(() => this._tick(), 25);
    this.emit('state', true);
  }
  pause() {
    if (!this.playing) return;
    this.pausedBeat = this.position();
    this._halt();
  }
  stop() {
    this.pausedBeat = 0;
    if (this.playing) this._halt(); else this.emit('state', false);
    this.emit('seek', 0);
  }
  _halt() {
    this.playing = false;
    clearInterval(this.timer); this.timer = null;
    this.synth.silence(0.08);
    this.synth.stopBed(this.ctx.currentTime, 0.3);
    this.emit('state', false);
  }
  toggle() { return this.playing ? this.pause() : this.play(); }
  seek(beat) {
    if (!this.song) return;
    beat = Math.max(0, Math.min(beat, this.song.totalBeats - 0.001));
    if (this.playing) { this.synth.silence(0.03); this._startAt(beat, this.ctx.currentTime + 0.03); }
    else this.pausedBeat = beat;
    this.emit('seek', beat);
  }

  position() {
    if (!this.playing || !this.ctx) return this.pausedBeat;
    const now = this.ctx.currentTime, spb = 60 / this.song.bpm;
    let a = this.anchors[0];
    for (const x of this.anchors) if (x.time <= now) a = x;
    if (this.anchors.length > 4) this.anchors = this.anchors.slice(-3);
    return Math.max(0, Math.min(this.song.totalBeats, a.beat + Math.max(0, now - a.time) / spb));
  }

  _tick() {
    if (!this.playing) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const horizon = now + this.lookahead;
    let guard = 0;
    while (guard++ < 8) {
      const spb = 60 / this.song.bpm;
      while (this.idx < this.events.length) {
        const x = this.events[this.idx];
        const t = this.cursorTime + (x.t - this.cursorBeat) * spb;
        if (t >= horizon) break;
        if (t >= now - 0.04) this.synth.play(x.layer, x.e, Math.max(t, now), spb);
        this.idx++;
      }
      if (this.idx < this.events.length) break;
      const endTime = this.cursorTime + (this.song.totalBeats - this.cursorBeat) * spb;
      if (endTime >= horizon) break;
      if (this.song.loop || this.repeat) {
        if (this.song.mode === 'evolve') {
          this.cycle++;
          const next = this.nextSong && this.nextSong.cycle === this.cycle ? this.nextSong : generateSong(this.params, { cycle: this.cycle });
          this.song = next; this.events = flatten(next); this.nextSong = null;
          this.emit('cycle', this.cycle, next);
          setTimeout(() => { if (this.playing && this.song.mode === 'evolve') this.nextSong = generateSong(this.params, { cycle: this.cycle + 1 }); }, 50);
        }
        this.cursorTime = endTime; this.cursorBeat = 0; this.idx = 0;
        this.anchors.push({ time: endTime, beat: 0 });
      } else {
        if (this.endAt == null) this.endAt = endTime;
        break;
      }
    }
    if (now - (this._lastClean || 0) > 1) { this._lastClean = now; this.synth.cleanup(now); }
    if (this.endAt != null && now > this.endAt + 0.05) {
      this.pausedBeat = 0;
      this._halt();
      this.emit('ended');
    }
  }

  meters() {
    if (!this.synth || !this.playing) return null;
    const out = {};
    const buf = new Float32Array(512);
    for (const id of LAYER_IDS) {
      const m = this.synth.layers[id].meter;
      m.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      out[id] = Math.sqrt(s / buf.length);
    }
    return out;
  }
}

// ── Offline rendering ────────────────────────────────────────────────────
export async function renderAudio(params, song, { sampleRate = 44100, cycles = 1, soloLayer = null, normalize = true, onProgress } = {}) {
  const spb = 60 / song.bpm;
  const L = song.totalBeats * spb;
  const oneshot = song.mode === 'oneshot';
  let segments, extractStart, extractLen;
  if (oneshot) {
    const tail = 0.8 + (params.reverbSize / 100) * 4 + (params.delay !== 'off' ? 1.5 : 0);
    segments = [{ song, off: 0 }];
    extractStart = 0; extractLen = L + tail;
  } else {
    const n = song.mode === 'evolve' ? Math.max(1, cycles) : 1;
    const songs = [];
    for (let i = 0; i < n; i++) songs.push(song.mode === 'evolve' ? (song.cycle === i ? song : generateSong(params, { cycle: i })) : song);
    segments = [{ song: songs[n - 1], off: 0 }, ...songs.map((s, i) => ({ song: s, off: (i + 1) * L }))];
    extractStart = L; extractLen = n * L;
  }
  const total = extractStart + extractLen;
  const frames = Math.ceil(total * sampleRate);
  const ctx = new OfflineAudioContext(2, frames, sampleRate);
  const synth = new Synth(ctx, { offline: true, loopSec: oneshot ? null : L, soloLayer });
  synth.setParams(params, { bpm: song.bpm, keyPc: song.keyPc });
  if (params.bed && params.bed !== 'none' && (!soloLayer || soloLayer === 'ambience')) {
    const k = Math.max(1, Math.ceil(L / 20));
    synth.startBed(params.bed, 0, { fadeIn: oneshot ? 1.5 : 0.01, bedNoiseSec: oneshot ? 8 : L / k });
    if (oneshot) synth.stopBed(Math.max(0.5, L - 1), 2.5);
  }
  const all = [];
  for (const seg of segments) {
    for (const id of LAYER_IDS) {
      if (soloLayer && id !== soloLayer && id !== 'drums') continue;
      for (const e of seg.song.tracks[id]) all.push({ t: seg.off + e.t * spb, id, e });
    }
  }
  all.sort((a, b) => a.t - b.t);
  let idx = 0;
  const scheduleUntil = (tEnd) => { while (idx < all.length && all[idx].t < tEnd) { const x = all[idx++]; synth.play(x.id, x.e, x.t, spb); } };
  // Render in chunks: notes are created just ahead of the render position and
  // finished voices are detached, keeping the node graph small (linear cost).
  const CH = 2;
  let chunked = typeof ctx.suspend === 'function' && total > CH * 1.5;
  if (chunked) {
    try {
      const q = 128 / sampleRate;
      for (let t = CH; t < total - 0.1; t += CH) {
        const qt = Math.round(t / q) * q;
        ctx.suspend(qt).then(() => {
          scheduleUntil(qt + CH + 0.25);
          synth.cleanup(qt);
          if (onProgress) onProgress(qt / total);
          ctx.resume();
        });
      }
    } catch (e) { chunked = false; }
  }
  scheduleUntil(chunked ? CH + 0.25 : Infinity);
  const buf = await ctx.startRendering();
  if (onProgress) onProgress(1);
  const s0 = Math.floor(extractStart * sampleRate);
  let len = Math.min(buf.length - s0, Math.round(extractLen * sampleRate));
  const chans = [0, 1].map((ch) => buf.getChannelData(ch).slice(s0, s0 + len));
  if (oneshot) {
    const thr = 0.0003, minLen = Math.round(L * sampleRate);
    let end = len;
    while (end > minLen && Math.abs(chans[0][end - 1]) < thr && Math.abs(chans[1][end - 1]) < thr) end--;
    len = Math.min(len, end + Math.round(0.05 * sampleRate));
    for (let c = 0; c < 2; c++) {
      chans[c] = chans[c].slice(0, len);
      const fl = Math.min(len, Math.round(0.02 * sampleRate));
      for (let i = 0; i < fl; i++) chans[c][len - 1 - i] *= i / fl;
    }
  }
  let peak = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > peak) peak = a; }
  if (normalize && peak > 0.0001) {
    const g = 0.891 / peak;
    for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= g;
    peak = 0.891;
  }
  return { channels: chans, sampleRate, duration: len / sampleRate, loop: !oneshot, peak };
}
