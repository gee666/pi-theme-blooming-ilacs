import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Observe real CLI lifecycle dispatch without invoking the package's handlers.
export default function (pi: ExtensionAPI) {
  const eventPath = process.env.PI_THEME_TEST_EVENTS;
  if (!eventPath) throw new Error("PI_THEME_TEST_EVENTS is required by the test observer");
  const record = (value: object) => appendFileSync(eventPath, JSON.stringify(value) + "\n");
  pi.on("session_start", (_event, ctx) => record({ event: "start", mode: ctx.mode }));
  pi.on("session_shutdown", () => record({ event: "shutdown" }));
}
