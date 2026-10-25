import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Observe real lifecycle dispatch; never invoke the extension's handlers ourselves.
export default function (pi: ExtensionAPI) {
  const eventPath = process.env.PI_THEME_TEST_EVENTS;
  if (!eventPath) throw new Error("PI_THEME_TEST_EVENTS is required by the test observer");
  const record = (value: object) => appendFileSync(eventPath, JSON.stringify(value) + "\n");
  pi.on("session_start", (_event, ctx) => record({ event: "start", mode: ctx.mode, theme: ctx.ui.theme.name }));
  pi.on("session_shutdown", () => record({ event: "shutdown" }));
  pi.registerCommand("evergreen-theme", {
    description: "Test-only active theme change",
    handler: async (name, ctx) => {
      const result = ctx.ui.setTheme(name);
      record({ event: "theme", name, ...result, active: ctx.ui.theme.name });
    },
  });
  pi.registerCommand("evergreen-colors", {
    description: "Test-only semantic text rendering",
    handler: async (_args, ctx) => {
      ctx.ui.notify(ctx.ui.theme.fg("text", "EVERGREEN_THEME_TEXT"));
      record({ event: "colors" });
    },
  });
  pi.registerCommand("evergreen-process-exit", {
    description: "Test-only exit fallback (bypass session_shutdown)",
    handler: async () => process.exit(0),
  });
  pi.registerCommand("evergreen-exit", {
    description: "Test-only orderly shutdown",
    handler: async (_args, ctx) => ctx.shutdown(),
  });
}
