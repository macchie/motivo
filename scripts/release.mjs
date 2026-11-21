#!/usr/bin/env node
// Cut a new Motivo release: bump the version everywhere, update CHANGELOG.md,
// commit, tag and push. Pushing the tag starts .github/workflows/release.yml,
// which builds every platform and publishes the GitHub release.
//
//   node scripts/release.mjs patch|minor|major|rc|<x.y.z[-pre]> [--dry-run] [--no-push] [--allow-branch]
//   node scripts/release.mjs notes <x.y.z>     print that version's CHANGELOG section (used by CI)
//
// Write release notes under "## Unreleased" in CHANGELOG.md as you go; if that
// section is empty, the commit subjects since the last tag are used instead.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = (f) => join(ROOT, f);
const MAIN_BRANCH = 'master';
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const pos = args.filter((a) => !a.startsWith('--'));

const c = { y: (s) => `\x1b[33m${s}\x1b[0m`, g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };
const say = (s) => console.log(`${c.y('▸')} ${s}`);
const die = (s) => { console.error(`${c.r('✗')} ${s}`); process.exit(1); };
const git = (cmd, opts = {}) => execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const tryGit = (cmd) => { try { return git(cmd); } catch (e) { return null; } };

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const currentVersion = () => readFileSync(P('resources/js/version.js'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/)[1];

export function nextVersion(cur, bump) {
  const m = cur.match(SEMVER);
  if (!m) throw new Error(`Current version "${cur}" is not semver`);
  let [maj, min, pat] = [+m[1], +m[2], +m[3]];
  const pre = m[4];
  if (SEMVER.test(bump)) return bump;
  if (bump === 'major') return `${maj + 1}.0.0`;
  if (bump === 'minor') return `${maj}.${min + 1}.0`;
  if (bump === 'patch') return pre ? `${maj}.${min}.${pat}` : `${maj}.${min}.${pat + 1}`;
  if (bump === 'rc') {
    const rc = pre && pre.match(/^rc\.(\d+)$/);
    return rc ? `${maj}.${min}.${pat}-rc.${+rc[1] + 1}` : `${maj}.${min}.${pat + 1}-rc.1`;
  }
  throw new Error(`Unknown bump "${bump}" — use patch, minor, major, rc or an explicit x.y.z`);
}

// ── CHANGELOG ──────────────────────────────────────────────────────────────
const CHANGELOG = P('CHANGELOG.md');
const HEADER = '# Changelog\n\nAll notable changes to Motivo. Add notes under **Unreleased** as you work; `make release` moves them into the new version.\n\n## Unreleased\n';

export function sectionFor(text, version) {
  const re = new RegExp(`^## \\[?v?${version.replace(/[.+-]/g, '\\$&')}\\]?.*$`, 'm');
  const m = text.match(re);
  if (!m) return '';
  const rest = text.slice(m.index + m[0].length);
  const end = rest.search(/^## /m);
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

function updateChangelog(version, date, dry) {
  let text = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf8') : HEADER;
  if (!/^## Unreleased\s*$/m.test(text)) {
    const i = text.search(/^## /m);
    text = i < 0 ? `${text.trimEnd()}\n\n## Unreleased\n` : `${text.slice(0, i)}## Unreleased\n\n${text.slice(i)}`;
  }
  const start = text.search(/^## Unreleased\s*$/m);
  const after = text.slice(start).replace(/^## Unreleased\s*\n/, '');
  const nextIdx = after.search(/^## /m);
  let notes = (nextIdx < 0 ? after : after.slice(0, nextIdx)).trim();
  if (!notes) {
    const last = tryGit('describe --tags --abbrev=0 --match "v*"');
    const log = tryGit(`log ${last ? `${last}..HEAD` : 'HEAD'} --no-merges --pretty=format:%s`) || '';
    notes = log.split('\n').filter((s) => s && !/^Release v/.test(s)).map((s) => `- ${s}`).join('\n') || '- Maintenance release';
  }
  const section = `## [${version}] - ${date}\n\n${notes}\n`;
  const before = text.slice(0, start);
  const tail = nextIdx < 0 ? '' : after.slice(nextIdx);
  const out = `${before}## Unreleased\n\n${section}\n${tail}`.replace(/\n{3,}/g, '\n\n');
  if (!dry) writeFileSync(CHANGELOG, out.endsWith('\n') ? out : out + '\n');
  return notes;
}

// ── Version files ──────────────────────────────────────────────────────────
function writeVersion(version) {
  const json = (f, fn) => { const p = P(f); const d = JSON.parse(readFileSync(p, 'utf8')); fn(d); writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); };
  json('package.json', (d) => { d.version = version; });
  if (existsSync(P('package-lock.json'))) json('package-lock.json', (d) => { d.version = version; if (d.packages?.['']) d.packages[''].version = version; });
  json('neutralino.config.json', (d) => { d.version = version; });
  const vf = P('resources/js/version.js');
  writeFileSync(vf, readFileSync(vf, 'utf8').replace(/APP_VERSION\s*=\s*'[^']*'/, `APP_VERSION = '${version}'`));
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  if (pos[0] === 'notes') {
    const v = (pos[1] || '').replace(/^v/, '');
    process.stdout.write(existsSync(CHANGELOG) ? sectionFor(readFileSync(CHANGELOG, 'utf8'), v) : '');
    return;
  }
  const bump = pos[0];
  if (!bump) die('Usage: node scripts/release.mjs patch|minor|major|rc|<x.y.z> [--dry-run] [--no-push]');
  const dry = flag('--dry-run'), push = !flag('--no-push');
  const cur = currentVersion();
  let next;
  try { next = nextVersion(cur, bump); } catch (e) { die(e.message); }
  const tag = `v${next}`;
  say(`Motivo ${c.d(cur)} → ${c.g(next)}${dry ? c.d('  (dry run)') : ''}`);

  // Safety checks
  if (tryGit('status --porcelain')) die('Working tree has uncommitted changes. Commit or stash them first.');
  const branch = git('rev-parse --abbrev-ref HEAD');
  if (branch !== MAIN_BRANCH && !flag('--allow-branch')) die(`Releases are cut from "${MAIN_BRANCH}" (you're on "${branch}"). Use --allow-branch to override.`);
  if (tryGit(`rev-parse -q --verify refs/tags/${tag}`)) die(`Tag ${tag} already exists.`);
  const remote = tryGit('remote get-url origin');
  if (remote && push) {
    say('Fetching origin…');
    tryGit('fetch --tags origin');
    const behind = tryGit(`rev-list --count HEAD..origin/${branch}`);
    if (behind && +behind > 0) die(`Your ${branch} is ${behind} commit(s) behind origin. Pull first.`);
    if (tryGit(`ls-remote --tags origin refs/tags/${tag}`)) die(`Tag ${tag} already exists on origin.`);
  }
  say('Running tests…');
  if (!dry) {
    const t = spawnSync('npm', ['test'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    if (t.status !== 0) die('Tests failed — nothing was changed.');
  }

  const date = new Date().toISOString().slice(0, 10);
  const notes = updateChangelog(next, date, dry);
  console.log(c.d(notes.split('\n').map((l) => '    ' + l).join('\n')));
  if (dry) { say(`Would update versions, commit "Release ${tag}", tag ${tag}${push && remote ? ' and push' : ''}.`); return; }

  writeVersion(next);
  git('add package.json neutralino.config.json resources/js/version.js CHANGELOG.md' + (existsSync(P('package-lock.json')) ? ' package-lock.json' : ''));
  git(`commit -m "Release ${tag}"`);
  git(`tag -a ${tag} -m "Motivo ${tag}"`);
  say(`Committed and tagged ${tag}`);
  if (push && remote) {
    say('Pushing…');
    execSync(`git push origin ${branch}`, { cwd: ROOT, stdio: 'inherit' });
    execSync(`git push origin ${tag}`, { cwd: ROOT, stdio: 'inherit' });
    const repo = remote.replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
    say(`${c.g('Done.')} GitHub Actions is now building the release: https://github.com/${repo}/actions/workflows/release.yml`);
  } else {
    say(`Not pushed. When ready: git push origin ${branch} && git push origin ${tag}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
