// Deterministic, forkable pseudo-random generator.
// Every musical decision is derived from a seed, so the same seed + parameters
// always produce the same track. Sub-generators are "forked" by label so that
// changing one layer's logic never reshuffles the others.

export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

export class RNG {
  constructor(seed) {
    this.seedStr = String(seed);
    this.s = hash32(this.seedStr) || 0x9e3779b9;
  }
  next() {
    this.s = (this.s + 0x6D2B79F5) | 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.float(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  gauss() {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  weighted(pairs) {
    let total = 0;
    for (const [, w] of pairs) total += Math.max(0, w);
    let r = this.next() * total;
    for (const [val, w] of pairs) { r -= Math.max(0, w); if (r <= 0) return val; }
    return pairs[pairs.length - 1][0];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  fork(label) { return new RNG(this.seedStr + '/' + label); }
}

const ADJ = ['amber','silent','lunar','hollow','velvet','ember','crystal','misty','golden','iron','frozen','wild','distant','hidden','neon','ancient','quiet','stormy','sunken','starlit'];
const NOUN = ['harbor','grove','citadel','comet','meadow','spire','echo','lantern','canyon','reef','orbit','ruins','tide','forge','hollow','glade','nebula','summit','bazaar','vault'];

export function randomSeed() {
  const r = new RNG(Date.now() + ':' + Math.random());
  return `${r.pick(ADJ)}-${r.pick(NOUN)}-${r.int(10, 99)}`;
}
