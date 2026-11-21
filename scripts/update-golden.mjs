// Regenerates tests/golden.json. Only run this after bumping GENERATOR_VERSION
// in resources/js/core/generator.js — saved tracks depend on these outputs.
import { writeFileSync } from 'node:fs';
import { generateSong, GENERATOR_VERSION } from '../resources/js/core/generator.js';
import * as S from '../resources/js/core/styles.js';
import { PRESETS } from '../resources/js/core/presets.js';
import { GOLDEN_CASES, caseParams, songHash } from './golden-lib.mjs';

const hashes = {};
for (const c of GOLDEN_CASES) hashes[c.seed] = songHash(generateSong(caseParams(c, { ...S, PRESETS }), { cycle: c.cycle || 0 }));
writeFileSync(new URL('../tests/golden.json', import.meta.url), JSON.stringify({ version: GENERATOR_VERSION, hashes }, null, 2) + '\n');
console.log(`tests/golden.json written for generator v${GENERATOR_VERSION}`);
