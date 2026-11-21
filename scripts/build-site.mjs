#!/usr/bin/env node
// Builds the landing page into _site/ for GitHub Pages:
//  - copies site/
//  - bakes the latest GitHub release (version, sizes) into index.html so the
//    page needs no API call, and writes latest.json for the app's update check
//  - adds 404.html, robots.txt, sitemap.xml and .nojekyll
//
//   node scripts/build-site.mjs [--offline]
// Env: GITHUB_TOKEN (optional, avoids rate limits in CI), GITHUB_REPOSITORY (owner/repo),
//      SITE_URL (default https://<owner>.github.io/<repo>/)
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'site'), OUT = join(ROOT, '_site');
const REPO = process.env.GITHUB_REPOSITORY || 'macchie/motivo';
const [owner, name] = REPO.split('/');
const SITE_URL = (process.env.SITE_URL || `https://${owner}.github.io/${name}/`).replace(/\/?$/, '/');
const offline = process.argv.includes('--offline');

async function latestRelease() {
  if (offline) return undefined;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'motivo-site-build' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
    if (r.status === 404) return null; // no published release yet
    if (!r.ok) throw new Error(`GitHub API ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn(`! Could not fetch the latest release (${e.message}); the page will ask the API at runtime.`);
    return undefined;
  }
}

const rel = await latestRelease();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(SRC, OUT, { recursive: true });

// Only the fields the page and the app use.
const slim = rel && {
  tag_name: rel.tag_name, name: rel.name, body: rel.body || '', html_url: rel.html_url,
  published_at: rel.published_at, prerelease: rel.prerelease,
  assets: (rel.assets || []).map((a) => ({ name: a.name, browser_download_url: a.browser_download_url, size: a.size })),
};
const index = join(OUT, 'index.html');
let html = readFileSync(index, 'utf8');
if (rel !== undefined) {
  // `false` tells the page "no release yet" without asking the API.
  const data = JSON.stringify(slim || false).replace(/</g, '\\u003c');
  html = html.replace(/(<script type="application\/json" id="release-data">)[\s\S]*?(<\/script>)/, `$1${data}$2`);
}
if (slim) html = html.replace('<span id="heroVersion">Latest release</span>', `<span id="heroVersion">Version ${slim.tag_name.replace(/^v/, '')}</span>`);
writeFileSync(index, html);

if (slim) {
  writeFileSync(join(OUT, 'latest.json'), JSON.stringify({ ...slim, version: slim.tag_name.replace(/^v/, '') }, null, 2) + '\n');
}

const notFound = html
  .replace(/<header class="hero"[\s\S]*<\/footer>/, `<header class="hero"><div class="wrap"><h1>Page not found</h1><p class="lede">This page doesn't exist. Head back to the start, or grab the app.</p><div class="cta"><a class="btn primary" href="${SITE_URL}">Back to Motivo</a><a class="btn" href="${SITE_URL}#download">Download</a></div></div></header>`)
  .replace(/(href|src)="assets\//g, `$1="${SITE_URL}assets/`)
  .replace(/<script type="application\/json"[\s\S]*<\/script>\s*<script>[\s\S]*?<\/script>/, '');
writeFileSync(join(OUT, '404.html'), notFound);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`);
writeFileSync(join(OUT, '.nojekyll'), '');

console.log(`✓ Built _site/ for ${SITE_URL} — ${slim ? `release ${slim.tag_name}` : rel === null ? 'no release yet' : 'release info resolved at runtime'}`);
