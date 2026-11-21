// Thin wrapper around Neutralino native APIs with browser fallbacks, so the
// UI also runs in a plain browser during development.

export const isNative = () => typeof window.Neutralino !== 'undefined' && typeof window.NL_OS !== 'undefined';
export const isMac = () => (isNative() ? window.NL_OS === 'Darwin' : /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
// Opens a web link in the user's default browser.
export function openExternal(url) {
  if (!/^https?:\/\//.test(url)) return;
  if (isNative()) Neutralino.os.open(url).catch((e) => console.warn('os.open failed', e));
  else window.open(url, '_blank', 'noopener');
}

// { os: 'Darwin' | 'Windows' | 'Linux', arch: 'x64' | 'arm64' | 'arm' } — used to pick the right download.
export function platform() {
  if (isNative()) return { os: window.NL_OS, arch: window.NL_ARCH || 'x64' };
  const ua = navigator.userAgent;
  const os = /Mac/.test(ua) ? 'Darwin' : /Win/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return { os, arch: /aarch64|arm64/i.test(ua) ? 'arm64' : 'x64' };
}

// The running app's version: the native runtime's when packaged, else version.js.
export const appVersion = (fallback) => (isNative() && window.NL_APPVERSION) || fallback;

const sep = () => (window.NL_OS === 'Windows' ? '\\' : '/');

// Called with (key, error) whenever a write to persistent storage fails.
let onStoreError = (key, e) => console.warn('store.set failed', key, e);
export function setStoreErrorHandler(fn) { onStoreError = fn; }

export async function initNative({ beforeClose } = {}) {
  if (!isNative()) {
    if (beforeClose) window.addEventListener('beforeunload', () => { beforeClose(); });
    return;
  }
  try {
    Neutralino.init();
    Neutralino.events.on('windowClose', async () => {
      // Flush pending saves before quitting (never block exit for more than 1.5 s).
      try { if (beforeClose) await Promise.race([beforeClose(), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* noop */ }
      Neutralino.app.exit();
    });
    await migrateStorage();
  } catch (e) { console.warn('Neutralino init failed', e); }
}

// Storage moved from the app folder (not writable once installed) to the
// per-user data folder ("dataLocation": "system"). Copy old data across once.
async function migrateStorage() {
  if (!window.NL_PATH) return;
  for (const key of ['library', 'recent', 'session']) {
    try {
      await Neutralino.storage.getData(key);
      continue; // already present in the new location
    } catch (e) { /* missing: try the old location */ }
    try {
      const old = await Neutralino.filesystem.readFile(`${window.NL_PATH}${sep()}.storage${sep()}${key}.neustorage`);
      if (old) await Neutralino.storage.setData(key, old);
    } catch (e) { /* nothing to migrate */ }
  }
}

async function defaultDir() {
  try { return await Neutralino.os.getPath('music'); } catch (e) { /* noop */ }
  try { return await Neutralino.os.getPath('documents'); } catch (e) { return ''; }
}

// Large binaries are written in chunks: the native bridge base64-encodes each
// call, so one huge write would need several copies of the file in memory.
const CHUNK = 8 * 1024 * 1024;
async function writeBinary(path, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength <= CHUNK || typeof Neutralino.filesystem.appendBinaryFile !== 'function') {
    await Neutralino.filesystem.writeBinaryFile(path, bytes.buffer.byteLength === bytes.byteLength ? bytes.buffer : bytes.slice().buffer);
    return;
  }
  await Neutralino.filesystem.writeBinaryFile(path, bytes.slice(0, CHUNK).buffer);
  for (let o = CHUNK; o < bytes.byteLength; o += CHUNK) {
    await Neutralino.filesystem.appendBinaryFile(path, bytes.slice(o, o + CHUNK).buffer);
  }
}

export async function saveFile(name, data, filters = []) {
  if (isNative()) {
    const dir = await defaultDir();
    const path = await Neutralino.os.showSaveDialog('Save file', { defaultPath: dir ? dir + sep() + name : name, filters });
    if (!path) return null;
    if (typeof data === 'string') await Neutralino.filesystem.writeFile(path, data);
    else await writeBinary(path, data);
    return path;
  }
  const blob = new Blob([data], { type: typeof data === 'string' ? 'application/json' : 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return name;
}

// Returns a writer for several files (stems). Native: pick a folder. Browser: downloads.
export async function folderWriter() {
  if (isNative()) {
    const dir = await Neutralino.os.showFolderDialog('Choose a folder for the stems', { defaultPath: await defaultDir() });
    if (!dir) return null;
    return { label: dir, write: (name, data) => writeBinary(dir + sep() + name, data) };
  }
  return { label: 'Downloads', write: (name, data) => saveFile(name, data) };
}

export async function openTextFile(filters = []) {
  if (isNative()) {
    const res = await Neutralino.os.showOpenDialog('Open project', { filters });
    if (!res || !res.length) return null;
    return Neutralino.filesystem.readFile(res[0]);
  }
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return resolve(null); f.text().then(resolve); };
    inp.click();
  });
}

export const store = {
  async get(key, fallback = null) {
    try {
      if (isNative()) return JSON.parse(await Neutralino.storage.getData(key));
      const v = localStorage.getItem('motivo.' + key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  },
  // Resolves true on success. Failures are reported to the error handler so
  // the UI can tell the user instead of losing data silently.
  async set(key, value) {
    try {
      if (isNative()) await Neutralino.storage.setData(key, JSON.stringify(value));
      else localStorage.setItem('motivo.' + key, JSON.stringify(value));
      return true;
    } catch (e) {
      onStoreError(key, e);
      return false;
    }
  },
};
