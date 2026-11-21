// Real-time player (look-ahead scheduler) and offline renderer.

import { Synth } from './synth.js';
import { generateSong } from './generator.js';
import { LAYER_IDS } from './styles.js';
import { Ticker } from './ticker.js';

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

const QUANT_MAX_SEC = 2.2; // swap on the next bar, or the next beat when bars are longer than this

export class Player {
  constructor({ generate } = {}) {
    // generate(params, opts) -> Promise<song>; used to prepare evolving cycles off-thread.
    this.generate = generate || ((p, o) => Promise.resolve(generateSong(p, o)));
    this.ctx = null; this.synth = null;
    this.song = null; this.events = []; this.params = null;
    this.playing = false; this.repeat = true; this.pausedBeat = 0;
    this.lookahead = 0.16; this.anchors = [];
    this.listeners = {};
    this.cycle = 0; this.nextSong = null; this._fetchToken = 0;
    this.swap = null;
    this.ticker = new Ticker(() => this._tick(), 25);
    this._meterBuf = new Float32Array(512);
    if (typeof document !== 'undefined') {
      // Hidden windows get coarse timers: schedule further ahead so audio never starves.
      const vis = () => { this.lookahead = document.hidden ? 1.5 : 0.16; };
      document.addEventListener('visibilitychange', vis); vis();
    }
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
  _meta(song = this.song) { return { bpm: song?.bpm, keyPc: song?.keyPc }; }

  setParams(params) {
    this.params = params;
    if (this.synth) this.synth.setParams(params, this._meta());
  }

  // Replace the current song. While playing, the change lands on the next bar
  // (or beat, for very slow tempos) so tweaks sound like an edit, not a cut.
  setSong(song, { immediate = false } = {}) {
    if (!this.playing) {
      let beat = this.pausedBeat;
      if (beat >= song.totalBeats) beat = song.loop ? beat % song.totalBeats : 0;
      this._install(song); this.pausedBeat = beat;
      this.emit('swap', song);
      this._prefetch();
      return;
    }
    const now = this.ctx.currentTime;
    const cur = this.position();
    const old = this.song, spb = 60 / old.bpm;
    let q = old.beatsPerBar;
    if (q * spb > QUANT_MAX_SEC) q = 1;
    let boundary = immediate ? cur : Math.ceil((cur + 0.05) / q) * q;
    if (boundary > old.totalBeats) boundary = old.totalBeats;
    const time = immediate ? now + 0.04 : now + (boundary - cur) * spb;
    this.swap = { song, oldBeat: boundary, time: Math.max(now + 0.03, time) };
    if (immediate || this.swap.time < now + this.lookahead) this._doSwap();
  }

  _install(song) {
    this.song = song; this.events = flatten(song);
    this.cycle = song.cycle || 0; this.nextSong = null; this._fetchToken++;
    if (this.synth && this.params) this.synth.setParams(this.params, this._meta());
  }

  _doSwap() {
    const { song, oldBeat, time } = this.swap;
    this.swap = null;
    const prev = this.song;
    let beat = oldBeat >= prev.totalBeats - 1e-6 ? 0 : oldBeat;
    if (beat >= song.totalBeats) beat = song.loop ? beat % song.totalBeats : 0;
    this.synth.silence(0.06, time);
    this._install(song);
    if (prev.params.bed !== song.params.bed || prev.keyPc !== song.keyPc) this.synth.startBed(song.params.bed, time, { fadeIn: 1 });
    this.cursorBeat = beat; this.cursorTime = time;
    this.idx = lowerBound(this.events, beat);
    this.anchors.push({ time, beat, spb: 60 / song.bpm });
    this.endAt = null;
    this.emit('swap', song);
    this._prefetch();
  }

  // Evolving mode: build the next cycle in the background as soon as a cycle starts.
  _prefetch() {
    if (!this.song || this.song.mode !== 'evolve' || !this.params) return;
    const want = this.cycle + 1, token = ++this._fetchToken;
    this.generate(this.params, { cycle: want }).then((s) => {
      if (token === this._fetchToken && this.song?.mode === 'evolve') this.nextSong = s;
    }).catch((e) => console.warn('prefetch failed', e));
  }

  _startAt(beat, time) {
    this.cursorBeat = beat; this.cursorTime = time;
    this.idx = lowerBound(this.events, beat);
    this.anchors = [{ time, beat, spb: 60 / this.song.bpm }];
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
    this.ticker.start();
    this.emit('state', true);
  }
  pause() {
    if (!this.playing) return;
    this._flushSwap();
    this.pausedBeat = this.position();
    this._halt();
  }
  stop() {
    this._flushSwap();
    this.pausedBeat = 0;
    if (this.playing) this._halt(); else this.emit('state', false);
    // Evolving: stopping returns to the first cycle.
    if (this.song?.mode === 'evolve' && this.cycle !== 0) {
      const token = ++this._fetchToken;
      this.generate(this.params, { cycle: 0 }).then((s) => {
        if (token !== this._fetchToken || this.playing) return;
        this._install(s); this.emit('cycle', 0, s); this._prefetch();
      });
    }
    this.emit('seek', 0);
  }
  _flushSwap() {
    if (!this.swap) return;
    const { song } = this.swap; this.swap = null;
    this._install(song); this.emit('swap', song);
  }
  _halt() {
    this.playing = false;
    this.ticker.stop();
    this.synth.silence(0.08);
    this.synth.stopBed(this.ctx.currentTime, 0.3);
    this.emit('state', false);
  }
  toggle() { return this.playing ? this.pause() : this.play(); }
  seek(beat) {
    if (!this.song) return;
    if (this.swap) { const { song } = this.swap; this.swap = null; this._install(song); this.emit('swap', song); }
    beat = Math.max(0, Math.min(beat, this.song.totalBeats - 0.001));
    if (this.playing) { this.synth.silence(0.03); this._startAt(beat, this.ctx.currentTime + 0.03); }
    else this.pausedBeat = beat;
    this.emit('seek', beat);
  }

  position() {
    if (!this.playing || !this.ctx) return this.pausedBeat;
    const now = this.ctx.currentTime;
    let a = this.anchors[0];
    for (const x of this.anchors) if (x.time <= now) a = x;
    if (this.anchors.length > 6) this.anchors = this.anchors.filter((x) => x === a || x.time > now);
    return Math.max(0, Math.min(this.song.totalBeats, a.beat + Math.max(0, now - a.time) / a.spb));
  }

  _tick() {
    if (!this.playing) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const horizon = now + this.lookahead;
    let guard = 0;
    while (guard++ < 8) {
      if (this.swap && this.swap.time < horizon) { this._doSwap(); continue; }
      const spb = 60 / this.song.bpm;
      const limit = this.swap ? this.swap.oldBeat - 1e-6 : Infinity;
      while (this.idx < this.events.length) {
        const x = this.events[this.idx];
        if (x.t >= limit) break;
        const t = this.cursorTime + (x.t - this.cursorBeat) * spb;
        if (t >= horizon) break;
        if (t >= now - 0.04) this.synth.play(x.layer, x.e, Math.max(t, now), spb);
        this.idx++;
      }
      if (this.swap) break;
      if (this.idx < this.events.length) break;
      const endTime = this.cursorTime + (this.song.totalBeats - this.cursorBeat) * spb;
      if (endTime >= horizon) break;
      if (this.song.loop || this.repeat) {
        if (this.song.mode === 'evolve') {
          // Use the prepared cycle; if it isn't ready yet, repeat the current one
          // rather than composing on the audio path.
          if (this.nextSong && this.nextSong.cycle === this.cycle + 1) {
            const next = this.nextSong;
            this._install(next);
            this.emit('cycle', this.cycle, next);
            this._prefetch();
          }
        }
        this.cursorTime = endTime; this.cursorBeat = 0; this.idx = 0;
        this.anchors.push({ time: endTime, beat: 0, spb: 60 / this.song.bpm });
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
    const out = {}, buf = this._meterBuf;
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
// Rough peak memory for a render: the offline buffer (float32 stereo, with one
// cycle of pre-roll for loops) plus the encoded file.
export function estimateRender(song, { sampleRate = 44100, cycles = 1, bits = 16, reverbSize = 60 } = {}) {
  const L = song.totalBeats * 60 / song.bpm;
  const n = song.mode === 'evolve' ? Math.max(1, cycles) : 1;
  const secs = song.mode === 'oneshot' ? L + 0.8 + reverbSize / 100 * 4 + 1.5 : (n + 1) * L;
  const outSecs = song.mode === 'oneshot' ? secs : n * L;
  const fileBytes = outSecs * sampleRate * 2 * (bits / 8);
  return { seconds: outSecs, fileBytes, peakBytes: secs * sampleRate * 2 * 4 + fileBytes };
}

export class ExportCancelled extends Error { constructor() { super('Export cancelled'); this.name = 'AbortError'; } }

export async function renderAudio(params, song, { sampleRate = 44100, cycles = 1, startCycle = 0, soloLayer = null, linearMaster = null, normalize = true, onProgress, signal } = {}) {
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
    for (let i = 0; i < n; i++) {
      const c = startCycle + i;
      songs.push(song.mode === 'evolve' ? (song.cycle === c ? song : generateSong(params, { cycle: c })) : song);
    }
    segments = [{ song: songs[n - 1], off: 0 }, ...songs.map((s, i) => ({ song: s, off: (i + 1) * L }))];
    extractStart = L; extractLen = n * L;
  }
  const total = extractStart + extractLen;
  const frames = Math.ceil(total * sampleRate);
  const ctx = new OfflineAudioContext(2, frames, sampleRate);
  // Stems use a linear master so they sum back to the mix in an engine.
  const synth = new Synth(ctx, { offline: true, loopSec: oneshot ? null : L, soloLayer, linearMaster: linearMaster ?? !!soloLayer });
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
  // Cancelling can't stop an OfflineAudioContext, but cutting the graph from
  // the destination makes the remaining render nearly free.
  let aborted = false;
  const abort = () => {
    aborted = true; idx = all.length;
    for (const n of [synth.out, synth.revIn, synth.dIn, synth.mix]) { try { n.disconnect(); } catch (e) { /* noop */ } }
  };
  let chunked = typeof ctx.suspend === 'function' && total > CH * 1.5;
  if (chunked) {
    try {
      const q = 128 / sampleRate;
      for (let t = CH; t < total - 0.1; t += CH) {
        const qt = Math.round(t / q) * q;
        ctx.suspend(qt).then(() => {
          if (signal?.aborted && !aborted) abort();
          if (!aborted) scheduleUntil(qt + CH + 0.25);
          synth.cleanup(qt);
          if (onProgress) onProgress(qt / total);
          ctx.resume();
        });
      }
    } catch (e) { chunked = false; }
  }
  scheduleUntil(chunked ? CH + 0.25 : Infinity);
  const buf = await ctx.startRendering();
  if (aborted || signal?.aborted) throw new ExportCancelled();
  if (onProgress) onProgress(1);
  const s0 = Math.floor(extractStart * sampleRate);
  let len = Math.min(buf.length - s0, Math.round(extractLen * sampleRate));
  // subarray: no second copy of a possibly very long render.
  const chans = [0, 1].map((ch) => buf.getChannelData(ch).subarray(s0, s0 + len));
  if (oneshot) {
    const thr = 0.0003, minLen = Math.round(L * sampleRate);
    let end = len;
    while (end > minLen && Math.abs(chans[0][end - 1]) < thr && Math.abs(chans[1][end - 1]) < thr) end--;
    len = Math.min(len, end + Math.round(0.05 * sampleRate));
    for (let c = 0; c < 2; c++) {
      chans[c] = chans[c].subarray(0, len);
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
