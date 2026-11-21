// Log-frequency spectrum with soft glow and a waveform trace.

export class Visualizer {
  constructor(canvas) {
    this.cv = canvas; this.bars = 88; this.levels = new Float32Array(this.bars); this.peaks = new Float32Array(this.bars);
    this.freq = null; this.wave = null; this.tint = ['#4fd1c5', '#8b7cf6', '#f2b544'];
    new ResizeObserver(() => this._resize()).observe(canvas);
    this._resize();
  }
  setTint(colors) { this.tint = colors; }
  _resize() {
    const r = this.cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.max(1, r.width * dpr); this.cv.height = Math.max(1, r.height * dpr);
    this.g = this.cv.getContext('2d'); this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = r.width; this.H = r.height;
  }
  draw(analyser, live) {
    const { g, W, H } = this; if (!g) return;
    g.clearRect(0, 0, W, H);
    const n = this.bars;
    if (analyser && live) {
      if (!this.freq || this.freq.length !== analyser.frequencyBinCount) { this.freq = new Uint8Array(analyser.frequencyBinCount); this.wave = new Float32Array(analyser.fftSize); }
      analyser.getByteFrequencyData(this.freq);
      const sr = analyser.context.sampleRate, bins = this.freq.length;
      for (let i = 0; i < n; i++) {
        const f0 = 35 * Math.pow(16000 / 35, i / n), f1 = 35 * Math.pow(16000 / 35, (i + 1) / n);
        const b0 = Math.floor(f0 / (sr / 2) * bins), b1 = Math.max(b0 + 1, Math.floor(f1 / (sr / 2) * bins));
        let m = 0; for (let b = b0; b < b1 && b < bins; b++) m = Math.max(m, this.freq[b]);
        const v = Math.pow(m / 255, 1.6) * (0.85 + i / n * 0.5);
        this.levels[i] += (v - this.levels[i]) * 0.5;
      }
    } else {
      for (let i = 0; i < n; i++) this.levels[i] *= 0.9;
    }
    const pad = 18, bw = (W - pad * 2) / n, base = H - 20, maxH = H - 62;
    const grd = g.createLinearGradient(pad, 0, W - pad, 0);
    grd.addColorStop(0, this.tint[0]); grd.addColorStop(0.55, this.tint[1]); grd.addColorStop(1, this.tint[2]);
    for (let i = 0; i < n; i++) {
      const h = Math.max(1.5, this.levels[i] * maxH);
      this.peaks[i] = Math.max(this.peaks[i] - 0.6, h);
      const x = pad + i * bw;
      g.globalAlpha = 0.9; g.fillStyle = grd;
      g.fillRect(x + 1, base - h, Math.max(1, bw - 2.5), h);
      g.globalAlpha = 0.12;
      g.fillRect(x + 1, base + 3, Math.max(1, bw - 2.5), h * 0.25);
      g.globalAlpha = 0.6; g.fillStyle = '#e8ebf1';
      if (this.peaks[i] > 3) g.fillRect(x + 1, base - this.peaks[i] - 2, Math.max(1, bw - 2.5), 1.2);
    }
    g.globalAlpha = 1;
    if (analyser && live) {
      analyser.getFloatTimeDomainData(this.wave);
      g.strokeStyle = 'rgba(232,235,241,0.22)'; g.lineWidth = 1.2; g.beginPath();
      const step = Math.ceil(this.wave.length / W);
      for (let x = 0, i = 0; i < this.wave.length; i += step, x += (W / (this.wave.length / step))) {
        const y = H * 0.48 + this.wave[i] * H * 0.3;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(pad, base + 1, W - pad * 2, 1);
  }
}
