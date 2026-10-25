import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// npm provides its CLI path on every supported platform, including Windows.
// Run it through Node with explicit arguments, without a shell.
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run this validator with npm run test:pi');
const prefix = new URL('../tmp/pi-validation/', import.meta.url);
// SDK-only validation: never install or execute a second Pi runtime here.
// Provision the SDK, TypeScript and Node types under tmp/pi-validation beforehand.

const piRoot = new URL('node_modules/@earendil-works/pi-coding-agent/', prefix);
const installed = JSON.parse(readFileSync(new URL('package.json', piRoot), 'utf8'));
const latest = execFileSync(process.execPath,
  [npmCli, 'view', '@earendil-works/pi-coding-agent@latest', 'version'],
  { encoding: 'utf8', timeout: 30000 }).trim();
assert.equal(installed.version, latest, 'Validation SDK does not match the latest npm release');
assert.ok(process.env.PI_EVERGREEN_PI_BIN, 'PI_EVERGREEN_PI_BIN must identify the supplied global CLI');
assert.equal(execFileSync(process.env.PI_EVERGREEN_PI_BIN, ['--version'],
  { encoding: 'utf8', timeout: 10000 }).trim(), latest, 'Global CLI must match latest SDK');
// These internal validation entry points intentionally track the latest Pi.
const { validateThemeJson } = await import(new URL('dist/modes/interactive/theme/theme-schema.js', piRoot));
const { loadThemeFromPath, setThemeJsonValidator } = await import(new URL('dist/modes/interactive/theme/theme.js', piRoot));
setThemeJsonValidator(validateThemeJson);

function checkTheme(path) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  validateThemeJson(path, json);
  assert.throws(() => validateThemeJson('invalid', { ...json, colors: {} }));
  const theme = loadThemeFromPath(path);
  assert.equal(theme.name, json.name);
  assert.equal(typeof theme.fg('text', 'validation'), 'string');
  assert.equal(typeof theme.bg('userMessageBg', 'validation'), 'string');
  console.log(`Pi ${installed.version}: schema and loader passed for ${json.name}`);
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.pi.themes.length, 1);
for (const file of pkg.pi.themes) checkTheme(fileURLToPath(new URL(`../${file}`, import.meta.url)));

const { discoverAndLoadExtensions } = await import(new URL('dist/index.js', piRoot));
const extensionPaths = pkg.pi.extensions.map(file => fileURLToPath(new URL(`../${file}`, import.meta.url)));
const isolated = mkdtempSync(fileURLToPath(new URL('../tmp/loader-', import.meta.url)));
mkdirSync(`${isolated}/agent`);
let result;
try {
  result = await discoverAndLoadExtensions(extensionPaths, isolated, `${isolated}/agent`);
} finally {
  rmSync(isolated, { recursive: true, force: true });
}
assert.deepEqual(result.errors, []);
assert.deepEqual(result.warnings, []);
assert.equal(result.extensions.length, extensionPaths.length);
for (const extension of result.extensions) {
  assert.equal(extension.handlers.get('session_start')?.length, 1);
  assert.equal(extension.handlers.get('session_shutdown')?.length, 1);
}
console.log('Pi extension loader registered both lifecycle handlers; no interactive terminal session was run.');
