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

It only applies while `blooming-ilacs-pi` is the selected theme, and needs a
terminal that honours OSC colour changes (GNOME Terminal/VTE, xterm, kitty,
WezTerm, Alacritty, iTerm2 — all do).

## Update

Update installed Pi packages, including this theme:

```bash
pi update --extensions
```

## Remove

```bash
pi remove https://github.com/gee666/pi-theme-blooming-ilacs.git
```
