# pi-theme-blooming-ilacs

Blooming Ilacs theme for Pi.

## Install

Install the theme as a Git-backed Pi package:

```bash
pi install https://github.com/gee666/pi-theme-blooming-ilacs.git
```

Then select `blooming-ilacs-pi` from Pi's theme settings.

## Terminal background

A Pi theme only colours the characters Pi draws, so the terminal's own default
background stays visible around Pi's output. The package therefore ships a small
extension (`extensions/blooming-ilacs-background.ts`) that paints the terminal
itself with the theme's `export.pageBg`, `colors.text` and `colors.accent` values
using OSC 11/10/12, and resets them (OSC 111/110/112) when you switch to another
theme or Pi exits.

The extension starts after Pi initializes its interactive terminal and follows
Pi's active theme, including project and command-line overrides. It does not
change terminal colors in print, JSON or RPC mode.

It needs a terminal that honours OSC colour changes, such as Windows Terminal,
GNOME Terminal/VTE, xterm, kitty, WezTerm, Alacritty or iTerm2.

### Windows PowerShell

PowerShell is the shell, not the terminal. Run it inside **Windows Terminal**
rather than the legacy Windows Console Host, which does not support all the OSC
colour changes this extension needs. Update the whole Pi package, not just the
theme JSON, so the background extension loads too.

For matching colours even when OSC changes are unavailable or disabled, install
the included [Windows Terminal colour scheme](windows-terminal/blooming-ilacs.json):

1. Open Windows Terminal's settings JSON with `Ctrl+Shift+,`.
2. Add the object from that file to the top-level `schemes` array.
3. Add these properties to your PowerShell profile in `profiles.list`:

   ```json
   "colorScheme": "Blooming Ilacs",
   "adjustIndistinguishableColors": "never",
   "opacity": 100,
   "useAcrylic": false
   ```

Remove any profile-level `background`, `foreground` or `cursorColor` overrides
that would replace the scheme. This sets the background to `#111111` and normal
text to the softer `#BDAE9D`, not white. The profile scheme stays in effect outside
Pi too; remove `colorScheme` to return to your previous scheme.

If Pi's text still differs, test truecolor detection from PowerShell:

```powershell
$env:PI_TRUE_COLOR = "1"
pi
```

On current Pi versions you can instead merge `"terminal": { "trueColor": true }`
into Pi's `settings.json`. Use this only in a truecolor-capable terminal. A Pi
terminal setting takes precedence over the environment variable.

### WSL text and panel colors

Pi can render the same theme differently on Windows and WSL. On Windows it
automatically enables truecolor. In WSL, `TERM=xterm-256color` without
`COLORTERM=truecolor` or another recognized terminal hint selects 256-color
mode. Pi then approximates every RGB text and panel color with a palette index.
Changing OSC defaults or the Windows Terminal scheme does not fix those panels.

In a truecolor-capable terminal, test from WSL with:

```bash
PI_TRUE_COLOR=1 pi
```

For a persistent fix on current Pi versions, merge this into Pi's settings:

```json
{
  "terminal": {
    "trueColor": true
  }
}
```

Or run the opt-in setup command from this package's directory:

```bash
npm run configure:truecolor -- ~/.pi/agent/settings.json
```

The command preserves other settings and writes through symlinks used to share
settings with Windows. Close Pi before running it, then restart Pi. It does not
run automatically on installation because not every WSL terminal supports RGB.
To undo it, remove `terminal.trueColor` or set it to `"auto"`. A project
`.pi/settings.json` override takes precedence over the user setting, and settings
take precedence over `PI_TRUE_COLOR`.

If colors still differ in Windows Terminal, apply the profile settings above to
the WSL profile too, especially `adjustIndistinguishableColors: "never"`.

## Update

Update installed Pi packages, including this theme:

```bash
pi update --extensions
```

## Tests

Run `npm test` with Node.js 22.19 or newer. Tests cover the emitted colour
sequences, active-theme changes, non-interactive modes, cleanup, the Windows
Terminal scheme and the opt-in truecolor configuration command.
Visual checks still need a real terminal: start Pi, switch
away from and back to this theme, then exit and check that terminal defaults
are restored.

## Pi compatibility and validation

Only the latest stable `@earendil-works/pi-coding-agent` release is a test target. Older Pi versions are not part of the test policy. Before every release, resolve `@latest` again, rerun the checks below, and update this record with the exact version actually checked and any validation limits.

Tested against Pi 1.4.0

Validation used `@earendil-works/pi-coding-agent` 1.4.0 on Node.js 24.16.0. Automated checks cover the six mocked terminal/background tests, five truecolor configuration tests using temporary settings files, JavaScript syntax, strict extension typechecking against Pi 1.4.0's declarations, the theme JSON through Pi's actual schema validator and loader, and extension registration through Pi's actual extension loader. Typechecking skips dependency declaration checks. No interactive Pi session or real-terminal OSC/appearance check was run for this record; the manual checks above are still needed.

The peer dependency minimum is `>=1.4.0`, the version checked here, rather than an unbounded wildcard. That floor does not mean every later release has been tested. Only the latest stable release is a test target.

Use Node.js 22.19 or newer for Pi 1.4.0 validation. `npm test` automatically installs the latest validation tools under ignored `tmp/`, validates Pi loading, runs strict extension typechecking, and then runs the unit tests. Nothing is installed as a shipped runtime dependency:

```sh
npm test
npm run check
```

Use `npm run test:unit` for the dependency-free unit-only check. Both `npm test` and standalone `npm run test:pi` refresh the temporary install with `--ignore-scripts`; no manual setup is needed. Install and registry calls have timeouts and failures stop the check. The validator verifies the installed version against npm's latest release. These commands need registry access and use Pi's internal validation entry points, which may change in a later release. No linter is configured.

## Remove

```bash
pi remove https://github.com/gee666/pi-theme-blooming-ilacs.git
```
