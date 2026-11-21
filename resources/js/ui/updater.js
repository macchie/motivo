// Update notices: checks GitHub Releases at launch, every few hours and when
// the window comes back into focus, then shows a status-bar badge, a one-time
// toast and an "About & updates" dialog with notes and the right download.
import { RELEASES_API, LATEST_JSON, RELEASES_PAGE, normalizeRelease, isNewer, assetFor, platformKey, platformLabel, renderNotes } from '../core/updates.js';
import { icon } from './icons.js';

const KEY = 'motivo.updates';
const FIRST_CHECK_MS = 4000;
const INTERVAL_MS = 6 * 3600e3;      // periodic check while the app is open
const FOCUS_RECHECK_MS = 3600e3;     // re-check on focus if the last check is older than this
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtSize = (b) => (b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b ? Math.max(1, Math.round(b / 1e3)) + ' kB' : '');
const ago = (t) => {
  if (!t) return 'never';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export class Updater {
  // opts: { version, os, arch, openUrl(url), toast(msg, opts), badge: HTMLElement }
  constructor(opts) {
    this.o = opts;
    this.s = this._load();
    this.latest = this.s.cached ? normalizeRelease(this.s.cached) : null;
    this.checking = false;
    this._buildDialog();
    this._syncBadge();
    opts.badge.onclick = () => this.open();
  }

  _load() {
    try { return { auto: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { auto: true }; }
  }
  _save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) { /* noop */ } }

  get available() { return !!(this.latest && isNewer(this.latest.version, this.o.version)); }

  start() {
    if (!this.s.auto) return;
    setTimeout(() => this.check(), FIRST_CHECK_MS);
    clearInterval(this._timer);
    this._timer = setInterval(() => { if (this.s.auto) this.check(); }, INTERVAL_MS);
    if (!this._focusHooked) {
      this._focusHooked = true;
      const again = () => { if (this.s.auto && !document.hidden && Date.now() - (this.s.lastCheck || 0) > FOCUS_RECHECK_MS) this.check(); };
      window.addEventListener('focus', again);
      document.addEventListener('visibilitychange', again);
    }
  }

  // Conditional request (ETag) so repeated checks don't use up GitHub's rate
  // limit; falls back to the website's latest.json if the API refuses.
  async _fetchLatest() {
    try {
      const headers = { Accept: 'application/vnd.github+json' };
      if (this.s.etag && this.s.cached) headers['If-None-Match'] = this.s.etag;
      const r = await fetch(RELEASES_API, { headers, cache: 'no-store' });
      if (r.status === 304 && this.s.cached) return this.s.cached;
      if (r.status === 404) return null; // no release published yet
      if (r.ok) {
        const json = await r.json();
        this.s.etag = r.headers.get('ETag') || null;
        this.s.cached = json;
        return json;
      }
      throw new Error(`GitHub answered ${r.status}`);
    } catch (e) {
      const r = await fetch(LATEST_JSON + '?t=' + Date.now(), { cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`Update server answered ${r.status}`);
      return r.json();
    }
  }

  async check({ manual = false } = {}) {
    if (this.checking) return;
    this.checking = true; this._renderDialog();
    try {
      const raw = await this._fetchLatest();
      this.latest = raw ? normalizeRelease(raw) : null;
      this.s.lastCheck = Date.now(); this.error = null;
      this._save();
      if (this.available) {
        const v = this.latest.version;
        if (manual) this.open();
        else if (this.s.skipped !== v && this.s.notified !== v) {
          this.s.notified = v; this._save();
          this.o.toast(`Motivo ${v} is available`, { action: { label: 'Details', fn: () => this.open() } });
        }
      } else if (manual) this.o.toast(`You're up to date — Motivo ${this.o.version} is the latest version`);
    } catch (e) {
      this.error = e.message || String(e);
      if (manual) this.o.toast(`Couldn't check for updates: ${this.error}`, { err: true });
    } finally {
      this.checking = false;
      this._syncBadge(); this._renderDialog();
    }
  }

  _syncBadge() {
    const b = this.o.badge;
    const show = this.available && this.s.skipped !== this.latest.version;
    b.classList.toggle('has-update', show);
    b.innerHTML = show ? `${icon('download', 12)}Update ${esc(this.latest.version)}` : `v${esc(this.o.version)}`;
    b.title = show ? `Motivo ${this.latest.version} is available — click for details` : 'About Motivo & updates';
    b.setAttribute('aria-label', b.title);
  }

  // ── Dialog ────────────────────────────────────────────────────────────
  _buildDialog() {
    this.el = document.createElement('div');
    this.el.className = 'modal-bg'; this.el.id = 'updateModal';
    this.el.innerHTML = `<div class="modal upd" role="dialog" aria-modal="true" aria-labelledby="updTitle">
      <div class="modal-h"><div><div class="modal-title" id="updTitle">About Motivo</div><div class="modal-sub" id="updSub"></div></div>
        <button type="button" class="btn icon ghost" data-close title="Close" aria-label="Close">${icon('x', 16)}</button></div>
      <div class="modal-b" id="updBody"></div>
      <div class="modal-f" id="updFoot"></div></div>`;
    document.body.append(this.el);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el || e.target.closest('[data-close]')) return this.close();
      const a = e.target.closest('a[data-external], [data-url]');
      if (a) { e.preventDefault(); this.o.openUrl(a.getAttribute('href') || a.dataset.url); }
    });
  }
  get isOpen() { return this.el.classList.contains('open'); }
  open() { this.el.classList.add('open'); this._renderDialog(); setTimeout(() => this.el.querySelector('.modal-f .primary, .modal-f button')?.focus(), 0); }
  close() { this.el.classList.remove('open'); }

  _renderDialog() {
    if (!this.el || !this.isOpen) return;
    const L = this.latest, avail = this.available;
    const key = platformKey(this.o.os, this.o.arch);
    const asset = avail ? assetFor(L, this.o.os, this.o.arch) : null;
    this.el.querySelector('#updTitle').textContent = avail ? `Motivo ${L.version} is available` : 'About Motivo';
    this.el.querySelector('#updSub').textContent = avail
      ? `You have ${this.o.version}${L.publishedAt ? ` · released ${new Date(L.publishedAt).toLocaleDateString()}` : ''}`
      : `Version ${this.o.version}`;
    let body = '';
    if (avail) {
      body += `<div class="upd-notes">${renderNotes(L.notes) || '<p>No release notes.</p>'}</div>`;
      body += `<div class="upd-how">${icon('info', 15)}<span>Download, then replace your current copy of Motivo with the new one. Your library and settings are kept.${key === 'mac' ? ' If macOS blocks the first launch, use <b>Open Anyway</b> in Privacy &amp; Security.' : ''}</span></div>`;
    } else {
      const status = this.checking ? 'Checking for updates…'
        : this.error ? `Couldn't check for updates (${esc(this.error)}).`
          : this.s.lastCheck ? (L ? `You're up to date. ${L.version === this.o.version ? '' : `Latest release: ${esc(L.version)}.`}` : 'No releases have been published yet.')
            : 'Updates haven\'t been checked yet.';
      body += `<div class="upd-uptodate">${icon(this.error ? 'info' : 'check', 18)}<span>${status}</span></div>`;
      body += `<p class="upd-p">Motivo is free and open source. <a href="https://github.com/macchie/motivo" data-external>Source code</a> · <a href="https://macchie.github.io/motivo/" data-external>Website</a> · <a href="https://github.com/macchie/motivo/issues" data-external>Report a problem</a></p>`;
    }
    body += `<label class="chk upd-auto"><span class="switch"><input type="checkbox" id="updAuto" ${this.s.auto ? 'checked' : ''}><i></i></span>Check for updates automatically<small>Last checked ${ago(this.s.lastCheck)}</small></label>`;
    this.el.querySelector('#updBody').innerHTML = body;
    this.el.querySelector('#updAuto').onchange = (e) => { this.s.auto = e.target.checked; this._save(); if (this.s.auto) { this.start(); this.check(); } else clearInterval(this._timer); };

    let foot = `<button type="button" class="btn ghost" id="updCheck" ${this.checking ? 'disabled' : ''}>${this.checking ? 'Checking…' : 'Check now'}</button><span style="flex:1"></span>`;
    if (avail) {
      foot += `<button type="button" class="btn" id="updSkip">${this.s.skipped === L.version ? 'Skipped' : 'Skip this version'}</button>`;
      foot += `<button type="button" class="btn" data-url="${esc(L.url)}">Release page</button>`;
      foot += asset
        ? `<button type="button" class="btn primary" data-url="${esc(asset.url)}">${icon('download', 15)}Download for ${platformLabel(key)}${asset.size ? ` <small>${fmtSize(asset.size)}</small>` : ''}</button>`
        : `<button type="button" class="btn primary" data-url="${esc(L.url)}">${icon('download', 15)}Get the update</button>`;
    } else foot += `<button type="button" class="btn primary" data-close>Close</button>`;
    this.el.querySelector('#updFoot').innerHTML = foot;
    this.el.querySelector('#updCheck').onclick = () => this.check({ manual: true });
    const skip = this.el.querySelector('#updSkip');
    if (skip) skip.onclick = () => { this.s.skipped = L.version; this._save(); this._syncBadge(); this.close(); this.o.toast(`Skipped Motivo ${L.version}. You'll be told about newer versions.`); };
  }

  onKey(e) { if (e.key === 'Escape') { e.preventDefault(); this.close(); } }
}

export { RELEASES_PAGE };
