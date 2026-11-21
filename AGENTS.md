# AGENTS.md

Guidance for AI coding agents (and humans) working on **Motivo**, a Neutralinojs desktop app that composes and synthesises procedural game music. User-facing docs live in `README.md` (project overview) and `INSTRUCTIONS.md` (user guide).

## Quick commands

| Task | Command |
|---|---|
| Install deps + Neutralino binaries | `make install` |
| Run the desktop app with inspector | `make dev` |
| Run in a browser (no native APIs) | `make web` → http://localhost:8080 |
| Tests (smoke, golden seeds, wizard) | `make test` / `npm test` |
| Re-record golden seeds | `npm run golden` (only after bumping `GENERATOR_VERSION`) |
| Release build | `make build` |

Always run `npm test` before finishing a change. There is no linter or bundler: check syntax with `node --check <file>`.

## Layout

```text
resources/
  index.html, css/app.css         # single page, dark theme, CSS variables
  js/main.js                      # UI controller: inspector, mixer, library, export, undo, wiring
  js/core/                        # pure logic, no DOM (except engine/synth, which use Web Audio)
    generator.js                  # the composer; exports GENERATOR_VERSION and planLength()
    gen.worker.js, genclient.js   # composer in a Web Worker + promise client with fallback
    engine.js                     # live Player (look-ahead scheduler, bar-quantized swaps) + offline renderAudio
    synth.js                      # Web Audio instruments, drums, ambience, FX graph
    ticker.js                     # worker-based scheduler clock
    params.js                     # presetParams / normalizeParams / normalizeEntry (shared with tests)
    wizard.js                     # new-track wizard: answers → parameters
    styles.js, presets.js, instruments.js, theory.js, rng.js, export.js
  js/ui/                          # arrangement view, visualizer, icons, history (undo), wizard dialog, native.js
tests/                            # node:test suites (*.test.mjs) + golden.json
scripts/                          # golden-seed tooling
```

## Ground rules

### Seeds are a promise
A track is stored only as **seed + parameters** (library, recent list, `.motivo.json` projects). The same inputs must always produce the same music.
- Any change to `generator.js`, `rng.js`, `theory.js`, `styles.js`, `presets.js` or anything else the composer reads can change existing tracks. `tests/golden.test.mjs` catches this.
- If the change is unintended, fix it. If it is intended, bump `GENERATOR_VERSION` in `core/generator.js`, run `npm run golden`, and mention it in the commit message.
- Never consume extra values from an existing `rng` stream; use `rng.fork('new-label')` for new randomness so other layers don't reshuffle.

### Keep the core pure and testable
- `core/` modules (except `engine.js` / `synth.js`) must run in Node with no DOM, so tests can import them.
- Put parameter mappings and data transforms in `core/` and test them; keep `ui/` and `main.js` for wiring and rendering.
- The UI also runs in a plain browser (`make web`): anything native goes through `ui/native.js`, which has browser fallbacks.

### Audio thread etiquette
- Never generate songs on the audio scheduling path. Use the worker (`GenClient.generate`) and prefetch.
- Changes during playback go through `player.setSong(song)` so they land on the next bar; use `{ immediate: true }` only for explicit jumps (seek, load, wizard preview).
- Stop or swap voices with `synth.silence(fade, at)` rather than disconnecting nodes, to avoid clicks.
- Expensive buffers (reverb IRs, noise) are cached/debounced; keep it that way.

### Parameters and UI
- Every parameter is declared once in `DEFAULT_PARAMS` (`core/styles.js`) and once in the `GROUPS` schema in `main.js` (label, type, range, `kind`: `gen` regenerates, `mix` applies live, `bed`, `style`).
- When adding a parameter: give it a default, handle it in `normalizeParams` if needed, and make sure old saved tracks without it still load.
- Every user-visible state change must be undoable: call `history.record(state.params, label, key)` **before** mutating, and `history.seal()` at the end of a gesture.
- Persist through `store` in `ui/native.js`; write failures are reported to the user, never swallowed.
- Accessibility: real `<button>`s (or `role` + `tabindex` + key handlers), `aria-label` on icon-only buttons, `aria-pressed`/`aria-checked` on toggles, visible `:focus-visible`.
- Show `⌘` on macOS and `Ctrl` elsewhere (`isMac()` / `MOD` in `main.js`); never hard-code "Ctrl" in UI text.

### Native / security
- `neutralino.config.json` uses a minimal `nativeAllowList`. If you call a new `Neutralino.*` API, add exactly that method; don't add wildcards like `os.*`.
- Storage uses `dataLocation: "system"`. Don't write app data next to the binary.

### Style
- Vanilla ES modules, no framework, no bundler, no runtime dependencies. Dev dependencies only if unavoidable.
- 2-space indent, single quotes, semicolons, `const` by default, small helpers over abstractions.
- Comments explain *why*, not what.

## Documentation must stay in sync

Update the docs in the same change whenever behaviour visible to users or contributors changes:

- **`INSTRUCTIONS.md`** (user guide): new or changed controls, parameters, modes, export options, shortcuts, library behaviour, wizard steps, troubleshooting. Keep the table of contents numbering and the **Keyboard shortcuts** table up to date.
- **`README.md`**: feature list, architecture notes, project structure tree (when files are added, moved or removed), commands, troubleshooting, roadmap (tick items that ship).
- **`AGENTS.md`** (this file): commands, layout or ground rules that change.

Purely internal refactors with no visible effect don't need doc changes. When in doubt, update the docs.

## Testing

- Unit tests: `node --test tests/*.test.mjs`. Add tests for new `core/` logic.
- UI changes: run `make web` (or the desktop app) and exercise the flow; check the console stays clean.
- Audio changes: listen, and for export changes verify the rendered file (length, loop points, levels).

## Git

- Work on a branch (`feat/…`, `fix/…`), not directly on `master`; merge when the user approves.
- Commit messages: short imperative subject, body explaining what changed and why. Note any `GENERATOR_VERSION` bump.
