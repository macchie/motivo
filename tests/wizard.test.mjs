// The wizard maps a few answers onto the full parameter set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PURPOSES, wizardBase, wizardToParams, TEMPOS } from '../resources/js/core/wizard.js';
import { PRESETS } from '../resources/js/core/presets.js';
import { STYLES } from '../resources/js/core/styles.js';
import { generateSong } from '../resources/js/core/generator.js';
import { presetParams } from '../resources/js/core/params.js';

test('every purpose × suggestion × length × tempo generates a valid song', () => {
  let n = 0;
  for (const pu of PURPOSES) {
    const picks = [...pu.presets.map((preset) => ({ preset })), ...pu.styles.map((style) => ({ style }))];
    for (const pick of picks) {
      for (const len of pu.lengths) {
        const tempo = TEMPOS[n % TEMPOS.length].id;
        const p = wizardToParams({ purpose: pu.id, ...pick, length: len.id, tempo, energy: (n * 37) % 101, brightness: (n * 53) % 101 }, { seed: 'wz-' + n });
        const s = generateSong(p);
        assert.ok(s.totalBars > 0, `${pu.id}/${JSON.stringify(pick)}/${len.id}`);
        assert.equal(s.mode, len.mode || pu.mode);
        for (const k of ['energy', 'tension', 'brightness', 'density']) assert.ok(p[k] >= 0 && p[k] <= 100, k);
        n++;
      }
    }
  }
  assert.ok(n > 100);
});

test('every suggested preset and style exists', () => {
  for (const pu of PURPOSES) {
    for (const id of pu.presets) assert.ok(PRESETS.find((x) => x.id === id), id);
    for (const id of pu.styles) assert.ok(STYLES[id], id);
    assert.ok(pu.lengths.find((l) => l.id === pu.defaultLength));
  }
});

test('untouched mood and tempo keep the theme exactly', () => {
  const pr = PRESETS.find((x) => x.id === 'forest');
  const a = wizardToParams({ purpose: 'explore', preset: 'forest', length: 'medium' }, { seed: 's' });
  const b = presetParams(pr, { seed: 's' });
  for (const k of ['energy', 'tension', 'brightness', 'density', 'bpm', 'style', 'scale', 'timeSig']) assert.equal(a[k], b[k], k);
  assert.equal(a.length, 60);
});

test('pad and tempo move the right parameters', () => {
  const base = wizardBase({ purpose: 'combat', preset: 'battle' });
  const dark = wizardToParams({ purpose: 'combat', preset: 'battle', brightness: 0 });
  assert.ok(dark.tension >= base.tension && dark.brightness === 0);
  const calm = wizardToParams({ purpose: 'combat', preset: 'battle', energy: 0 });
  assert.ok(calm.density < base.density);
  assert.ok(wizardToParams({ purpose: 'combat', preset: 'battle', tempo: 'faster' }).bpm > base.bpm);
  assert.ok(wizardToParams({ purpose: 'combat', preset: 'battle', tempo: 'slower' }).bpm < base.bpm);
  assert.equal(wizardToParams({ purpose: 'combat', preset: 'battle', length: 'endless' }).mode, 'evolve');
  assert.equal(wizardToParams({ purpose: 'stinger', style: 'chiptune', length: 'sting' }).mode, 'oneshot');
});
