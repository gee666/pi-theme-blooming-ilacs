import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Explicit opt-in only. WSL alone does not prove the terminal supports RGB.
const [settingsPath, ...extra] = process.argv.slice(2);
if (!settingsPath || extra.length) {
  console.error("Usage: node scripts/configure-truecolor.mjs <pi-settings.json>");
  process.exit(1);
}

try {
  const path = resolve(settingsPath);
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (!isObject(settings) || (settings.terminal !== undefined && !isObject(settings.terminal))) {
    throw new Error("Settings and terminal must be JSON objects; no changes written.");
  }
  settings.terminal = { ...settings.terminal, trueColor: true };
  mkdirSync(dirname(path), { recursive: true });
  // Write through existing symlinks, including shared Windows/WSL settings.
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600 });
  console.log(`Enabled terminal.trueColor in ${path}. Restart Pi to apply.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
