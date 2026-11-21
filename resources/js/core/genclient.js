// Promise wrapper around the generator worker, with a same-thread fallback
// for webviews that can't start module workers.
import { generateSong } from './generator.js';

export class GenClient {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.seq = 0;
    try {
      this.worker = new Worker(new URL('./gen.worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        const { id, song, error } = e.data;
        const req = this.pending.get(id);
        if (!req) return;
        this.pending.delete(id);
        if (error) req.reject(new Error(error)); else req.resolve(song);
      };
      this.worker.onerror = (e) => { console.warn('Generator worker unavailable, using main thread', e.message || e); this._fallback(); };
    } catch (e) {
      this.worker = null;
    }
  }

  _fallback() {
    const w = this.worker;
    this.worker = null;
    try { w && w.terminate(); } catch (e) { /* noop */ }
    for (const req of this.pending.values()) {
      try { req.resolve(generateSong(req.params, req.opts)); } catch (err) { req.reject(err); }
    }
    this.pending.clear();
  }

  generate(params, opts = {}) {
    if (!this.worker) return new Promise((resolve) => setTimeout(resolve, 0)).then(() => generateSong(params, opts));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, params, opts });
      this.worker.postMessage({ id, params, opts });
    });
  }
}
