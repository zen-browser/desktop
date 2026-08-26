---
name: zen-mod-testing
description: Tests local Zen mods through an isolated headless browser-chrome session. Use when developing or debugging Zen mod CSS, userChrome scripts, privileged browser UI, or files under mods/.
---

# Zen mod testing

Use the repository's `zenmod` CLI for mod validation. It launches a dedicated
headless profile, injects the local mod without Sine, runs one operation, and
closes Zen.

## Workflow

1. Run `npm run zenmod -- doctor`.
2. If the CLI dependency is missing, run
   `npm --prefix tools/zen-mod-cli install`, then rerun `doctor`.
3. Choose the narrowest command:
   - `load <mod>` verifies manifest, stylesheet, and script injection.
   - `inspect <mod> --selector <css>` reads browser-chrome DOM and styles.
   - `eval <mod> --file <function.js>` investigates privileged state.
   - `test <mod> --file <function.js>` runs assertions with a meaningful exit
     code.
   - `console <mod>` captures console events from the session.
   - `screenshot <mod> --output <png>` captures the headless chrome context.
4. Keep reusable test functions beside the mod. Use a temporary file for a
   one-off investigation.
5. Read screenshot files with the available image-reading tool.
6. Report the command, result, and any behavior still requiring a visible
   smoke test.

## Test functions

The file passed to `eval` or `test` contains one function expression. It runs
inside `chrome://browser/content/browser.xhtml`, so browser globals such as
`gBrowser`, `Services`, and the mod's `window.__...` interface are available.
It may be async.

A test returns a boolean, `{ pass: boolean }`, or:

```js
async () => ({
  assertions: [
    {
      name: "descriptive behavior",
      pass: true,
      actual: "optional",
      expected: "optional",
    },
  ],
})
```

Clean up tabs, windows, preferences, and observers in `finally` blocks.

## Guardrails

Use the default headless dedicated profile. Treat `--headed` as a final visual
smoke test because a visible WebDriver session can take macOS focus.

Run only trusted privileged function files. Never point `--profile-parent` at a
normal Zen profile. Prefer structured DOM assertions over OS-level automation.

Generic HTML drag events do not reproduce Firefox tab drag payloads. Test tab
drag behavior with a purpose-built privileged function or a headless
browser-chrome mochitest.

For full command syntax and examples, read
`tools/zen-mod-cli/README.md` or run `npm run zenmod -- --help`.
