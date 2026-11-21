// Smoke tests for the pure-JS core (no audio device needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSong } from '../resources/js/core/generator.js';
import { STYLES, DEFAULT_PARAMS, applyStyle, LAYER_IDS } from '../resources/js/core/styles.js';
import { PRESETS } from '../resources/js/core/presets.js';
import { TIME_SIGS } from '../resources/js/core/theory.js';
import { encodeWAV, encodeMIDI } from '../resources/js/core/export.js';

const presetParams = (pr) => {
  const p = applyStyle(structuredClone(DEFAULT_PARAMS), pr.params.style, { keepMood: false });
  const { layers, ...rest } = pr.params;
  Object.assign(p, rest);
  if (layers) for (const [id, v] of Object.entries(layers)) Object.assign(p.layers[id], v);
  return p;
};

function assertValidSong(s, label) {
  assert.ok(s.totalBars > 0 && s.totalBeats > 0 && s.duration > 0, `${label}: empty song`);
  for (const id of LAYER_IDS) {
    for (const e of s.tracks[id]) {
      assert.ok(Number.isFinite(e.t) && e.t >= 0, `${label}/${id}: bad time ${e.t}`);
      assert.ok(Number.isFinite(e.d) && e.d > 0, `${label}/${id}: bad duration ${e.d}`);
      if (id !== 'drums' && id !== 'ambience') assert.ok(Number.isFinite(e.n), `${label}/${id}: bad note ${e.n}`);
    }
  }
}

test('every style × meter × mode generates valid songs', () => {
  let n = 0;
  for (const style of Object.keys(STYLES)) {
    for (const ts of Object.keys(TIME_SIGS)) {
      for (const mode of ['loop', 'oneshot', 'evolve']) {
        const p = applyStyle(structuredClone(DEFAULT_PARAMS), style);
        Object.assign(p, { timeSig: ts, mode, length: [10, 45, 240][n % 3], seed: `smoke-${n}`, sprinkles: 'birds', bed: 'fire' });
        assertValidSong(generateSong(p, { cycle: n % 4 }), `${style}/${ts}/${mode}`);
        n++;
      }
    }
  }
});

test('every preset generates a valid song', () => {
  for (const pr of PRESETS) {
    const p = presetParams(pr); p.seed = 'preset-' + pr.id;
    assertValidSong(generateSong(p), pr.id);
  }
});

test('generation is deterministic for a given seed', () => {
  const p = presetParams(PRESETS[0]); p.seed = 'same-seed';
  assert.deepEqual(generateSong(p).tracks, generateSong(p).tracks);
  const q = { ...p, seed: 'other-seed' };
  assert.notDeepEqual(generateSong(p).tracks, generateSong(q).tracks);
});

test('WAV encoder writes valid headers and loop points', () => {
  const frames = 1000;
  const ch = [new Float32Array(frames).fill(0.5), new Float32Array(frames).fill(-0.5)];
  for (const bits of [16, 24]) {
    const buf = encodeWAV({ channels: ch, sampleRate: 44100 }, { bits, loop: true, title: 'Test' });
    const v = new DataView(buf);
    const tag = (o) => String.fromCharCode(...new Uint8Array(buf, o, 4));
    assert.equal(tag(0), 'RIFF'); assert.equal(tag(8), 'WAVE');
    assert.equal(v.getUint32(4, true), buf.byteLength - 8);
    assert.equal(v.getUint16(34, true), bits);
    assert.equal(tag(36), 'smpl');
    assert.equal(v.getUint32(36 + 8 + 36 + 12, true), frames - 1, 'loop end');
    assert.ok(new TextDecoder().decode(new Uint8Array(buf)).includes('data'));
  }
});

test('MIDI encoder produces a Type-1 file', () => {
  const p = presetParams(PRESETS.find((x) => x.id === 'battle')); p.seed = 'midi';
  const s = generateSong(p);
  const bytes = new Uint8Array(encodeMIDI(s, p));
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'MThd');
  assert.equal((bytes[8] << 8) | bytes[9], 1);
  const tracks = (bytes[10] << 8) | bytes[11];
  const found = new TextDecoder('latin1').decode(bytes).split('MTrk').length - 1;
  assert.equal(found, tracks);
  assert.ok(tracks >= 3);
});
