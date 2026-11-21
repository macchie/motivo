// Update checks: version ordering, release parsing, asset choice, safe notes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareVersions, isNewer, normalizeRelease, assetFor, platformKey, renderNotes, ASSET_NAMES } from '../resources/js/core/updates.js';
import { APP_VERSION } from '../resources/js/version.js';

test('app version is the same everywhere', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const neu = JSON.parse(readFileSync(new URL('../neutralino.config.json', import.meta.url)));
  assert.equal(pkg.version, APP_VERSION, 'package.json vs resources/js/version.js');
  assert.equal(neu.version, APP_VERSION, 'neutralino.config.json vs resources/js/version.js');
});

test('semver ordering', () => {
  const ordered = ['0.9.9', '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-beta', '1.0.0-rc.1', '1.0.0', 'v1.0.1', '1.1.0', '1.10.0', '2.0.0'];
  for (let i = 0; i < ordered.length - 1; i++) {
    assert.ok(compareVersions(ordered[i], ordered[i + 1]) < 0, `${ordered[i]} < ${ordered[i + 1]}`);
    assert.ok(compareVersions(ordered[i + 1], ordered[i]) > 0, `${ordered[i + 1]} > ${ordered[i]}`);
  }
  assert.equal(compareVersions('v1.2.0', '1.2'), 0);
  assert.ok(isNewer('v1.0.1', '1.0.0') && !isNewer('1.0.0', '1.0.0') && !isNewer('garbage', '1.0.0'));
});

const apiRelease = {
  tag_name: 'v1.2.0', name: 'Motivo v1.2.0', body: '## What\'s new\n* Faster export by @macchie in https://github.com/macchie/motivo/pull/12\n',
  html_url: 'https://github.com/macchie/motivo/releases/tag/v1.2.0', published_at: '2026-12-01T10:00:00Z', draft: false, prerelease: false,
  assets: Object.values(ASSET_NAMES).map((name, i) => ({ name, browser_download_url: `https://example.test/${name}`, size: 1000 * (i + 1) })),
};

test('normalizes GitHub API releases and latest.json', () => {
  const r = normalizeRelease(apiRelease);
  assert.equal(r.version, '1.2.0'); assert.equal(r.assets.length, 5);
  const j = normalizeRelease({ version: '1.2.0', notes: 'x', url: 'https://u', assets: [{ name: 'Motivo-macOS.dmg', url: 'https://d', size: 5 }] });
  assert.equal(j.tag, 'v1.2.0'); assert.equal(j.assets[0].url, 'https://d');
  assert.equal(normalizeRelease({ tag_name: 'nightly' }), null);
  assert.equal(normalizeRelease({ ...apiRelease, draft: true }), null);
});

test('picks the download for each platform', () => {
  const r = normalizeRelease(apiRelease);
  assert.equal(assetFor(r, 'Darwin', 'arm64').name, 'Motivo-macOS.dmg');
  assert.equal(assetFor(r, 'Windows', 'x64').name, 'Motivo-Windows-x64.zip');
  assert.equal(assetFor(r, 'Linux', 'x64').name, 'Motivo-Linux-x64.tar.gz');
  assert.equal(assetFor(r, 'Linux', 'arm64').name, 'Motivo-Linux-arm64.tar.gz');
  assert.equal(assetFor(r, 'Linux', 'arm').name, 'Motivo-Linux-armhf.tar.gz');
  assert.equal(platformKey('FreeBSD', 'x64'), null);
});

test('release notes render safely', () => {
  const html = renderNotes(apiRelease.body + '\n<img src=x onerror=alert(1)>\n[ok](https://a.test) [bad](javascript:alert(1)) **b** `c`');
  assert.ok(html.includes('<h4>What&#39;s new</h4>'));
  assert.ok(html.includes('<li>Faster export by @macchie in <a href="https://github.com/macchie/motivo/pull/12" data-external>#12</a></li>'));
  assert.ok(!/<img|onerror=alert|href="javascript/i.test(html.replace(/&lt;img src=x onerror=alert\(1\)&gt;/, '')));
  assert.ok(html.includes('&lt;img') && html.includes('<a href="https://a.test" data-external>ok</a>') && html.includes('<b>b</b>') && html.includes('<code>c</code>'));
});
