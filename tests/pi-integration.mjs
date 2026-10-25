import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
process.env.PI_OFFLINE = '1';
const { colorToHex } = await import('../tmp/pi-validation/node_modules/@earendil-works/pi-tui/dist/index.js');
const { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } =
  await import('../tmp/pi-validation/node_modules/@earendil-works/pi-coding-agent/dist/index.js');
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = mkdtempSync(`${root}tmp/integration-`);
mkdirSync(`${directory}/agent`);
const settingsManager = SettingsManager.inMemory({ packages: [root], terminal: { trueColor: true } });
const resourceLoader = new DefaultResourceLoader({
  cwd: directory, agentDir: `${directory}/agent`, settingsManager,
  noSkills: true, noPromptTemplates: true, noContextFiles: true,
});
const ST = '\x1b\\';
const APPLY = `\x1b]11;rgb:11/11/11${ST}\x1b]10;rgb:BD/AE/9D${ST}\x1b]12;rgb:EA/21/75${ST}`;
const RESET = `\x1b]111${ST}\x1b]110${ST}\x1b]112${ST}`;
let session;
const output = [];
const write = process.stdout.write;
const tty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const exitListeners = process.listenerCount('exit');
try {
  await resourceLoader.reload();
  const extensions = resourceLoader.getExtensions();
  assert.deepEqual(extensions.errors, []);
  assert.deepEqual(extensions.warnings, []);
  assert.equal(extensions.extensions.length, 1, 'Package manifest must load its background extension');
  const { themes, diagnostics } = resourceLoader.getThemes();
  assert.deepEqual(diagnostics, []);
  const theme = themes.find(theme => theme.name === 'blooming-ilacs-pi');
  assert.ok(theme, 'Package manifest must expose the theme');
  // Guard the palette's identity and distinct message/tool states, not only schema validity.
  for (const [token, color] of Object.entries({
    text: '#bdae9d', accent: '#ea2175', userMessageBg: '#6e452f',
    customMessageBg: '#1e1814', toolPendingBg: '#47382f',
    toolSuccessBg: '#2e2323', toolErrorBg: '#4a2028',
  })) {
    assert.equal(colorToHex(theme.colors[token]).toLowerCase(), color, token);
  }
  ({ session } = await createAgentSession({
    cwd: directory, agentDir: `${directory}/agent`, settingsManager, resourceLoader,
    sessionManager: SessionManager.inMemory(directory), noTools: true,
  }));
  // Only the terminal boundary is substituted. Pi loads and dispatches the real extension.
  process.stdout.write = data => { output.push(String(data)); return true; };
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
  const uiContext = { theme: { name: theme.name } };
  const errors = [];
  await session.bindExtensions({ mode: 'tui', uiContext, onError: error => errors.push(error) });
  assert.deepEqual(output, [APPLY]);
  await delay(300);
  assert.deepEqual(output, [APPLY], 'No repeated painting while the theme is unchanged');
  uiContext.theme.name = 'dark';
  await delay(300);
  assert.deepEqual(output, [APPLY, RESET]);
  uiContext.theme.name = theme.name;
  await delay(300);
  assert.deepEqual(output, [APPLY, RESET, APPLY]);
  await session.reload();
  assert.deepEqual(output, [APPLY, RESET, APPLY, RESET, APPLY], 'Reload must restore before reapplying');
  assert.equal(process.listenerCount('exit'), exitListeners + 1, 'Reload must not leak exit handlers');
  // Binding a non-TUI context cleans up the existing interactive lifecycle.
  await session.bindExtensions({ mode: 'print' });
  assert.equal(output.at(-1), RESET);
  const count = output.length;
  await delay(300);
  assert.equal(output.length, count);
  assert.equal(process.listenerCount('exit'), exitListeners);
  assert.deepEqual(errors, []);
} finally {
  if (session) {
    await session.bindExtensions({ mode: 'print' });
    session.dispose();
  }
  process.stdout.write = write;
  if (tty) Object.defineProperty(process.stdout, 'isTTY', tty);
  else delete process.stdout.isTTY;
  rmSync(directory, { recursive: true, force: true });
}
console.log('PASS Pi SDK: package discovery, semantic palette, active theme, reload and cleanup');
