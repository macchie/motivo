// Seeds are a promise: the same seed + parameters must keep producing the same
// track. If this fails you changed the music for every saved track — either
// undo that, or bump GENERATOR_VERSION and run `npm run golden`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateSong, GENERATOR_VERSION } from '../resources/js/core/generator.js';
import * as S from '../resources/js/core/styles.js';
import { PRESETS } from '../resources/js/core/presets.js';
import { GOLDEN_CASES, caseParams, songHash } from '../scripts/golden-lib.mjs';

const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));

test('golden seeds still produce the same music', () => {
  assert.equal(golden.version, GENERATOR_VERSION,
    `GENERATOR_VERSION is ${GENERATOR_VERSION} but tests/golden.json is for v${golden.version}: run \`npm run golden\``);
  for (const c of GOLDEN_CASES) {
    const h = songHash(generateSong(caseParams(c, { ...S, PRESETS }), { cycle: c.cycle || 0 }));
    assert.equal(h, golden.hashes[c.seed], `${c.seed}: output changed without a GENERATOR_VERSION bump`);
  }
});
