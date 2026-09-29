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

## Update

Update installed Pi packages, including this theme:

```bash
pi update --extensions
```

## Tests

Run `npm test` with Node.js 22.18 or newer. Tests cover the emitted colour
sequences, active-theme changes, non-interactive modes, cleanup and the Windows
Terminal scheme. Visual checks still need a real terminal: start Pi, switch
away from and back to this theme, then exit and check that terminal defaults
are restored.

## Remove

```bash
pi remove https://github.com/gee666/pi-theme-blooming-ilacs.git
```
