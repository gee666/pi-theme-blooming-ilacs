# Repository policy

## Pi compatibility and releases

- Target only the latest stable npm release of `@earendil-works/pi-coding-agent`. Resolve `@latest` again before each release. Do not maintain an older-version test matrix or add compatibility code solely for old Pi releases.
- Run `npm test` and `npm run test:pi` before release. Use the README setup commands to refresh the isolated validation dependencies.
- Update the README's tested-against record for every release with the exact Pi version actually checked and the checks performed. Never label an unrun browser, terminal, or end-to-end check as tested. A peer minimum is not a promise that every later version has been tested.
- Keep validation dependencies and temporary output under root `tmp/`. Do not ship them or add a Pi runtime dependency to a static theme or browser download.

## Code quality

- Remove dead code in the area you change. Keep responsibilities separate and fix the root cause with the simplest working change. Do not mix unrelated refactors into a fix.
- Keep files focused and normally under 350 lines. Explain exceptions in the change description; do not split cohesive data or existing test fixtures just to satisfy a count.
- Validate external input at its boundary. Keep configuration explicit and separate from logic. Never commit secrets, credentials, local settings, or generated validation output.
- Add regression tests for changed behavior. Run available tests and the stack-specific checks below. If a linter or type checker is not configured, say so rather than claiming it passed.
- Keep docs accurate about commands, supported behavior, and validation limits. Apply `unslop` and `write-prompts` skills when available.
- Preserve unrelated local changes. Stage only your own edits and inspect the staged diff before committing.

## Stack-specific checks

This package contains theme JSON, a TypeScript terminal-background extension, and Node.js tests. Keep terminal lifecycle handling in the extension and palette values in the JSON. Test non-interactive guards, OSC output, theme switches, and cleanup without writing control sequences to the developer's terminal.
Run `npm test`, `npm run check`, `npm run typecheck`, and `npm run test:pi`. The latter checks Pi's actual theme validator/loader and extension registration. No linter is configured. Mocked OSC tests and loader registration do not replace visual checks in a real terminal.
