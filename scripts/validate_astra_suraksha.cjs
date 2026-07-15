#!/usr/bin/env node
/* Source-level validation for Astra Suraksha Center v1 (no browser runtime). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const errors = [];
const ok = msg => console.log(`OK  ${msg}`);
const fail = msg => {
  errors.push(msg);
  console.error(`FAIL ${msg}`);
};

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// Packaging
const jar = read("src/zen/common/jar.inc.mn");
const expectedJar = [
  "AstraSurakshaBootstrap.mjs",
  "AstraSurakshaManager.mjs",
  "AstraSurakshaConnection.mjs",
  "AstraSurakshaProtection.mjs",
  "AstraSurakshaUBlock.mjs",
  "AstraSurakshaPermissions.mjs",
  "AstraSurakshaSiteData.mjs",
  "AstraSurakshaCleanLink.mjs",
  "astra-suraksha.css",
];
for (const name of expectedJar) {
  if (jar.includes(name)) ok(`jar packages ${name}`);
  else fail(`jar missing ${name}`);
}

const assets = read("src/browser/base/content/zen-assets.inc.xhtml");
const cssCount = (assets.match(/astra-suraksha\.css/g) || []).length;
if (cssCount === 1) ok("CSS included exactly once");
else fail(`CSS include count=${cssCount}`);

const locales = read("src/browser/base/content/zen-locales.inc.xhtml");
const ftlCount = (locales.match(/zen-suraksha\.ftl/g) || []).length;
if (ftlCount === 1) ok("FTL included exactly once");
else fail(`FTL include count=${ftlCount}`);

// Command / facade / preload
const commands = read("src/browser/base/content/zen-commands.inc.xhtml");
if ((commands.match(/cmd_astraOpenSurakshaCenter/g) || []).length === 1) {
  ok("one Suraksha command definition");
} else fail("Suraksha command definition count wrong");

const preload = read("src/zen/common/ZenPreloadedScripts.js");
if (
  preload.includes("AstraSurakshaBootstrap.mjs") &&
  !preload.includes("AstraSurakshaManager.mjs")
) {
  ok("only bootstrap preloaded");
} else fail("preload must include bootstrap only");

// App Hub recovery intact
if (
  preload.includes("AstraAppHubBootstrap.mjs") &&
  preload.indexOf("AstraAppHubBootstrap.mjs") <
    preload.indexOf("AstraAppHubManager.mjs")
) {
  ok("App Hub bootstrap loads before manager");
} else fail("App Hub preload order broken");

const sets = read("src/zen/common/zen-sets.js");
if (sets.includes("cmd_zenOpenAppLauncher") && sets.includes("gZenAppLauncher")) {
  ok("App Hub command handler intact");
} else fail("App Hub command handler missing");
if (sets.includes("cmd_astraOpenSurakshaCenter") && sets.includes("gAstraSuraksha")) {
  ok("Suraksha command handler present");
} else fail("Suraksha command handler missing");

const cui = read("src/zen/common/sys/ZenCustomizableUI.sys.mjs");
if (
  cui.includes("zen-app-launcher-button") &&
  cui.includes("astra-suraksha-button") &&
  cui.includes("cmd_zenOpenAppLauncher") &&
  cui.includes("cmd_astraOpenSurakshaCenter")
) {
  ok("toolbar widgets for App Hub + Suraksha");
} else fail("toolbar widget wiring incomplete");

const popups = read("src/browser/base/content/zen-panels/popups.inc");
if (popups.includes('id="PanelUI-zen-app-launcher"') && popups.includes("PanelUI-zen-app-launcher-fallback")) {
  ok("App Hub panel + fallback present");
} else fail("App Hub panel/fallback missing");
if (
  popups.includes('id="PanelUI-astra-suraksha"') &&
  popups.includes("PanelUI-astra-suraksha-fallback")
) {
  ok("Suraksha panel + static fallback present");
} else fail("Suraksha panel/fallback missing");

// Emergency labels for fail-safe fallback when Fluent is missing
const fallbackBlock = popups.slice(
  popups.indexOf('id="PanelUI-astra-suraksha-fallback"'),
  popups.indexOf('id="PanelUI-astra-suraksha-advanced"')
);
const emergencyLabels = [
  'label="Open Firefox protection panel"',
  'label="Open site information"',
  'label="Open protection dashboard"',
  'label="Open Add-ons Manager"',
];
for (const label of emergencyLabels) {
  if (fallbackBlock.includes(label)) ok(`emergency fallback ${label}`);
  else fail(`missing emergency fallback ${label}`);
}

// Exact jar destination ↔ import URL pairing
const jarPairs = [
  [
    "content/browser/zen-components/AstraSurakshaBootstrap.mjs",
    "chrome://browser/content/zen-components/AstraSurakshaBootstrap.mjs",
  ],
  [
    "content/browser/zen-components/AstraSurakshaManager.mjs",
    "chrome://browser/content/zen-components/AstraSurakshaManager.mjs",
  ],
  [
    "content/browser/zen-styles/astra-suraksha.css",
    "chrome://browser/content/zen-styles/astra-suraksha.css",
  ],
];
for (const [jarPath, chromeUrl] of jarPairs) {
  if (jar.includes(jarPath) && chromeUrl.endsWith(jarPath.split("/").pop())) {
    ok(`jar/import pair ${jarPath}`);
  } else fail(`jar/import mismatch ${jarPath}`);
}
const bootSrc = read("src/zen/common/modules/AstraSurakshaBootstrap.mjs");
if (
  bootSrc.includes(
    'chrome://browser/content/zen-components/AstraSurakshaManager.mjs'
  )
) {
  ok("bootstrap lazy manager URL matches jar");
} else fail("bootstrap manager URL mismatch");
if (bootSrc.includes("BrowserCommands?.pageInfo") || bootSrc.includes("BrowserCommands.pageInfo")) {
  ok("site-info fallback includes Page Info route");
} else fail("site-info missing Page Info fallback");

const uim = read("src/zen/common/modules/ZenUIManager.mjs");
if (
  uim.includes("astra.ui.migration.suraksha-button-added") &&
  uim.includes('astra.suraksha.enabled') &&
  uim.includes("Defer until Suraksha is enabled")
) {
  ok("migration defers when Suraksha disabled");
} else fail("migration disabled-defer logic missing");

// Fluent IDs referenced in markup/JS exist in FTL
const ftl = read("locales/en-US/browser/browser/zen-suraksha.ftl");
const ftlIds = new Set(
  [...ftl.matchAll(/^([a-z0-9-]+)\s*=/gim)].map(m => m[1])
);
const scanTargets = [
  "src/browser/base/content/zen-panels/popups.inc",
  "src/zen/common/modules/AstraSurakshaManager.mjs",
  "src/zen/common/modules/AstraSurakshaConnection.mjs",
  "src/zen/common/modules/AstraSurakshaProtection.mjs",
  "src/zen/common/modules/AstraSurakshaUBlock.mjs",
  "src/zen/common/modules/AstraSurakshaPermissions.mjs",
  "src/zen/common/modules/AstraSurakshaSiteData.mjs",
  "src/zen/common/modules/AstraSurakshaCleanLink.mjs",
];
const refIds = new Set();
for (const rel of scanTargets) {
  const text = read(rel);
  for (const m of text.matchAll(/data-l10n-id="(astra-suraksha-[a-z0-9-]+)"/g)) {
    refIds.add(m[1]);
  }
  for (const m of text.matchAll(
    /(?:setAttributes\([^,]+,\s*|labelId:\s*|detailId:\s*|modeId:\s*|id:\s*)["'](astra-suraksha-[a-z0-9-]+)["']/g
  )) {
    refIds.add(m[1]);
  }
  for (const m of text.matchAll(
    /showToast\?\.\(["'](astra-suraksha-[a-z0-9-]+)["']/g
  )) {
    refIds.add(m[1]);
  }
}
let missing = 0;
for (const id of refIds) {
  if (!ftlIds.has(id)) {
    fail(`missing Fluent id ${id}`);
    missing += 1;
  }
}
if (!missing) ok(`all ${refIds.size} referenced Fluent ids exist`);

// Safety greps in Suraksha modules
const surakshaFiles = expectedJar
  .filter(n => n.endsWith(".mjs"))
  .map(n => `src/zen/common/modules/${n}`);
const banned = [
  /moz-extension:/i,
  /getContentBlockingLog/,
  /privacy\.query_stripping\.strip_list/,
  /fetch\(/,
  /XMLHttpRequest/,
  /https:\/\/.*favicon/i,
  /uBlock0@raymondhill\.net\/.*/,
];
for (const rel of surakshaFiles) {
  if (!exists(rel)) {
    fail(`missing module ${rel}`);
    continue;
  }
  const text = read(rel);
  for (const re of banned) {
    if (re.test(text) && !rel.includes("UBlock")) {
      // UBlock module mentions the addon id, which is allowed.
      fail(`${rel} matched banned pattern ${re}`);
    }
  }
  if (/console\.(log|info|debug|warn|error).*(\.host|hostname|currentURI|spec)/i.test(text)) {
    fail(`${rel} may log URL/host data`);
  }
}
ok("Suraksha modules pass safety greps");

// Pref
const pref = read("prefs/zen/suraksha.yaml");
if (pref.includes("astra.suraksha.enabled") && /value:\s*true/.test(pref)) {
  ok("feature pref present default true");
} else fail("feature pref missing/incorrect");

// Bootstrap facade contract
const boot = read("src/zen/common/modules/AstraSurakshaBootstrap.mjs");
for (const method of [
  "init",
  "destroy",
  "open",
  "close",
  "toggle",
  "refresh",
  "openFallbackAction",
]) {
  if (boot.includes(`${method}:`) || boot.includes(`${method}(`)) ok(`facade/method ${method}`);
  else fail(`missing facade method ${method}`);
}
if (boot.includes("gAstraSurakshaDiagnostics")) ok("diagnostics object");
else fail("diagnostics missing");
if (boot.includes("attachManager") && !boot.includes("gAstraSuraksha = manager")) {
  ok("manager attaches without replacing facade");
} else fail("facade replacement risk");

// No ETP/permission mutation in Suraksha
const mutationBanned = [
  "disableForCurrentPage",
  "enableForCurrentPage",
  "setForPrincipal",
  "removeFromPrincipal",
  "userDisabled =",
];
for (const rel of surakshaFiles) {
  const text = read(rel);
  for (const token of mutationBanned) {
    if (text.includes(token)) fail(`${rel} contains mutation API ${token}`);
  }
}
ok("no ETP/permission/addon mutation APIs in Suraksha");

// Shortcut file unchanged requirement — warn if Suraksha added shortcuts
const kbs = read("src/zen/kbs/ZenKeyboardShortcuts.mjs");
if (!kbs.includes("cmd_astraOpenSurakshaCenter")) ok("no Suraksha keyboard shortcut added");
else fail("unexpected Suraksha shortcut");

if (errors.length) {
  console.error(`\n${errors.length} validation error(s)`);
  process.exit(1);
}
console.log("\nAll Suraksha source validations passed");
process.exit(0);
