import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = join(root, "scripts/configure-truecolor.mjs");
function fixture(run) {
  mkdirSync(join(root, "tmp"), { recursive: true });
  const dir = mkdtempSync(join(root, "tmp/truecolor-test-"));
  try { run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function configure(...args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 10000 });
}

test("enables truecolor, preserves other settings and is repeatable", () => {
  fixture((dir) => {
    const path = join(dir, "settings.json");
    const original = { theme: "blooming-ilacs-pi", packages: ["example"], terminal: { images: false, trueColor: "auto" } };
    writeFileSync(path, JSON.stringify(original));
    for (let i = 0; i < 2; i++) {
      const result = configure(path);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
        ...original, terminal: { images: false, trueColor: true },
      });
    }
  });
});

test("creates missing settings and parent directories", () => {
  fixture((dir) => {
    const path = join(dir, "agent/settings.json");
    const result = configure(path);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { terminal: { trueColor: true } });
  });
});

test("writes through a shared settings symlink", { skip: process.platform === "win32" }, () => {
  fixture((dir) => {
    const target = join(dir, "windows-settings.json");
    const link = join(dir, "wsl-settings.json");
    writeFileSync(target, '{"theme":"blooming-ilacs-pi"}');
    symlinkSync(target, link);
    const result = configure(link);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), {
      theme: "blooming-ilacs-pi", terminal: { trueColor: true },
    });
  });
});

test("invalid settings are rejected without changing the file", () => {
  fixture((dir) => {
    const path = join(dir, "settings.json");
    for (const content of ["invalid json", "null", "[]", '{"terminal":null}', '{"terminal":[]}']) {
      writeFileSync(path, content);
      assert.equal(configure(path).status, 1);
      assert.equal(readFileSync(path, "utf8"), content);
    }
  });
});

test("requires exactly one explicit settings path", () => {
  assert.equal(configure().status, 1);
  assert.equal(configure("unused.json", "extra").status, 1);
});
