import { readFileSync } from "node:fs";
import { watchFile, unwatchFile } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

// Pi themes only colour the characters it draws itself; the terminal's own
// default background stays whatever the emulator is configured with, so the
// gaps around Pi's output keep showing the Ubuntu terminal background.
// The theme cannot express that, so this extension paints the terminal
// itself with OSC 10/11/12 (foreground / background / cursor) whenever the
// Blooming Ilacs theme is the active one, and resets it with OSC 110/111/112
// when the theme is switched away or Pi exits.

const THEME_NAME = "blooming-ilacs-pi";
const THEME_FILE = "blooming-ilacs-pi.json";

const OSC = "\x1b]";
const BEL = "\x07";

const SET_FOREGROUND = (color: string) => `${OSC}10;${color}${BEL}`;
const SET_BACKGROUND = (color: string) => `${OSC}11;${color}${BEL}`;
const SET_CURSOR = (color: string) => `${OSC}12;${color}${BEL}`;
const RESET_FOREGROUND = `${OSC}110${BEL}`;
const RESET_BACKGROUND = `${OSC}111${BEL}`;
const RESET_CURSOR = `${OSC}112${BEL}`;

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
  if (value.startsWith("#")) return value;
  const resolved = theme.vars?.[value];
  return resolved?.startsWith("#") ? resolved : undefined;
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

function activeThemeName(): string | undefined {
  try {
    const settingsPath = join(getAgentDir(), "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as { theme?: string };
    return settings.theme;
  } catch {
    return undefined;
  }
}

export default function bloomingIlacsBackground(pi: ExtensionAPI) {
  const colors = readThemeColors();
  const settingsPath = join(getAgentDir(), "settings.json");
  let applied = false;

  const write = (data: string) => {
    if (!process.stdout.isTTY) return;
    process.stdout.write(data);
  };

  const apply = () => {
    if (applied || !colors) return;
    applied = true;
    write(SET_BACKGROUND(colors.background) + SET_FOREGROUND(colors.foreground) + SET_CURSOR(colors.cursor));
  };

  const restore = () => {
    if (!applied) return;
    applied = false;
    write(RESET_BACKGROUND + RESET_FOREGROUND + RESET_CURSOR);
  };

  const sync = () => {
    if (activeThemeName() === THEME_NAME) apply();
    else restore();
  };

  // `/theme` persists the choice to settings.json, so polling that file keeps
  // the terminal colours in step with theme switches inside a running session.
  watchFile(settingsPath, { interval: 1000 }, sync);

  const cleanup = () => {
    unwatchFile(settingsPath, sync);
    restore();
  };

  // Writes to a TTY are synchronous, so the reset still reaches the terminal
  // from an "exit" listener. No signal listeners here: registering one would
  // suppress Node's default termination behaviour for Pi itself.
  process.once("exit", cleanup);

  pi.on("session_shutdown", () => {
    cleanup();
  });

  sync();
}
