import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Pi themes only colour the characters it draws itself; the terminal's own
// default background stays whatever the emulator is configured with, so the
// gaps around Pi's output keep showing the terminal's configured background.
// The theme cannot express that, so this extension paints the terminal
// itself with OSC 10/11/12 (foreground / background / cursor) whenever the
// Blooming Ilacs theme is the active one, and resets it with OSC 110/111/112
// when the theme is switched away or Pi exits.

const THEME_NAME = "blooming-ilacs-pi";
const THEME_FILE = "blooming-ilacs-pi.json";

const OSC = "\x1b]";
const ST = "\x1b\\";

// Use the X11 RGB form and explicit string terminator for terminal OSCs.
const rgb = (color: string) => `rgb:${color.slice(1, 3)}/${color.slice(3, 5)}/${color.slice(5, 7)}`;
const SET_FOREGROUND = (color: string) => `${OSC}10;${rgb(color)}${ST}`;
const SET_BACKGROUND = (color: string) => `${OSC}11;${rgb(color)}${ST}`;
const SET_CURSOR = (color: string) => `${OSC}12;${rgb(color)}${ST}`;
const RESET_FOREGROUND = `${OSC}110${ST}`;
const RESET_BACKGROUND = `${OSC}111${ST}`;
const RESET_CURSOR = `${OSC}112${ST}`;

interface ThemeJson {
  vars?: Record<string, string>;
  colors?: Record<string, string>;
  export?: Record<string, string>;
}

interface TerminalColors {
  background: string;
  foreground: string;
  cursor: string;
}

// Theme values may be a literal "#rrggbb" or the name of an entry in "vars".
function resolveColor(theme: ThemeJson, value: string | undefined): string | undefined {
  if (!value) return undefined;
  const resolved = value.startsWith("#") ? value : theme.vars?.[value];
  return resolved && /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : undefined;
}

function readThemeColors(): TerminalColors | undefined {
  try {
    const themePath = fileURLToPath(new URL(`../${THEME_FILE}`, import.meta.url));
    const theme = JSON.parse(readFileSync(themePath, "utf8")) as ThemeJson;

    // `export.pageBg` is the theme's page background; it is what the terminal
    // canvas should be so that Pi's own panels sit on the intended colour.
    const background = resolveColor(theme, theme.export?.pageBg) ?? "#111111";
    const foreground = resolveColor(theme, theme.colors?.text) ?? "#BDAE9D";
    const cursor = resolveColor(theme, theme.colors?.accent) ?? foreground;

    return { background, foreground, cursor };
  } catch {
    return undefined;
  }
}

export default function bloomingIlacsBackground(pi: ExtensionAPI) {
  const colors = readThemeColors();
  let applied = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const write = (data: string) => {
    if (!process.stdout.isTTY) return;
    process.stdout.write(data);
  };

  const apply = () => {
    if (applied || !colors) return;
    write(SET_BACKGROUND(colors.background) + SET_FOREGROUND(colors.foreground) + SET_CURSOR(colors.cursor));
    applied = true;
  };

  const restore = () => {
    if (!applied) return;
    applied = false;
    write(RESET_BACKGROUND + RESET_FOREGROUND + RESET_CURSOR);
  };

  const cleanup = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    process.off("exit", cleanup);
    restore();
  };

  pi.on("session_start", (_event, ctx) => {
    cleanup();
    // Do not write terminal controls in print/JSON/RPC mode. Older Pi versions
    // expose hasUI but not mode, so keep that compatibility check too.
    if (!ctx.hasUI || !process.stdout.isTTY || (ctx.mode && ctx.mode !== "tui")) return;

    // Wait for Pi's terminal initialization, then follow the actual active
    // theme. Saved settings miss project overrides, CLI choices and auto mode.
    const sync = () => {
      if (ctx.ui.theme.name === THEME_NAME) apply();
      else restore();
    };
    sync();
    timer = setInterval(sync, 250);
    timer.unref();
    process.once("exit", cleanup);
  });

  pi.on("session_shutdown", cleanup);
}
