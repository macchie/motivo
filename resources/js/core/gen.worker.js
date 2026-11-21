// Runs the composer off the main thread so long tracks and evolving cycles
// never block the UI or the audio scheduler.
import { generateSong } from './generator.js';

self.onmessage = (e) => {
  const { id, params, opts } = e.data;
  try {
    self.postMessage({ id, song: generateSong(params, opts) });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
