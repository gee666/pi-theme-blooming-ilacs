## Summary
- Ship the Blooming Ilacs palette: near-black canvas, warm text, pink accents and distinct message/tool states.
- Paint the terminal's defaults only while this theme is active in interactive Pi; restore on switch or exit.
- Integrate through the package manifest, theme JSON and public extension lifecycle/UI APIs.
- Runtime uses no internal or undocumented Pi APIs; SDK validation uses internal theme helpers.
- Main risks are lifecycle timing, terminal OSC/truecolor support and theme-schema changes.

## Intent
Installing the Git-backed package must expose both `blooming-ilacs-pi` and its
background extension. Theme selection must match Pi's actual active UI theme,
not merely saved settings. OSC 11/10/12 makes the terminal canvas, text and cursor
match the palette; OSC 111/110/112 restores terminal defaults without repainting
repeatedly. Print, JSON and RPC output must remain free of these controls.
The Windows Terminal scheme and opt-in truecolor setup preserve this appearance
without silently rewriting user settings at installation.
History: `ce587e4` distinguishes message/tool states; `e8294d1` adds the canvas;
`5396791` fixes lifecycle/Windows support; `a58ee8b` addresses WSL truecolor.

## Pi integration (public APIs)
- `package.json` declares `pi.themes` and `pi.extensions`; Pi loads TypeScript directly.
- Theme JSON uses `vars`, semantic `colors` and HTML `export` backgrounds.
- `ExtensionAPI.on`: `session_start` and `session_shutdown`.
- Context uses `hasUI`, `mode` and `ui.theme.name`; polling follows active changes.
- The setup script writes documented `terminal.trueColor`, preserving other settings.

## Internal Pi APIs
No internal or undocumented Pi APIs are used by shipped runtime code.
`scripts/validate-pi.mjs` alone deep-imports `validateThemeJson` from
`dist/modes/interactive/theme/theme-schema.js`, plus `loadThemeFromPath` and
`setThemeJsonValidator` from `theme.js`. These test-only helpers can move.
Integration tests use exported SDK resource/session APIs and TUI color conversion.

## Weak points
- OSC support/reset behavior and Windows Terminal contrast settings vary by emulator.
- A 250 ms poll follows theme names; same-name palette edits require extension reload.
- The extension resolves only literal six-digit hex or one variable reference,
  narrower than Pi's full color grammar. Keep the shipped palette compatible.
- Cleanup depends on lifecycle dispatch or normal process exit, not SIGKILL.
- Fullscreen/regular appearance and interactive CLI keyboard flows need manual checks.

## Tests
Run `npm run test:evergreen` (Node >=22.19, Python 3, POSIX PTYs).
Provision the latest Pi SDK, TypeScript and Node types in `tmp/pi-validation`
as described in README; the validator checks SDK/global CLI against npm latest.
- Unit: exact OSC bytes, idle suppression, mode/TTY guards, repeated starts,
  cleanup, palette failure/defaults, matching Windows scheme and safe settings edits.
- Integration: real Pi package discovery exposes both resources; resolved semantic
  colors preserve identity and distinct states; real SDK dispatch protects theme
  following, reset-before-reapply on reload and exit-listener cleanup.
- E2e: globally installed Pi starts RPC/JSON/print with package settings, terminal
  and redirected stdout; actual output must contain no color-setting/reset OSCs.
`EVERGREEN_PI_BIN` selects the global CLI, falling back to `pi` on PATH.
All CLI spawns ignore stdin (`/dev/null`). Interactive behavior is SDK-tested with
an emulated terminal boundary, not claimed as interactive CLI e2e coverage.
`EVERGREEN_E2E_MODEL` selects models; no model calls are needed for these tests.
CLI artifacts are kept under ignored `tmp/theme-e2e-*`.
## Relevant changelog topics
Watch theme schema/tokens/color resolution, package discovery and extension loading,
`session_start`/`session_shutdown` and reload ordering, UI theme/context modes,
terminal capability detection/truecolor overrides, and OSC/system-theme handling.
