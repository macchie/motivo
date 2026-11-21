<div align="center">

<img src="resources/icons/appIcon.png" width="112" alt="Motivo logo">

# 🎼 Motivo

**Procedural music generator for video games — loopable, royalty-free, entirely offline.**

Pick a theme, turn a few mood knobs, and get a seamless loop for your dungeon, spaceship or boss fight in milliseconds.

[![License: MIT](https://img.shields.io/badge/license-MIT-f2b544.svg?style=flat-square)](LICENSE)
[![Neutralinojs](https://img.shields.io/badge/Neutralinojs-6.x-4fd1c5.svg?style=flat-square)](https://neutralino.js.org)
[![Web Audio](https://img.shields.io/badge/Web%20Audio-synthesis-8b7cf6.svg?style=flat-square)](https://developer.mozilla.org/docs/Web/API/Web_Audio_API)
[![Runtime deps](https://img.shields.io/badge/runtime%20deps-0-7bc67e.svg?style=flat-square)](#-tech-stack)
[![Platforms](https://img.shields.io/badge/platforms-Linux%20%7C%20macOS%20%7C%20Windows-a3b1c6.svg?style=flat-square)](#-building-for-release)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-5aa9e6.svg?style=flat-square)](https://nodejs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-f06d8c.svg?style=flat-square)](#-contributing)

[✨ Features](#-features) · [🚀 Quick start](#-quick-start) · [📖 User guide](INSTRUCTIONS.md) · [🏗️ Architecture](#%EF%B8%8F-architecture) · [🤝 Contributing](#-contributing)

</div>

---

## 💡 What is Motivo?

Motivo is a small desktop app that **composes and synthesises game music on the fly**. It isn't a sample library and it isn't an AI model. It's a rule-based composer: music theory, groove templates and a seeded random generator, driven by parameters you can understand.

Every track is the result of **seed + parameters**. That means:

- 🔁 **Reproducible.** The same seed and settings always give the same track, so a project file is tiny.
- 🎲 **Endless.** A new seed gives a new variation in the same style.
- 🎮 **Built for games.** Seamless loops with embedded loop points, evolving loops for long play sessions, one-shot stingers and per-layer stems for adaptive music.
- 🆓 **Yours to use.** No samples means no licensing. Everything you export is generated on your machine.

> **Who is it for?** Indie developers who need placeholder or final music, game jam teams, prototypers, and anyone curious about procedural audio.

---

## ✨ Features

### 🎨 Styles and themes
- **11 genres**: Ambient, Cinematic Orchestral, Chiptune, Synthwave, Lo-fi Chill, Dark Ambient, Action/Battle, Fantasy Folk, Techno/Cyber, Cozy/Puzzle and Desert/Exotic. Each has its own harmony, groove, bass, drum feel and orchestration.
- **21 theme presets** in four groups (Exploration · Action · Atmosphere · Interface): 🪐 Deep Space, 🌲 Enchanted Forest, 🌊 Ocean Shore, 🏰 Royal Castle, ⚔️ Boss Battle, 🌃 Cyberpunk City, 👻 Haunted Manor, 🏆 Victory Fanfare, 🔥 Campfire Rest and more.

### 🎛️ Composition controls
- **Mood**: energy, tension, brightness, density and complexity.
- **Harmony**: 12 scales and modes (or *Auto*, chosen by mood), key, chord-change rate, and 5 meters: 4/4, 3/4, 6/8, 5/4 and 7/8.
- **Groove**: tempo from 40 to 200 BPM, swing, humanize.
- **Melody**: motif-based phrases, with settings for register, range, motif repetition, rests and ornaments.

### 🔁 Length and looping
- **Seamless loop**: the export is pre-rolled, so reverb and delay tails wrap into the start. The file loops without a click.
- **Evolving loop**: an infinite loop that changes melody, drums and arrangement every cycle over the same harmony.
- **One-shot**: intro, form (A · AB · ABA · AABA · ABAC · rondo) and outro, for stingers and cutscenes.
- Length from **8 seconds to 10 minutes**.

### 🌧️ Ambience
- **10 environment beds**: wind, rain, ocean, space hum, campfire, vinyl, cave, night, city and underwater.
- **7 procedural details**: birds, water drips, crickets, star twinkles, bubbles, distant thunder and wind chimes. Star twinkles and chimes follow the track's key.

### 🎚️ Mixer and sound
- **7 layers**: pad, chords, bass, lead, arp, drums and ambience. Each has an instrument, volume, pan, mute, solo and a level meter.
- **36 synthesised instruments** and **7 drum kits**, all built from Web Audio oscillators, filters and noise.
- **FX**: convolution reverb, ping-pong delay, warmth, lo-fi tape (saturation and wow), sidechain pump, stereo width.

### 📦 Export
- 🔊 **WAV**: 16/24-bit, 44.1/48 kHz, optional normalization and **embedded loop points** (`smpl` chunk).
- 🎚️ **Stems**: one WAV per layer plus an optional matching mix. Stems skip the master compressor and saturation, so they sum back to that mix exactly in your engine.
- 🎹 **MIDI**: Type-1 file with tempo, meter, section markers and General MIDI programs.
- 💾 **Project**: a few hundred bytes of JSON (seed and parameters) that regenerate the exact track.

### 🖥️ Interface
- 🧭 **New track wizard** (`N`): five quick steps for beginners — what the music is for, a theme or genre, a mood pad (calm↔intense, dark↔bright) and tempo, a length — then pick your favourite of three variations. Everything stays editable in the Parameters panel. Opens automatically on first launch.
- Live spectrum showing the current and next chord.
- Arrangement timeline with sections, chord symbols and a mini piano roll per layer. Click or drag to seek (audio jumps when you release).
- Changes made while playing land on the next bar, so tweaking sounds like an edit rather than a cut.
- Full **undo/redo** history: every parameter change, new seed, randomize, theme or load can be undone.
- Library of saved tracks plus your 15 most recent generations. `Ctrl/⌘+S` updates the track you're working on; `Ctrl/⌘+Shift+S` saves a copy. Deleting can be undone.
- Keyboard-first: `Space` · `G` · `R` · `E` · `Ctrl/⌘+S` · `Ctrl/⌘+Z`.

👉 **Every control is explained in detail in [INSTRUCTIONS.md](INSTRUCTIONS.md).**

---

## 🚀 Quick start

**Requirements:** [Node.js](https://nodejs.org) ≥ 18 and GNU Make. On Linux you also need WebKitGTK with GStreamer; see [Troubleshooting](#-troubleshooting).

```bash
git clone <your-fork-url> motivo
cd motivo
make install   # npm deps + Neutralino binaries
make dev       # launch the desktop app with the inspector enabled
```

Then click a theme, press <kbd>Space</kbd>, and press <kbd>G</kbd> for new variations. 🎶

### 🧰 All tasks

| Make | npm | Description |
|---|---|---|
| `make install` | `npm install && npm run setup` | Install dependencies and download Neutralino binaries (only if missing) |
| `make update` | `npm run setup` | Force re-download of the binaries and client library |
| `make dev` | `npm run dev` | Run the app with the web inspector |
| `make run` | `npm start` | Run the app as shipped |
| `make web` | `npm run web` | Open the UI in a browser at `localhost:8080` (no native APIs) |
| `make test` | `npm test` | Run the core smoke tests |
| `make build` | `npm run build` | Build release packages into `dist/` |
| `make build-embed` | `npm run build:embed` | Build single-file binaries with resources embedded |
| `make clean` / `make distclean` | `npm run clean` | Remove build output (`distclean` also removes `node_modules` and `bin`) |

Run `make` with no arguments to print this list.

### 📦 Building for release

```bash
make build
# dist/motivo-release.zip
# dist/motivo/motivo-{linux_x64,linux_arm64,linux_armhf,mac_x64,mac_arm64,mac_universal,win_x64.exe}
# dist/motivo/resources.neu
```

Ship the binary for your platform together with `resources.neu`, or use `make build-embed` to get one self-contained file per platform.

---

## 🏗️ Architecture

```text
 params + seed ──► generator.js ──► Song { sections, chords, tracks[] }
                         │                       │
                    rng.js (forked)       ┌──────┴───────┐
                    theory.js             ▼              ▼
                    styles.js        engine.js       export.js
                                  Player (live)    MIDI encoder
                                  renderAudio ──► WAV encoder
                                        │
                                     synth.js  (instruments · drums · ambience · FX graph)
```

- **Composer and audio are separate.** The generator outputs plain data (note events in beats). The synth turns that data into sound, both live and offline.
- **Forked randomness.** Each layer draws from its own sub-generator (`rng.fork('bass')`, `rng.fork('drums')`…), so changing one aspect never reshuffles the others.
- **Look-ahead scheduler.** Live playback queues notes about 160 ms ahead (1.5 s while the window is hidden), driven by a worker timer that isn't throttled in the background. It keeps its place when you regenerate and swaps the new version in on the next bar.
- **Composer in a worker.** Generation runs in a Web Worker (`gen.worker.js`), and evolving cycles are prepared in the background as soon as the previous one starts, so the audio path never waits for the composer.
- **Chunked offline rendering.** Exports render in 2-second chunks using `OfflineAudioContext.suspend()`. Notes are created just ahead of the render position and finished voices are detached, so cost grows linearly even for 10-minute tracks.
- **Seamless loops by pre-roll.** The loop is rendered twice and only the second pass is kept, so the tails of the end are already present at the start.

### 📁 Project structure

```text
motivo/
├── Makefile, package.json      # dev tasks
├── neutralino.config.json      # window + native API allow-list
├── scripts/                    # golden-seed tooling (npm run golden)
├── tests/                      # node:test suites: smoke tests + golden seeds
└── resources/
    ├── index.html · css/app.css · fonts/ · icons/
    └── js/
        ├── main.js             # UI controller (inspector, mixer, library, export)
        ├── ui/                 # arrangement view, visualizer, icons, undo history, Neutralino wrapper
        └── core/
            ├── rng.js          # seeded, forkable PRNG
            ├── theory.js       # scales, chords, voice leading, spelling
            ├── styles.js       # genre definitions + default parameters
            ├── presets.js      # theme presets
            ├── generator.js    # the composer (+ GENERATOR_VERSION, planLength)
            ├── gen.worker.js   # runs the composer off the main thread (genclient.js wraps it)
            ├── params.js       # preset / saved-data normalisation shared with tests
            ├── wizard.js       # new-track wizard: answers → parameters (UI in ui/wizard.js)
            ├── ticker.js       # worker-based scheduler clock
            ├── instruments.js  # instruments, kits, beds, details
            ├── synth.js        # Web Audio synthesis + FX graph
            ├── engine.js       # live player + offline renderer
            └── export.js       # WAV and MIDI encoders
```

### 🧪 Tech stack

| | |
|---|---|
| Shell | [Neutralinojs](https://neutralino.js.org): a tiny native runtime that uses the OS webview |
| Audio | Web Audio API: oscillators, biquads, convolver, `OfflineAudioContext` |
| UI | Vanilla ES modules + CSS, no framework, no bundler |
| Fonts | Inter and JetBrains Mono (bundled, OFL) |
| Tests | `node:test` |

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| 🔇 No sound on Linux | WebKitGTK plays Web Audio through GStreamer: `sudo apt install gstreamer1.0-plugins-base gstreamer1.0-plugins-good` |
| 🪟 Window doesn't open on Linux | Install WebKitGTK: `sudo apt install libwebkit2gtk-4.1-0` (or `-4.0-37` on older distros) |
| ❓ `bin/` missing after cloning | Run `make install` (or `make update` to force a fresh download) |
| 🐢 Long exports are slow | Rendering is faster than real time but scales with length. Evolving exports render every cycle, so lower *Cycles to export*. The export dialog shows the expected size and warns about very large renders; **Cancel** stops a render at any time |
| 💾 Where is my library? | In your user data folder (`dataLocation: "system"`), e.g. `~/Library/Application Support/io.motivo.app` on macOS or `~/.local/share/io.motivo.app` on Linux. Data from older versions (stored next to the app) is migrated on first launch. Use *Library → Backup* for a portable copy |

---

## 🗺️ Roadmap

- [ ] OGG / FLAC export
- [ ] Transition stingers that match a track's key and tempo
- [ ] Intensity layers (calm / alert / combat) exported as synced stems
- [ ] User-defined genres and presets saved to disk
- [ ] Simple FM / wavetable instrument editor
- [ ] Command-line renderer for batch generation in build pipelines

Ideas are welcome. Open an issue! 💬

---

## 🤝 Contributing

Contributions of every size are appreciated: new genres, instruments, presets, bug fixes and docs.

1. 🍴 Fork the repo and create a branch: `git checkout -b feat/my-genre`
2. 🛠️ `make install && make dev`
3. ✅ Make sure `make test` passes. Add a test if you touch the core.
4. 📬 Open a pull request that describes the change. A short audio clip or screenshot helps a lot.

**Good first contributions**
- 🎨 **Add a preset**: one object in `resources/js/core/presets.js`.
- 🎸 **Add an instrument**: one entry in `resources/js/core/instruments.js` (oscillators, envelope, filter).
- 🥁 **Add a genre**: one entry in `resources/js/core/styles.js` (progressions, bass/comping/drum feel, defaults).

**Code style:** plain modern JavaScript (ES2020+), no build step, 2-space indent. Keep the core in `js/core/` free of DOM access so it stays testable in Node.

---

### 🔒 Seeds are a promise

The same seed and parameters must always produce the same track, because saved libraries and `.motivo.json` projects store only those. `tests/golden.test.mjs` fails if a change alters the output of a set of reference seeds. If the change is intentional, bump `GENERATOR_VERSION` in `resources/js/core/generator.js` and run `npm run golden` (or `make golden`). Tracks saved with an older version show a warning when loaded.

## 📄 License

Released under the [MIT License](LICENSE).
Music you generate with Motivo belongs to you. Use it in commercial games, no attribution required (though a credit is always nice ❤️).

<div align="center">
<sub>Made with ♪ and Web Audio.</sub>
</div>
