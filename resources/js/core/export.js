// Encoders: WAV (16/24-bit, optional loop points + metadata) and Standard MIDI.

import { INSTRUMENTS, DRUM_GM } from './instruments.js';
import { LAYER_IDS } from './styles.js';

export function encodeWAV({ channels, sampleRate }, { bits = 16, loop = false, title = '' } = {}) {
  const nCh = channels.length, frames = channels[0].length;
  const bps = bits / 8, blockAlign = nCh * bps, dataSize = frames * blockAlign;
  const enc = new TextEncoder();
  const info = [];
  if (title) info.push(['INAM', title]);
  info.push(['ISFT', 'Motivo procedural music generator']);
  const infoChunks = info.map(([id, txt]) => { let b = enc.encode(txt + '\0'); if (b.length % 2) b = new Uint8Array([...b, 0]); return { id, b }; });
  const listSize = 4 + infoChunks.reduce((s, c) => s + 8 + c.b.length, 0);
  const smplSize = loop ? 60 : 0;
  const total = 12 + 24 + (loop ? 8 + smplSize : 0) + 8 + listSize + 8 + dataSize;
  const buf = new ArrayBuffer(total);
  const v = new DataView(buf);
  let o = 0;
  const str = (s) => { for (let i = 0; i < s.length; i++) v.setUint8(o++, s.charCodeAt(i)); };
  const u32 = (x) => { v.setUint32(o, x, true); o += 4; };
  const u16 = (x) => { v.setUint16(o, x, true); o += 2; };
  str('RIFF'); u32(total - 8); str('WAVE');
  str('fmt '); u32(16); u16(1); u16(nCh); u32(sampleRate); u32(sampleRate * blockAlign); u16(blockAlign); u16(bits);
  if (loop) {
    str('smpl'); u32(smplSize);
    u32(0); u32(0); u32(Math.round(1e9 / sampleRate)); u32(60); u32(0); u32(0); u32(0); u32(1); u32(0);
    u32(0); u32(0); u32(0); u32(frames - 1); u32(0); u32(0);
  }
  str('LIST'); u32(listSize); str('INFO');
  for (const c of infoChunks) { str(c.id); u32(c.b.length); new Uint8Array(buf, o, c.b.length).set(c.b); o += c.b.length; }
  str('data'); u32(dataSize);
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < nCh; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      if (bits === 16) { v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
      else { const x = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff); v.setUint8(o, x & 0xff); v.setUint8(o + 1, (x >> 8) & 0xff); v.setUint8(o + 2, (x >> 16) & 0xff); o += 3; }
    }
  }
  return buf;
}

const vlq = (n) => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
const PPQ = 480;

function trackChunk(events, name) {
  // events: [tick, bytes[]]
  events.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const data = [];
  const nm = Array.from(new TextEncoder().encode(name));
  data.push(0, 0xff, 0x03, ...vlq(nm.length), ...nm);
  let last = 0;
  for (const [tick, bytes] of events) { data.push(...vlq(Math.max(0, tick - last)), ...bytes); last = Math.max(last, tick); }
  data.push(0, 0xff, 0x2f, 0);
  return [0x4d, 0x54, 0x72, 0x6b, (data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255, ...data];
}

export function encodeMIDI(song, params, songs = [song]) {
  const tracks = [];
  const usPerQ = Math.round(60000000 / song.bpm);
  const [num, den] = song.timeSig.split('/').map(Number);
  const meta = [
    [0, [0xff, 0x51, 0x03, (usPerQ >> 16) & 255, (usPerQ >> 8) & 255, usPerQ & 255], 0],
    [0, [0xff, 0x58, 0x04, num, Math.log2(den), 24, 8], 0],
  ];
  let off = 0;
  for (const s of songs) {
    for (const sec of s.sections) meta.push([Math.round((off + sec.startBar * s.beatsPerBar) * PPQ), [0xff, 0x06, ...vlqText(sec.label)], 0]);
    off += s.totalBeats;
  }
  tracks.push(trackChunk(meta, `${params.name} – ${song.keyName} ${song.scaleName}`));
  // Same audibility rule as playback and stem export: mute, and solo if any layer is soloed.
  const anySolo = LAYER_IDS.some((id) => params.layers[id]?.solo);
  let ch = 0; // melodic layers use channels 0–4; drums always use channel 10 (index 9)
  for (const id of LAYER_IDS) {
    if (id === 'ambience') continue;
    const lp = params.layers[id];
    if (!lp || lp.mute || (anySolo && !lp.solo)) continue;
    const isDrum = id === 'drums';
    const channel = isDrum ? 9 : ch++;
    const ev = [];
    if (!isDrum) ev.push([0, [0xc0 | channel, (INSTRUMENTS[lp.inst]?.gm ?? 0) & 127], 0]);
    let o = 0;
    for (const s of songs) {
      for (const e of s.tracks[id]) {
        const note = isDrum ? DRUM_GM[e.n] : Math.round(e.n);
        if (note == null || note < 0 || note > 127) continue;
        const t0 = Math.round((o + e.t) * PPQ), t1 = Math.max(t0 + 1, Math.round((o + e.t + e.d) * PPQ));
        const vel = Math.max(1, Math.min(127, Math.round(e.v * 112 + 15)));
        ev.push([t0, [0x90 | channel, note, vel], 1]);
        ev.push([t1, [0x80 | channel, note, 0], 0]);
      }
      o += s.totalBeats;
    }
    if (ev.length > 1) tracks.push(trackChunk(ev, id[0].toUpperCase() + id.slice(1) + (isDrum ? '' : ` (${INSTRUMENTS[lp.inst]?.name || ''})`)));
  }
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (PPQ >> 8) & 255, PPQ & 255];
  return new Uint8Array([...header, ...tracks.flat()]).buffer;
}
function vlqText(t) { const b = Array.from(new TextEncoder().encode(t)); return [...vlq(b.length), ...b]; }
