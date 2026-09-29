import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import extension from "../extensions/blooming-ilacs-background.ts";

const ST = "\x1b\\";
const APPLY = `\x1b]11;rgb:11/11/11${ST}\x1b]10;rgb:BD/AE/9D${ST}\x1b]12;rgb:EA/21/75${ST}`;
const RESET = `\x1b]111${ST}\x1b]110${ST}\x1b]112${ST}`;

function harness(run) {
  const hooks = new Map();
  const output = [];
  const timers = new Set();
  const originalWrite = process.stdout.write;
  const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const exitListeners = process.listenerCount("exit");
  process.stdout.write = (data) => { output.push(data); return true; };
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
  globalThis.setInterval = (fn) => {
    const timer = { fn, unref() { this.unrefed = true; } };
    timers.add(timer);
    return timer;
  };
  globalThis.clearInterval = (timer) => timers.delete(timer);
  const ctx = { hasUI: true, mode: "tui", ui: { theme: { name: "blooming-ilacs-pi" } } };
  try {
    extension({ on: (name, handler) => hooks.set(name, handler) });
    run({
      output, timers, ctx,
      start: () => hooks.get("session_start")({}, ctx),
      stop: () => hooks.get("session_shutdown")(),
      tick: () => { for (const timer of timers) timer.fn(); },
    });
  } finally {
    hooks.get("session_shutdown")?.();
    process.stdout.write = originalWrite;
    if (ttyDescriptor) Object.defineProperty(process.stdout, "isTTY", ttyDescriptor);
    else delete process.stdout.isTTY;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
  assert.equal(timers.size, 0);
  assert.equal(process.listenerCount("exit"), exitListeners);
}

test("waits for session_start and emits exact RGB foreground, background and cursor", () => {
  harness(({ output, timers, start, tick, stop }) => {
    assert.deepEqual(output, []);
    assert.equal(timers.size, 0);
    start();
    assert.deepEqual(output, [APPLY]);
    assert.equal(timers.size, 1);
    assert.ok([...timers][0].unrefed);
    tick();
    assert.deepEqual(output, [APPLY]);
    stop();
    stop();
    assert.deepEqual(output, [APPLY, RESET]);
  });
});

test("follows the active UI theme without relying on persisted global settings", () => {
  harness(({ output, ctx, start, tick }) => {
    ctx.ui.theme = { name: "dark" };
    start();
    assert.deepEqual(output, []);
    ctx.ui.theme = { name: "blooming-ilacs-pi" };
    tick();
    assert.deepEqual(output, [APPLY]);
    ctx.ui.theme = { name: "light" };
    tick();
    tick();
    assert.deepEqual(output, [APPLY, RESET]);
    ctx.ui.theme = { name: "blooming-ilacs-pi" };
    tick();
    assert.deepEqual(output, [APPLY, RESET, APPLY]);
  });
});

test("does not emit OSCs or start timers in non-interactive modes", () => {
  for (const mode of ["rpc", "json", "print"]) {
    harness(({ output, timers, ctx, start }) => {
      ctx.mode = mode;
      start();
      assert.deepEqual(output, []);
      assert.equal(timers.size, 0);
    });
  }
  harness(({ output, timers, ctx, start }) => {
    ctx.hasUI = false;
    start();
    assert.deepEqual(output, []);
    assert.equal(timers.size, 0);
  });
  harness(({ output, timers, start }) => {
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: false });
    start();
    assert.deepEqual(output, []);
    assert.equal(timers.size, 0);
  });
});

test("supports older interactive contexts without mode", () => {
  harness(({ output, ctx, start }) => {
    delete ctx.mode;
    start();
    assert.deepEqual(output, [APPLY]);
  });
});

test("repeated session starts and shutdowns leave no timers or exit listeners", () => {
  harness(({ output, timers, start, stop }) => {
    start();
    start();
    assert.equal(timers.size, 1);
    assert.deepEqual(output, [APPLY, RESET, APPLY]);
    stop();
    start();
    assert.equal(timers.size, 1);
    assert.deepEqual(output, [APPLY, RESET, APPLY, RESET, APPLY]);
  });
});

test("Windows Terminal defaults match Pi's background and dimmer text", () => {
  const theme = JSON.parse(readFileSync(new URL("../blooming-ilacs-pi.json", import.meta.url)));
  const scheme = JSON.parse(readFileSync(new URL("../windows-terminal/blooming-ilacs.json", import.meta.url)));
  assert.equal(scheme.background, theme.export.pageBg);
  assert.equal(scheme.foreground, theme.vars[theme.colors.text]);
  assert.equal(scheme.cursorColor, theme.vars[theme.colors.accent]);
  assert.equal(scheme.white, scheme.foreground);
  assert.equal(scheme.brightWhite, scheme.foreground);
  const palette = ["black", "red", "green", "yellow", "blue", "purple", "cyan", "white"];
  for (const name of palette) {
    assert.match(scheme[name], /^#[0-9a-f]{6}$/i);
    assert.match(scheme[`bright${name[0].toUpperCase()}${name.slice(1)}`], /^#[0-9a-f]{6}$/i);
  }
});
