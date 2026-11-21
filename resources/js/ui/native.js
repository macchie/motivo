// Thin wrapper around Neutralino native APIs with browser fallbacks, so the
// UI also runs in a plain browser during development.

export const isNative = () => typeof window.Neutralino !== 'undefined' && typeof window.NL_OS !== 'undefined';
const sep = () => (window.NL_OS === 'Windows' ? '\\' : '/');

export async function initNative() {
  if (!isNative()) return;
  try {
    Neutralino.init();
    Neutralino.events.on('windowClose', () => Neutralino.app.exit());
  } catch (e) { console.warn('Neutralino init failed', e); }
}

async function defaultDir() {
  try { return await Neutralino.os.getPath('music'); } catch (e) { /* noop */ }
  try { return await Neutralino.os.getPath('documents'); } catch (e) { return ''; }
}

export async function saveFile(name, data, filters = []) {
  if (isNative()) {
    const dir = await defaultDir();
    const path = await Neutralino.os.showSaveDialog('Save file', { defaultPath: dir ? dir + sep() + name : name, filters });
    if (!path) return null;
    if (typeof data === 'string') await Neutralino.filesystem.writeFile(path, data);
    else await Neutralino.filesystem.writeBinaryFile(path, data);
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
    return { label: dir, write: (name, data) => Neutralino.filesystem.writeBinaryFile(dir + sep() + name, data) };
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
  async set(key, value) {
    try {
      if (isNative()) await Neutralino.storage.setData(key, JSON.stringify(value));
      else localStorage.setItem('motivo.' + key, JSON.stringify(value));
    } catch (e) { console.warn('store.set failed', e); }
  },
};
