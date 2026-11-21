# Changelog

All notable changes to Motivo. Add notes under **Unreleased** as you work; `make release` moves them into the new version.

## Unreleased

## [1.0.0] - 2026-11-21

### New
- **New track wizard** (`N`): five beginner-friendly steps — purpose, setting, mood pad and tempo, length — then pick one of three variations.
- **Undo / redo** for every change, including new seeds, randomize, themes, loads and imports.
- **Update notices**: Motivo checks GitHub Releases and shows what's new, with a download for your system.
- Stems can include a **matching mix**; stems now sum back to it exactly.
- Export dialog shows the output size, warns about very large renders, can **cancel**, and can start from the evolving cycle you're hearing.
- macOS `.app` / `.dmg` packaging with optional signing and notarization; release builds for macOS, Windows and Linux.

### Improved
- Changes made while playing land on the next bar instead of cutting the audio.
- Playback keeps going when the window is hidden; composing runs in a background worker.
- `Ctrl/⌘+S` updates the library entry you're working on; deletes can be undone; imports are validated.
- Keyboard and screen-reader support, ⌘ labels on macOS, actual length shown next to the target.

### Fixed
- Library and session are stored in the user data folder and save errors are reported instead of being lost.
- MIDI export respects solo, like playback and stems.

