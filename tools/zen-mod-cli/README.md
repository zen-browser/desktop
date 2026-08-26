# Zen Mod CLI

`zenmod` runs local Zen browser-chrome mods in an isolated Zen profile. It
launches Zen headlessly by default, selects the privileged
`chrome://browser/content/browser.xhtml` context, injects the mod stylesheet
and scripts, performs one operation, then exits.

The CLI does not require Sine. It reads `sine-mod.json` when present and falls
back to `chrome.css`, `preferences.json`, and `*.uc.js` by convention. CSS is
loaded through Zen's mods backend and scripts are loaded with Gecko's
privileged script loader.

## Setup

Install the CLI's pinned dependencies once:

```bash
npm --prefix tools/zen-mod-cli install
```

Check the local environment:

```bash
npm run zenmod -- doctor
```

Zen must be installed at `/Applications/Zen.app/Contents/MacOS/zen`, or supplied
with `--zen-path` or `ZEN_PATH`.

## Commands

Load a mod and report what was injected:

```bash
npm run zenmod -- load mods/zen-inbox
```

Inspect browser-chrome DOM without showing a window:

```bash
npm run zenmod -- inspect mods/zen-inbox \
  --selector ".zen-inbox-header"
```

Save a screenshot:

```bash
npm run zenmod -- screenshot mods/zen-inbox \
  --output /tmp/zen-inbox.png
```

Read browser console events generated after the automation session starts:

```bash
npm run zenmod -- console mods/zen-inbox
```

Use `--headed` only for a final visual smoke test. Other commands use a
headless window and do not consume macOS keyboard or pointer focus.

## Privileged functions

`eval` and `test` read a JavaScript function expression from a file. The
function runs in the browser window's privileged context and may be async.

An evaluation function can return any WebDriver BiDi serializable value:

```js
() => ({
  hasApi: Boolean(window.__zenInbox),
  workspace: window.gZenWorkspaces?.activeWorkspace,
})
```

Run it with:

```bash
npm run zenmod -- eval mods/zen-inbox --file /tmp/inspect-inbox.js
```

A test function returns a boolean, `{ pass: boolean }`, or an object containing
an `assertions` array whose entries each have a boolean `pass` field:

```js
async () => {
  const principal = Services.scriptSecurityManager.getSystemPrincipal();
  const tab = gBrowser.addTab("about:blank", { triggeringPrincipal: principal });

  try {
    window.__zenInbox.setInbox([tab], true);
    await new Promise(resolve => setTimeout(resolve, 50));

    return {
      assertions: [
        {
          name: "tab enters Inbox",
          pass: tab.getAttribute("zen-inbox") === "true",
        },
      ],
    };
  } finally {
    gBrowser.removeTab(tab);
  }
}
```

The command exits nonzero when the returned test result fails.

## Profile and security

The default profile parent is `~/.zenmod`. The underlying browser adapter
creates `~/.zenmod/zen_devtools_mcp_profile` and never connects to the normal
Zen profile. Override the parent with `--profile-parent` or
`ZENMOD_PROFILE_PARENT`.

Privileged functions can access browser internals and local system facilities.
Run functions from the repository or another trusted location. Do not point
this CLI at a profile containing personal cookies, passwords, or browsing
sessions.

## Implementation

The browser lifecycle and WebDriver BiDi connection come from the pinned
[`zen-devtools-mcp`](https://github.com/simon-ami/zen-devtools-mcp) package.
The CLI calls its reusable `ZenDevTools` class directly, so no MCP server or
MCP client is involved. That project is available under MIT or Apache-2.0.

The CLI adds the mod-specific interface: local manifest discovery, Zen mods
stylesheet injection, privileged userChrome script loading, deterministic JSON
output, test-result exit codes, and isolated-session cleanup.
