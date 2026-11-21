# 📖 Motivo — User Guide

This guide explains every part of Motivo: what each control does, how the composer reacts to it, and how to get the best results into your game.

> New here? Read [⚡ Your first track in 60 seconds](#-your-first-track-in-60-seconds), then come back to the sections you need.

## 📑 Contents

1. [⚡ Your first track in 60 seconds](#-your-first-track-in-60-seconds)
2. [🧠 Core concepts](#-core-concepts)
3. [🖥️ Interface tour](#%EF%B8%8F-interface-tour)
4. [🎨 Themes (presets)](#-themes-presets)
5. [🎭 Genres](#-genres)
6. [🎛️ Parameters reference](#%EF%B8%8F-parameters-reference)
7. [🔁 Playback modes in depth](#-playback-modes-in-depth)
8. [🎚️ Mixer and instruments](#%EF%B8%8F-mixer-and-instruments)
9. [🌧️ Ambience](#%EF%B8%8F-ambience)
10. [📊 Visualizer and arrangement](#-visualizer-and-arrangement)
11. [📚 Library, seeds and projects](#-library-seeds-and-projects)
12. [📦 Exporting](#-exporting)
13. [🎮 Using the music in your game](#-using-the-music-in-your-game)
14. [⌨️ Keyboard shortcuts](#%EF%B8%8F-keyboard-shortcuts)
15. [💡 Recipes and tips](#-recipes-and-tips)
16. [🛠️ Troubleshooting and FAQ](#%EF%B8%8F-troubleshooting-and-faq)

---

## ⚡ Your first track in 60 seconds

1. **Pick a theme** in the left sidebar, for example 🌲 *Enchanted Forest*. A track is generated immediately.
2. Press <kbd>Space</kbd> to play.
3. Don't like it? Press <kbd>G</kbd> for a new variation. Same style, new seed.
4. Adjust **Mood** in the right panel (more *Energy*, less *Tension*…). The track regenerates as you go and the new version takes over on the next bar. Changed your mind? <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd> undoes it.
5. Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>S</kbd> to keep it in your library, then <kbd>E</kbd> → **WAV audio** → **Export**. Done: a seamless loop ready for your engine. 🎉

---

## 🧠 Core concepts

### 🌱 Seed + parameters = track
Motivo never stores audio. A track is fully described by its **seed** (a text such as `amber-harbor-42`) and its **parameters**. Generating twice with the same values gives exactly the same notes. This is why project files and library entries are only a few kilobytes.

### 🧩 Composition vs. live parameters
Parameters come in two kinds:

| Kind | Examples | What happens when you change it |
|---|---|---|
| **Composition** | genre, key, scale, mood, tempo, length, form, melody | The track is **regenerated** (same seed), so the notes change |
| **Live / mix** | volumes, pan, mute/solo, instruments, reverb, delay, warmth, master | Applied **instantly** to the sound; the notes stay the same |

When **Auto-regenerate on change** (top of the right panel) is switched off, composition changes are held back. The **Generate** button turns into a pulsing **Apply** button, so you can change several parameters and hear them all at once.

### 🎲 Generate vs. Apply
- **Generate** (or <kbd>G</kbd>, or the 🎲 dice in the seed field) picks a **new seed**: a fresh variation.
- **Apply** appears only when changes are pending and regenerates **with the current seed**.

### 🧱 Layers
Every track has seven layers, each with its own color across the whole UI:

| Layer | Role |
|---|---|
| 🟣 **Pad** | Sustained chords that create the harmonic bed |
| 🔵 **Chords** | Rhythmic comping: stabs, strums, staccato strings, chip arpeggios… |
| 🟡 **Bass** | Root movement: drones, pulses, ostinati, walking lines |
| 🔴 **Lead** | The melody, built from a repeating motif |
| 🩵 **Arp** | Arpeggiated chord tones, panned left and right |
| ⚪ **Drums** | Kit patterns, fills and crashes |
| 🟢 **Ambience** | Environment bed plus procedural details |

---

## 🖥️ Interface tour

```text
┌───────────────────────────────── Top bar ──────────────────────────────────┐
│ Logo · Track name │ ⏮ ▶ ■ 🔁 │ time / bar │ SEED 🎲 · Generate · 🔖 · Export │
├──────────┬──────────────────────────────────────────────┬─────────────────┤
│ Themes / │  Overview (genre, key, tempo, form, length)  │   Parameters    │
│ Library  │  Visualizer (now / next chord)               │   (inspector)   │
│          │  Arrangement timeline                        │                 │
│          │  Mixer & Orchestration                       │                 │
├──────────┴──────────────────────────────────────────────┴─────────────────┤
│ Status bar: audio state · generation stats · shortcuts                     │
└────────────────────────────────────────────────────────────────────────────┘
```

### Top bar
| Element | Description |
|---|---|
| **Track name** | Click to rename. Used for library entries and export file names. |
| ⏮ **Back** | Return to the start (<kbd>Home</kbd> or <kbd>0</kbd>). |
| ▶ **Play / Pause** | <kbd>Space</kbd>. Pausing remembers the position. |
| ■ **Stop** | Stops and rewinds. |
| 🔁 **Repeat** | Repeats **one-shot** tracks while previewing. Loop modes always repeat, so the button is locked on for them. |
| **Time display** | Position / length, `Bar x.y`, and the current cycle in Evolving mode. |
| ↶ ↷ **Undo / Redo** | Step back and forward through every change: parameters, mixer, new seeds, randomize, themes, loads and imports. |
| **Seed** | Type any text and press <kbd>Enter</kbd> to generate from it. The 🎲 picks a random seed. |
| ✨ **Generate / Apply** | See [Generate vs. Apply](#-generate-vs-apply). |
| 🔖 **Save** | Saves the current track to the library (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>S</kbd>). If the track came from the library, this updates that entry; <kbd>Shift</kbd>-click or <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> saves a copy. |
| ⬇️ **Export** | Opens the export dialog (<kbd>E</kbd>). |

### Status bar
Shows whether audio is playing, the sample rate, and generation statistics (bars, number of note events, generation time in ms), plus a shortcut reminder.

---

## 🎨 Themes (presets)

A theme is a genre plus tuned mood, scale, tempo, length, ambience and orchestration. **Clicking a theme always gives a fresh seed.** **Double-clicking** also starts playback. Use the search box to filter by name, description, use case or genre.

| Group | Theme | Genre | Scale | BPM | Ambience | Use it for |
|---|---|---|---|---|---|---|
| 🧭 Exploration | 🪐 Deep Space | Ambient | Lydian | 64 | Space hum + star twinkles | Space exploration, star maps, orbit hubs |
| | 🌲 Enchanted Forest | Fantasy Folk (6/8) | Dorian | 96 | Wind + birds | Forests, druid groves, overworld |
| | 🌊 Ocean Shore | Ambient | Major Pentatonic | 76 | Ocean waves | Beaches, sailing, island hubs |
| | 🏡 Peaceful Village | Fantasy Folk (6/8) | Major | 112 | Birds | Towns, farms, safe zones |
| | 🏔️ Snowy Peaks | Ambient | Lydian | 70 | Wind + wind chimes | Mountains, tundra, ice caves |
| | ☀️ Desert Ruins | Desert / Exotic | Phrygian Dominant | 96 | Wind | Deserts, ancient temples, bazaars |
| | 🏰 Royal Castle | Cinematic | Major | 96 | — | Castles, throne rooms, kingdoms |
| 🌫️ Atmosphere | 💧 Underwater | Ambient | Dorian | 62 | Underwater + bubbles | Diving, sunken cities, aquariums |
| | 💀 Ancient Dungeon | Dark Ambient | Phrygian | 60 | Cave + drips | Dungeons, crypts, catacombs |
| | 👻 Haunted Manor | Dark Ambient | Whole Tone | 58 | Wind + thunder | Horror, ghosts, abandoned places |
| | 👁️ Stealth Mission | Techno / Cyber | Minor | 110 | Night air | Infiltration, heists, sneaking |
| ⚔️ Action | 🌃 Cyberpunk City | Techno / Cyber | Phrygian | 126 | Rain | Cyber cities, hacking, night markets |
| | ⚔️ Boss Battle | Action / Battle | Harmonic Minor | 164 | — | Boss fights, arenas, final stands |
| | 🕹️ Retro Arcade | Chiptune | Major | 150 | — | Platformers, arcade levels |
| | 🗝️ 8-bit Dungeon | Chiptune | Minor | 132 | — | Retro dungeons, caves, castles |
| | 🚗 Night Drive | Synthwave | Minor | 104 | City hum | Racing, chase scenes, neon menus |
| 🖱️ Interface | 👑 Epic Title Screen | Cinematic | Dorian | 88 | — | Main menu, title, trailers |
| | ☕ Cozy Café Menu | Lo-fi Chill | Dorian | 78 | Vinyl crackle | Menus, shops, inventory screens |
| | 🧩 Puzzle Room | Cozy / Puzzle | Major Pentatonic | 100 | — | Puzzles, minigames, crafting |
| | 🏆 Victory Fanfare | Cinematic (one-shot, 12 s) | Major | 120 | — | Level complete, rewards, stingers |
| | 🔥 Campfire Rest | Fantasy Folk (3/4) | Mixolydian | 84 | Campfire + crickets | Save points, rest areas, camps |

The ↺ **Reset** button at the top of the Parameters panel restores the current theme's settings. If the track isn't based on a theme, it restores the genre defaults instead.

---

## 🎭 Genres

Changing the genre (Parameters → *Genre & Harmony*) loads that genre's tempo, meter, effects and orchestration. It **keeps your mood settings** and resets *Scale* and *Chord changes* to *Auto*.

| Genre | Default tempo (range) | Meter | Preferred scales | Bass | Chords | Drums | Default sound |
|---|---|---|---|---|---|---|---|
| 🌌 **Ambient** | 72 (50–95) | 4/4 | Lydian, Major, Maj. Pent., Dorian, Minor | Drone | Sustain | Sparse (muted) | Glass pad, crystal bell, sparkle arp |
| 🎻 **Cinematic Orchestral** | 92 (65–135) | 4/4 | Minor, Harm. Minor, Dorian, Major, Lydian | Ostinato | Staccato | Epic (taiko) | Strings, pizzicato, cello, brass |
| 👾 **Chiptune** | 140 (100–190) | 4/4 | Major, Minor, Dorian, Mixolydian, Maj. Pent. | Chip (root/octave) | Chip arpeggio | Chip noise | Pulse 25%/12%, triangle bass |
| 🌆 **Synthwave** | 100 (80–125) | 4/4 | Minor, Dorian, Mixolydian | 8th pulse | Pulse | Backbeat | Warm analog pad, saw lead, pluck arp |
| ☕ **Lo-fi Chill** | 80 (65–95) | 4/4 | Dorian, Minor, Major, Mixolydian | Syncopated | Lo-fi (rolled 7ths) | Boom-bap | E-piano, upright bass, soft piano |
| 🕯️ **Dark Ambient** | 64 (45–85) | 4/4 | Phrygian, Harm. Minor, Whole Tone, Minor | Sparse | Sustain | Sparse | Dark drone, music box, sub bass |
| ⚔️ **Action / Battle** | 152 (125–185) | 4/4 | Harm. Minor, Minor, Phrygian, Dorian | 16th pulse | Staccato | Drive | Strings, stabs, saw bass, brass |
| 🧝 **Fantasy Folk** | 108 (80–135) | 6/8 | Dorian, Mixolydian, Major, Minor | Folk (root/fifth) | Strum | Folk (hand drums) | Nylon guitar, flute, harp |
| 💾 **Techno / Cyber** | 124 (110–145) | 4/4 | Minor, Phrygian, Dorian | Offbeat | Stabs | Four-on-the-floor | Acid 303, synth stabs, pluck arp |
| 🧸 **Cozy / Puzzle** | 98 (78–120) | 4/4 | Maj. Pent., Major, Lydian, Mixolydian | Roots | Bounce | Light | Marimba, kalimba, upright bass |
| 🏜️ **Desert / Exotic** | 100 (75–130) | 4/4 | Phrygian Dom., Hirajoshi, Harm. Minor | Ostinato | Strum | Folk (hand drums) | Oud, flute, dark drone |

> 💡 *Muted* layers are generated but silent by default. Unmute them in the mixer: for example, drums in Ambient give a soft, minimal pulse.

---

## 🎛️ Parameters reference

All parameters live in the right panel, in collapsible groups. The small text on the right of each group header summarizes its current state. A value shown in **amber** differs from the genre default. **Double-click** any slider to reset it.

### 🎵 Genre & Harmony

| Control | Values | Effect |
|---|---|---|
| **Genre** | 11 genres | See [Genres](#-genres). |
| **Key** | Auto, C … B | Tonal center. *Auto* derives it from the seed. |
| **Scale / Mode** | Auto + 12 scales | *Auto* picks one of the genre's preferred scales that best matches **Brightness** and **Tension**. |
| **Meter** | 4/4 · 3/4 · 6/8 · 5/4 · 7/8 | Beat grouping. Drums, bass and accents follow the groups: for example 7/8 is felt as 2+2+3. |
| **Chord changes** | Auto · every ½ bar · 1 bar · 2 bars · 4 bars | Harmonic rhythm. *Auto* uses the genre's value, faster at high energy and slower at low energy. |

**Available scales**, from brightest to darkest: Lydian ✨, Major Pentatonic, Major, Mixolydian, Whole Tone (dreamlike, ambiguous), Dorian, Minor Pentatonic, Hirajoshi (Japanese), Natural Minor, Phrygian Dominant (Middle Eastern), Harmonic Minor, Phrygian 🌑.

### 💫 Mood

| Slider | Low ← → High | What it changes |
|---|---|---|
| **Energy** | Calm → Intense | Note density, drum complexity, section intensity, bass and comping patterns (low energy simplifies pulses into roots), fills and crashes. |
| **Tension** | Resolved → Unsettling | Darker scales in *Auto*, more diminished/borrowed chords, fewer suspended chords. Dark Ambient adds dissonant clusters. |
| **Brightness** | Dark → Bright | Brighter scales in *Auto* and more open instrument filters (a timbral change you hear live). |
| **Density** | Sparse → Busy | Melody note density and arpeggio rate. |
| **Complexity** | Simple → Rich | 7th/9th chords, chord substitutions, syncopation, melodic leaps, extra kicks and ghost notes, wider arpeggios. |

### ⏱️ Tempo & Groove

| Control | Range | Effect |
|---|---|---|
| **Tempo** | 40–200 BPM | Quarter-note tempo (in 6/8, the dotted-quarter pulse feels slower). |
| **Swing** | 0–60 % | Delays off-beat 16th notes for a shuffled feel. Lo-fi defaults to 32 %. |
| **Humanize** | 0–100 % | Tiny random timing and velocity variations, lighter on pads and downbeats. 0 % gives perfectly quantized, machine-like playback. |

### 🔁 Length & Looping

| Control | Values | Effect |
|---|---|---|
| **Playback mode** | Loop · Evolving · One-shot | See [Playback modes](#-playback-modes-in-depth). |
| **Length / Cycle length** | 8 s → 10 min | Target duration, rounded to whole bars (loops round to 4-bar phrases). The readout shows the **actual** resulting duration and bars; a note appears when it differs from the target. |
| **Form** | Auto · A · AB · ABA · AABA · ABAC · ABACABA | Section plan. *Auto* picks a form from the length (about 8 bars per section). |
| **Intro / Outro** | None · 1 · 2 · 4 bars | *One-shot only.* The intro uses pad and ambience, then a drum pickup. The outro resolves on the tonic with a final hit. |
| **Variation** | Repetitive → Ever-changing | How much repeated sections and evolving cycles differ from the original material. |
| **Cycles to export** | 2–16 | *Evolving only.* How many cycles to render when exporting. |

### 🎶 Melody

| Control | Range | Effect |
|---|---|---|
| **Register** | Low · Mid · High | Octave where the lead sits. |
| **Range** | 7–24 semitones | How far the melody can travel. Narrow ranges sound calmer and more hummable. |
| **Motif repetition** | Free → Catchy | How often phrases reuse the main motif instead of new material. High values make memorable themes. |
| **Rests** | 0–100 % | Chance that answering phrases are left silent (call and response, breathing room). |
| **Ornaments** | 0–100 % | Grace notes before long notes. Strongest in Desert / Exotic. |

**How melodies are built:** each section letter (A, B, C) gets its own 1–2 bar **motif**: a rhythm plus a melodic contour. Phrases follow the pattern **Motif → Variation → Motif → Cadence**. Strong beats snap to chord tones, and the cadence lands on a chord tone. Repeated sections reuse the same motif, varied according to *Variation*.

### 🌧️ Ambience
See [Ambience](#%EF%B8%8F-ambience).

### 🎚️ Effects & Master

| Control | Effect |
|---|---|
| **Reverb size** | Room size, from a short room (~0.5 s) to a huge hall (~7 s). |
| **Reverb mix** | Wet level. Each layer sends a different amount: pads and arps send more, bass and drums less. |
| **Delay** | Off · 1/16 · 1/8 · dotted 1/8 · 1/4. A ping-pong delay synced to the tempo. |
| **Feedback / Delay mix** | Number of echoes / echo level. |
| **Warmth** | A gentle master low-pass that softens harshness. |
| **Lo-fi / Tape** | Saturation, a high-frequency roll-off and pitch "wow", like a worn cassette. |
| **Sidechain pump** | Ducks pad, chords, bass and arp on every kick for the classic "breathing" EDM/synthwave groove. Needs a kick: only active when drums play. |
| **Stereo width** | Scales all panning, from mono to wide. |
| **Master volume** | Output level. Exports can be normalized independently. |

---

## 🔁 Playback modes in depth

### 🔂 Seamless loop *(default)*
- No intro or outro. The **last chord is chosen to lead back** to the first, so the loop sounds continuous.
- Built from whole 4-bar phrases.
- **Export:** the loop is rendered twice and only the second pass is kept. Reverb and delay tails from the end are already present at the start, so the file loops with no gap, fade or click. Loop points are embedded in the WAV.

### ♾️ Evolving
- An **infinite** loop that never repeats exactly. The harmony stays the same; melody, drums, bass and arp are regenerated each cycle with variation.
- The arrangement also breathes over a 4-cycle arc: some cycles drop the lead and bring in the arp, some push intensity, some are breakdowns without drums (more likely with higher *Variation*).
- The time display shows **Cycle N**. The arrangement view refreshes at each new cycle.
- **Export:** renders *Cycles to export* cycles as one long seamless loop. Looping the whole file in-game gives long stretches of non-repetitive music.

### ➡️ One-shot
- Linear piece: **Intro → sections → Outro**, ending on the tonic, usually prepared by a dominant chord.
- Use the 🔁 **Repeat** button in the top bar to loop it while previewing.
- **Export:** includes the natural reverb tail, trims trailing silence and adds a 20 ms fade.

---

## 🎚️ Mixer and instruments

Each strip contains:

- **Instrument selector**: a drum kit for *Drums*, an environment bed for *Ambience*.
- **VOL**: layer volume (double-click to reset to the genre default).
- **PAN**: left/right position (double-click to center). Scaled by *Stereo width*.
- **M / S**: mute and solo. Several layers can be soloed at once. Muted layers are dimmed in the timeline and skipped by the synth, which saves CPU.
- **Meter**: live level.

The **Master** strip shows the output **peak in dBFS**, the master volume and the stereo width.

> Instrument and mix changes are **live**. Swap the lead from *Flute* to *Ocarina* while playing and the next note uses the new instrument.

### 🎹 Instrument catalogue (36)

| Category | Instruments |
|---|---|
| **Pads** | Warm Analog, Glass Pad, String Ensemble, Choir Aah, Dark Drone, Chip Soft Pulse, Drawbar Organ |
| **Keys / plucked** | Soft Piano, Electric Piano, Synth Pluck, Harp, Marimba, Kalimba, Pizzicato Strings, Synth Stab, Chip Pulse 25%, Nylon Guitar, Oud |
| **Bass** | Sub Bass, Saw Bass, Acid 303, Synthwave Bass, Chip Triangle, Upright Bass, Cello Section |
| **Leads** | Saw Lead, Square Lead, Flute, Crystal Bell, Chip Pulse 12%, Brass Section, Ocarina, Solo Violin, Music Box, Whistle, Sparkle |

Which instruments each layer offers:
- **Pad** → pads
- **Chords** → keys and pads
- **Bass** → basses
- **Lead** → leads and keys
- **Arp** → keys and leads

Every sound is synthesized from oscillators (including custom pulse, 4-bit triangle, organ and piano waveforms), FM, filters with envelopes, vibrato, tremolo, breath noise and formant filters (choir).

### 🥁 Drum kits (7)
**Electro 808/909**, **Studio Kit**, **8-bit Noise**, **Cinematic Percussion** (taiko, big toms), **Dusty Lo-fi** (low-passed), **Hand Drums** (frame drum, slaps, shaker) and **Soft Minimal**.

The drum *pattern* comes from the genre (four-on-the-floor, backbeat, boom-bap, drive, chip, epic, folk, light, sparse); the *kit* only changes the sound. Fills appear at phrase and section ends, more often at high energy. Crashes mark new sections.

---

## 🌧️ Ambience

The Ambience layer combines a continuous **bed** with scattered **details**.

| Bed | Character |
|---|---|
| 🌬️ Wind | Two moving band-passed noise layers with gusts |
| 🌧️ Rain | Steady hiss plus a low rumble |
| 🌊 Ocean Waves | Slow, rolling filtered surf |
| 🪐 Space Hum | Detuned drones tuned to the **track's key** plus deep rumble |
| 🔥 Campfire | Warm rumble; automatically adds crackles |
| 📀 Vinyl Crackle | Surface hiss and a faint hum; automatically adds crackles |
| 🕳️ Cave Rumble | Deep rumble and hollow wind; automatically adds low drips |
| 🌙 Night Air | Soft, airy noise |
| 🏙️ City Hum | Low traffic hum with distant swells |
| 🫧 Underwater | Muffled, pressured drone |

| Detail | Character |
|---|---|
| 🐦 Birds | Chirp sequences at random pitches and positions |
| 💧 Water Drips | Resonant plinks |
| 🦗 Crickets | Pulsed high trills |
| ✨ Star Twinkles | Soft bell pings **using notes of the current scale** |
| 🫧 Bubbles | Rising blips |
| ⛈️ Distant Thunder | Rare long rumbles |
| 🎐 Wind Chimes | Pentatonic chime clusters in the track's key |

- **Bed level** is live.
- **Details** and **Detail density** are composition parameters: details are positioned by the seed, so they're reproducible.
- In loop exports, bed modulation is aligned to the loop length so the seam stays invisible.

---

## 📊 Visualizer and arrangement

### Visualizer
A log-frequency spectrum (35 Hz–16 kHz) with peak caps and a waveform trace, tinted with the active theme's color. The overlay shows **NOW PLAYING** (current chord, section, key and scale) and **NEXT** (upcoming chord).

### Arrangement timeline
- **Ruler**: bar numbers.
- **Section row**: Intro/Outro (gray), **A** (amber), **B** (teal), **C** (violet).
- **Chord row**: chord symbols, spelled with ♯ or ♭ to suit the key.
- **Lanes**: a mini piano roll per layer. Drums are drawn on three rows (kick / snare / cymbals). Ambience shows the bed as a band and details as dots.
- **Playhead** in teal. **Click or drag** anywhere in the lanes to seek. While dragging only the playhead moves; playback jumps when you let go.
- A dashed line with ↻ (loop) or ∞ (evolving) marks the loop point.

---

## 📚 Library, seeds and projects

### Library tab
- **Saved tracks**: added with 🔖 / <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>S</kbd>. Click to load (the loaded entry is highlighted and *Save* updates it), 🗑️ to delete. Deleting shows an **Undo** button for a few seconds.
- **Recent generations**: the last 15 tracks created with *Generate*, a theme click, *Randomize* or a manual seed. Your safety net when you skip past a good one.
- **Import**: load a `.motivo.json` project, or a library backup. Entries already in your library and invalid entries are skipped, and the result is reported.
- **Backup**: save the whole library as one JSON file.

The library, recent list and current session are stored with Neutralino's storage, in your user data folder (for example `~/Library/Application Support/io.motivo.app` on macOS). Older versions kept it next to the app; that data is moved over on first launch. In browser mode they use `localStorage`. Your last session is saved when you close the app and restored on launch. If saving ever fails, Motivo tells you; use **Backup** to keep a copy.

Tracks remember which version of the composer made them. If a later Motivo version changes how music is generated, loading an older track shows a warning that it may sound different.

### 🎲 Randomize (✨ wand button, <kbd>R</kbd>)
Randomizes the mood sliders around the genre defaults (±30), plus variation, motif repetition, tempo (within the genre range), key, scale and chord-change rate. It also picks a new seed. Orchestration and effects stay as they are. Like <kbd>G</kbd>, it can be undone from the toast or with Undo.

### 💾 Project files
A project (`*.motivo.json`) contains the seed and every parameter. It's tiny, easy to diff and version-control friendly. Commit it next to your game assets so you can regenerate or tweak a track later.

---

## 📦 Exporting

Open with **Export** or <kbd>E</kbd>. Choose a format, adjust the options and press **Export** (or <kbd>Enter</kbd>). In the desktop app you choose where to save with a native dialog; in browser mode the file is downloaded.

| Format | Output | Options |
|---|---|---|
| 🔊 **WAV audio** | Full stereo mix | Sample rate (44.1 / 48 kHz) · bit depth (16 / 24-bit) · normalize to −1 dBFS · embed loop points (loop modes) |
| 🎚️ **Stems** | One WAV per audible layer, plus an optional matching `_mix.wav`, in a folder you pick | Same audio options. Stems skip the master compressor and tape saturation and are **not normalized**, so they add up exactly to the matching mix when layered |
| 🎹 **MIDI** | Type-1 `.mid` | One track per audible layer (mute and solo apply), tempo, meter, section markers, GM programs, drums on channel 10 |
| 💾 **Project** | `.motivo.json` | Seed + parameters |

**File names** are suggested automatically, for example `boss_battle_164bpm_Cs_harmonic_minor_loop.wav`. You can edit the name; only characters that file systems reject are replaced, and the dialog shows the final name. Stems add a `_pad`, `_bass`… suffix.

**Rendering details**
- Rendering runs offline, faster than real time, in chunks with a progress bar.
- Loops are pre-rolled for seamless wrap-around (see [Seamless loop](#-seamless-loop-default)).
- Loop points are stored in a standard `smpl` chunk (start = 0, end = last sample), which many samplers and audio middleware read.
- WAV files also contain `INAM` (title) and `ISFT` metadata.
- In Evolving mode, the dialog shows a *cycles* slider with the resulting duration, and lets you start from **cycle 1** or from the **cycle you're hearing**.
- The dialog shows the expected output size and warns when a render needs a lot of memory. **Cancel** stops a render in progress.

---

## 🎮 Using the music in your game

| Engine / tool | Seamless loop | Tips |
|---|---|---|
| **Godot** | Import the WAV, set *Loop Mode → Forward* (Godot also reads embedded loop points) | Use separate `AudioStreamPlayer`s for stems |
| **Unity** | Enable *Loop* on the `AudioSource` | For gapless switching, schedule with `PlayScheduled` |
| **Unreal** | Enable *Looping* on the Sound Wave | MetaSounds can layer stems by game state |
| **FMOD / Wwise** | Set a loop region or enable looping on the asset | Stems map naturally to adaptive layers and parameters |
| **Web / Phaser / Howler** | `loop: true` | Use 48 kHz for consistency with most browsers |

### 🎚️ Adaptive music with stems
Export **Stems** from one track and drive their volumes from gameplay:
- *Exploring* → pad + ambience + arp
- *Enemy nearby* → add bass + chords
- *Combat* → add drums + lead

Because all stems share the same length and loop point, they stay perfectly in sync.

### 🔀 Matching tracks
To make a set of tracks that feel related (exploration and combat versions, for example), keep the same **key** and **scale**, change *Energy*, *Tension* and genre, and use tempos that are related (for example 80 and 160 BPM).

---

## ⌨️ Keyboard shortcuts

| Key | Action |
|---|---|
| <kbd>Space</kbd> | Play / pause |
| <kbd>G</kbd> | Generate (new seed), or apply pending changes |
| <kbd>R</kbd> | Randomize mood + new seed |
| <kbd>E</kbd> / <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>E</kbd> | Open export |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>S</kbd> | Save to library (updates the loaded entry) |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Save a copy to the library |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Redo |
| <kbd>Home</kbd> / <kbd>0</kbd> | Back to start |
| <kbd>Enter</kbd> | In the seed field: generate from that seed · in the export dialog: export |
| <kbd>Esc</kbd> | Close dialog (cancels a running export) / leave text field |
| <kbd>Tab</kbd>, <kbd>Enter</kbd> | Move between controls; Enter on a theme or library entry loads it (<kbd>Shift</kbd>+<kbd>Enter</kbd> on a theme also plays) |
| *Double-click* | Slider: reset to default · theme: generate and play |

---

## 💡 Recipes and tips

- 🧘 **Calmer menu music**: Energy ≤ 25, Density ≤ 35, Rests 50 %, and mute Drums.
- 🔥 **Combat that doesn't tire the player**: Evolving mode, Variation 60–75, cycle length 30–45 s.
- 🎵 **A memorable main theme**: Motif repetition 80+, Range 10–12 semitones, Complexity ≤ 45.
- 🌑 **Instant horror**: Dark Ambient, Whole Tone or Phrygian, Tension 90, Lo-fi 25, a Distant Thunder detail.
- 🕹️ **Authentic chip sound**: Chiptune genre, Reverb mix ≤ 10, Width ≤ 30, Humanize 0.
- 🌆 **Synthwave pump**: Sidechain pump 50–70 with drums unmuted.
- 🎲 **Found a great one?** Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>S</kbd> straight away. If you forget, it's still in *Recent generations*.
- 🧪 **Explore meters**: the same theme in 5/4 or 7/8 gives instantly unusual, "puzzle" or "alien" moods.

---

## 🛠️ Troubleshooting and FAQ

**🔇 I hear nothing.**
Press play once: browsers and webviews only start audio after a user action. On Linux, install GStreamer plugins: `sudo apt install gstreamer1.0-plugins-base gstreamer1.0-plugins-good`. Also check that no layer is soloed by mistake.

**🎧 Crackles or dropouts during playback.**
Mute layers you don't need (muted layers cost no CPU), lower *Reverb size*, or close other heavy apps. Exports render offline, so they're never affected.

**🐢 Export takes a while.**
Rendering time is proportional to length × number of notes. Evolving exports render every cycle, so lower *Cycles to export*.

**🔁 My exported loop clicks in my engine.**
Make sure the engine isn't adding a fade or streaming with a decoder gap. For MP3 conversions, prefer OGG instead: MP3 adds padding at the start.

**❓ Will the same seed sound identical in a future version?**
Within the same version, yes. Generator improvements in later versions may change the result, so keep your exported audio for shipped builds.

**⚖️ Can I use the music commercially?**
Yes. The music is generated on your machine from synthesis, with no third-party samples. It's yours, no attribution required.

---

<div align="center"><sub>Happy composing! 🎶 Found an error in this guide? Pull requests are welcome.</sub></div>
