// Arrangement timeline: ruler, sections, chords and a mini piano-roll per layer.

import { LAYER_IDS, LAYER_NAMES, LAYER_COLORS } from '../core/styles.js';

const SEC_COLORS = { I: '#3b4356', O: '#3b4356', A: '#f2b544', B: '#4fd1c5', C: '#a58bff', D: '#f06d8c' };
const DRUM_ROW = { kick: 2, taiko: 2, tomL: 2, snare: 1, clap: 1, rim: 1, perc: 1, tomH: 1, hat: 0, ohat: 0, shaker: 0, crash: 0, ride: 0 };
const GUTTER = 88, RULER = 20, SECT = 24, CHORDS = 22;

export class ArrangementView {
  constructor(wrap, canvas, head, { onSeek } = {}) {
    this.wrap = wrap; this.cv = canvas; this.hd = head; this.onSeek = onSeek;
    this.song = null; this.params = null; this.lastHead = -1;
    new ResizeObserver(() => { this.draw(); this.drawHead(this.lastBeat || 0, true); }).observe(wrap);
    let drag = false;
    const seek = (e) => {
      if (!this.song) return;
      const r = this.wrap.getBoundingClientRect();
      const x = e.clientX - r.left;
      if (x < GUTTER && !drag) return;
      const beat = Math.max(0, (x - GUTTER) / (r.width - GUTTER - 12)) * this.song.totalBeats;
      this.onSeek && this.onSeek(Math.min(beat, this.song.totalBeats - 0.01));
    };
    wrap.addEventListener('pointerdown', (e) => { const r = wrap.getBoundingClientRect(); if (e.clientX - r.left < GUTTER) return; drag = true; wrap.setPointerCapture(e.pointerId); seek(e); });
    wrap.addEventListener('pointermove', (e) => { if (drag) seek(e); });
    wrap.addEventListener('pointerup', () => { drag = false; });
  }

  setSong(song, params) { this.song = song; this.params = params; this.draw(); }

  _prep(cv) {
    const r = this.wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, W: r.width, H: r.height };
  }

  draw() {
    const { g, W, H } = this._prep(this.cv);
    this.W = W; this.H = H;
    g.clearRect(0, 0, W, H);
    const s = this.song; if (!s) return;
    const p = this.params;
    const x0 = GUTTER, x1 = W - 12, tw = x1 - x0;
    const ppb = tw / s.totalBeats;
    const bx = (beat) => x0 + beat * ppb;
    const lanesTop = RULER + SECT + CHORDS + 6;
    const laneH = (H - lanesTop - 8) / LAYER_IDS.length;
    this.geom = { x0, x1, ppb, lanesTop };
    g.font = '500 10px "JB Mono", monospace';
    g.textBaseline = 'middle';

    // lane backgrounds + labels
    const anySolo = LAYER_IDS.some((id) => p.layers[id]?.solo);
    LAYER_IDS.forEach((id, i) => {
      const y = lanesTop + i * laneH;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.012)' : 'rgba(255,255,255,0.028)';
      g.fillRect(x0, y, tw, laneH - 1);
      const lp = p.layers[id];
      const audible = lp && !lp.mute && (!anySolo || lp.solo);
      g.globalAlpha = audible ? 1 : 0.4;
      g.fillStyle = LAYER_COLORS[id];
      g.beginPath(); g.arc(16, y + laneH / 2, 3.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#a3abba'; g.font = '600 11.5px Inter, sans-serif';
      g.fillText(LAYER_NAMES[id], 28, y + laneH / 2);
      g.globalAlpha = 1;
    });

    // bar grid & ruler
    const barPx = s.beatsPerBar * ppb;
    let labelEvery = 1; while (labelEvery * barPx < 34) labelEvery *= 2;
    g.font = '500 10px "JB Mono", monospace';
    for (let b = 0; b <= s.totalBars; b++) {
      const x = Math.round(bx(b * s.beatsPerBar)) + 0.5;
      const strong = b % 4 === 0;
      if (barPx > 3 || strong) {
        g.strokeStyle = strong ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)';
        g.beginPath(); g.moveTo(x, lanesTop - 2); g.lineTo(x, H - 8); g.stroke();
      }
      if (b < s.totalBars && b % labelEvery === 0) { g.fillStyle = '#687184'; g.fillText(String(b + 1), x + 3, RULER / 2 + 1); }
    }

    // sections
    for (const sec of s.sections) {
      const xa = bx(sec.startBar * s.beatsPerBar), xb = bx((sec.startBar + sec.bars) * s.beatsPerBar);
      const col = SEC_COLORS[sec.letter] || '#6b7385';
      g.fillStyle = col + '26'; this._rr(g, xa + 1, RULER + 2, xb - xa - 2, SECT - 5, 5); g.fill();
      g.fillStyle = col; this._rr(g, xa + 1, RULER + 2, 3, SECT - 5, 1.5); g.fill();
      if (xb - xa > 28) {
        g.fillStyle = sec.letter === 'I' || sec.letter === 'O' ? '#a3abba' : col;
        g.font = '650 11px Inter, sans-serif';
        const lab = sec.letter === 'I' || sec.letter === 'O' ? sec.label : `Section ${sec.letter}`;
        g.fillText(xb - xa > 90 ? lab : sec.letter === 'I' ? 'In' : sec.letter === 'O' ? 'Out' : sec.letter, xa + 9, RULER + SECT / 2);
      }
    }

    // chords
    g.font = '500 10.5px "JB Mono", monospace';
    let lastX = -999;
    for (const c of s.chords) {
      const x = bx(c.t), w = c.d * ppb;
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(Math.round(x) + 0.5, RULER + SECT + 3, 1, CHORDS - 8);
      if (x - lastX > 34 && w > 18) {
        g.fillStyle = '#c9cfda';
        g.save(); g.beginPath(); g.rect(x + 4, RULER + SECT, w - 6, CHORDS); g.clip();
        g.fillText(c.symbol, x + 5, RULER + SECT + CHORDS / 2);
        g.restore(); lastX = x;
      }
    }

    // notes
    LAYER_IDS.forEach((id, i) => {
      const ev = s.tracks[id];
      const y = lanesTop + i * laneH;
      const lp = p.layers[id];
      const audible = lp && !lp.mute && (!anySolo || lp.solo);
      g.globalAlpha = audible ? 0.95 : 0.22;
      g.fillStyle = LAYER_COLORS[id];
      if (id === 'ambience') {
        if (p.bed && p.bed !== 'none') {
          const grd = g.createLinearGradient(0, y, 0, y + laneH);
          grd.addColorStop(0, LAYER_COLORS[id] + '00'); grd.addColorStop(0.5, LAYER_COLORS[id] + '30'); grd.addColorStop(1, LAYER_COLORS[id] + '00');
          g.fillStyle = grd; g.fillRect(x0, y + 4, tw, laneH - 8);
          g.fillStyle = LAYER_COLORS[id];
        }
        for (const e of ev) { if (e.k === 'crackle') continue; g.beginPath(); g.arc(bx(e.t), y + laneH * (0.3 + 0.4 * ((e.t * 7.1) % 1)), 1.6, 0, Math.PI * 2); g.fill(); }
      } else if (id === 'drums') {
        const rh = (laneH - 8) / 3;
        for (const e of ev) {
          const row = DRUM_ROW[e.n] ?? 1;
          g.globalAlpha = (audible ? 0.45 : 0.15) + (audible ? 0.5 : 0.1) * e.v;
          g.fillRect(bx(e.t), y + 4 + row * rh + 1, Math.max(1.2, Math.min(3, ppb * 0.2)), rh - 2);
        }
      } else if (ev.length) {
        let lo = Infinity, hi = -Infinity;
        for (const e of ev) { if (e.n < lo) lo = e.n; if (e.n > hi) hi = e.n; }
        const span = Math.max(6, hi - lo);
        const mid = (lo + hi) / 2;
        const nh = Math.max(2, Math.min(3.5, (laneH - 8) / span));
        for (const e of ev) {
          const yy = y + laneH / 2 - ((e.n - mid) / span) * (laneH - 10) - nh / 2;
          g.fillRect(bx(e.t), yy, Math.max(1.5, e.d * ppb - 0.5), nh);
        }
      }
      g.globalAlpha = 1;
    });

    // loop marker
    if (s.loop) {
      g.strokeStyle = 'rgba(79,209,197,0.5)'; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(Math.round(x1) + 0.5, RULER); g.lineTo(Math.round(x1) + 0.5, H - 8); g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#4fd1c5'; g.font = '700 10px Inter, sans-serif'; g.textAlign = 'right';
      g.fillText(s.mode === 'evolve' ? '∞' : '↻', x1 - 3, RULER / 2 + 1);
      g.textAlign = 'left';
    }
  }

  _rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  drawHead(beat, force = false) {
    this.lastBeat = beat;
    if (!this.song || !this.geom) return;
    const x = this.geom.x0 + beat * this.geom.ppb;
    if (!force && Math.abs(x - this.lastHead) < 0.3) return;
    this.lastHead = x;
    const { g, W, H } = this._prep(this.hd);
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(79,209,197,0.06)';
    g.fillRect(this.geom.x0, RULER, x - this.geom.x0, H - RULER - 8);
    g.strokeStyle = '#4fd1c5'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, RULER - 2); g.lineTo(x, H - 8); g.stroke();
    g.fillStyle = '#4fd1c5';
    g.beginPath(); g.moveTo(x - 5, 2); g.lineTo(x + 5, 2); g.lineTo(x + 5, 10); g.lineTo(x, 16); g.lineTo(x - 5, 10); g.closePath(); g.fill();
  }
}
