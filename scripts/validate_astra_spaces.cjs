#!/usr/bin/env node
/* Source validation for Astra Spaces launch-safe upgrade. */
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

function validateBalancedXulTags(rel) {
  const text = read(rel);
  const stack = [];
  let i = 0;
  let line = 1;

  const advance = n => {
    for (let k = 0; k < n; k++) {
      if (text[i + k] === "\n") line++;
    }
    i += n;
  };

  while (i < text.length) {
    if (text[i] === "\n") {
      line++;
      i++;
      continue;
    }
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end < 0) {
        fail(`XUL unclosed comment in ${rel}:${line}`);
        return;
      }
      advance(end + 3 - i);
      continue;
    }
    if (text[i] !== "<") {
      i++;
      continue;
    }
    if (text[i + 1] === "!" || text[i + 1] === "?") {
      let j = i + 2;
      while (j < text.length && text[j] !== ">") {
        if (text[j] === "\n") line++;
        j++;
      }
      if (j >= text.length) {
        fail(`XUL truncated directive in ${rel}:${line}`);
        return;
      }
      advance(j + 1 - i);
      continue;
    }
    const close = text[i + 1] === "/";
    let j = i + (close ? 2 : 1);
    if (text[j] === "/") {
      fail(`XUL malformed tag in ${rel}:${line}`);
      return;
    }
    let name = "";
    while (j < text.length && /[A-Za-z0-9:_-]/.test(text[j])) {
      name += text[j++];
    }
    if (!name) {
      i++;
      continue;
    }
    let selfClosing = false;
    while (j < text.length && text[j] !== ">") {
      if (text[j] === "\n") line++;
      if (text[j] === "/" && text[j + 1] === ">") {
        selfClosing = true;
        j += 2;
        break;
      }
      // skip quoted attrs
      if (text[j] === '"' || text[j] === "'") {
        const q = text[j++];
        while (j < text.length && text[j] !== q) {
          if (text[j] === "\n") line++;
          j++;
        }
        j++;
        continue;
      }
      j++;
    }
    if (j < text.length && text[j] === ">") {
      j++;
    }
    if (close) {
      if (!stack.length || stack[stack.length - 1].name !== name) {
        fail(
          `XUL unexpected </${name}> in ${rel}:${line} (expected ${
            stack.length ? stack[stack.length - 1].name : "none"
          })`
        );
        return;
      }
      stack.pop();
    } else if (!selfClosing) {
      stack.push({ name, line });
    }
    advance(j - i);
  }
  if (stack.length) {
    fail(
      `XUL unclosed <${stack[stack.length - 1].name}> in ${rel}:${stack[stack.length - 1].line}`
    );
    return;
  }
  ok(`balanced XUL tags ${rel}`);
}

const requiredModules = [
  "src/zen/spaces/AstraSpaceIntegrity.mjs",
  "src/zen/spaces/AstraSpaceRouting.mjs",
  "src/zen/spaces/AstraSpaceOverview.mjs",
  "src/zen/spaces/AstraSpaceAppBridge.mjs",
  "src/zen/spaces/AstraSpaceAppState.mjs",
  "src/zen/spaces/astra-space-peek.css",
];

for (const rel of requiredModules) {
  if (exists(rel)) {
    ok(`present ${rel}`);
  } else {
    fail(`missing ${rel}`);
  }
}

const moz = read("src/zen/spaces/moz.build");
for (const name of [
  "AstraSpaceIntegrity.mjs",
  "AstraSpaceRouting.mjs",
  "AstraSpaceOverview.mjs",
  "AstraSpaceAppBridge.mjs",
  "AstraSpaceAppState.mjs",
]) {
  if (moz.includes(`"${name}"`)) {
    ok(`moz.build packs ${name}`);
  } else {
    fail(`moz.build missing ${name}`);
  }
}

const jar = read("src/zen/spaces/jar.inc.mn");
{
  // Plain CSS must NOT use jar.mn preprocessing (*). failUnused rejects empty PP.
  const peekJarLines = jar
    .split(/\r?\n/)
    .filter(line => line.includes("astra-space-peek.css"));
  const dest =
    "content/browser/zen-styles/astra-space-peek.css";
  const srcRel = "../../zen/spaces/astra-space-peek.css";
  if (peekJarLines.length !== 1) {
    fail(
      `astra-space-peek.css jar mapping count=${peekJarLines.length} (want 1)`
    );
  } else {
    const line = peekJarLines[0];
    const trimmed = line.trimStart();
    if (trimmed.startsWith("*")) {
      fail(
        "astra-space-peek.css must not use jar.mn preprocessing (*)"
      );
    } else if (!line.includes(dest) || !line.includes(srcRel)) {
      fail("astra-space-peek.css jar destination/source mismatch");
    } else if (!exists("src/zen/spaces/astra-space-peek.css")) {
      fail("astra-space-peek.css source missing");
    } else {
      ok("jar packs astra-space-peek.css once without preprocessing");
    }
  }
}

const assets = read("src/browser/base/content/zen-assets.inc.xhtml");
{
  const peekAssetCount = (
    assets.match(/astra-space-peek\.css/g) || []
  ).length;
  if (peekAssetCount === 1) {
    ok("assets include peek CSS exactly once");
  } else {
    fail(`assets peek CSS count=${peekAssetCount} (want 1)`);
  }
}

const integrity = read("src/zen/spaces/AstraSpaceIntegrity.mjs");
const routing = read("src/zen/spaces/AstraSpaceRouting.mjs");
const overview = read("src/zen/spaces/AstraSpaceOverview.mjs");
const bridge = read("src/zen/spaces/AstraSpaceAppBridge.mjs");
const appState = read("src/zen/spaces/AstraSpaceAppState.mjs");
const mgr = read("src/zen/spaces/ZenSpaceManager.mjs");
const icons = read("src/zen/spaces/ZenSpaceIcons.mjs");
const hubMgr = read("src/zen/common/modules/AstraAppHubManager.mjs");
const ftl = read("locales/en-US/browser/browser/zen-workspaces.ftl");
const popups = read("src/browser/base/content/zen-panels/popups.inc");

if (
  integrity.includes("validateSpaceState") &&
  integrity.includes("buildRepairPlan") &&
  integrity.includes("RECOVERED_TABS_SPACE_UUID") &&
  integrity.includes("sanitizeSpacePins") &&
  integrity.includes("resolveLaunchSpace") &&
  integrity.includes("chooseSafeActiveSpace") &&
  integrity.includes("calculateRecoveredTabAssignments") &&
  integrity.includes("classifyTabForIntegrity") &&
  integrity.includes("isSpaceIntegrityReady") &&
  integrity.includes("resolveRecoveredSpaceIdentity") &&
  integrity.includes("orphan-live") &&
  integrity.includes("zombie-stale") &&
  integrity.includes("nextSwitchGeneration") &&
  integrity.includes("shouldRollbackSwitch") &&
  /Mutation-free|never mutates/i.test(integrity)
) {
  ok("integrity pure validation surface present");
} else {
  fail("integrity API incomplete");
}

if (
  mgr.includes("AfterWorkspacesSessionRestore") &&
  mgr.includes("#astraSessionRestoreComplete") &&
  /selectStartPage[\s\S]*#astraSessionRestoreComplete\s*=\s*true[\s\S]*#runAstraSpaceIntegrity\("startup"\)/.test(
    mgr
  ) &&
  !mgr.includes("#armAstraSpaceIntegrityAfterRestore") &&
  !/#runAstraSpaceIntegrity\("startup"\)[\s\S]*#armAstra/.test(mgr)
) {
  ok("integrity readiness gated on AfterWorkspacesSessionRestore via selectStartPage");
} else {
  fail("integrity readiness gate incomplete or double-armed");
}

if (
  integrity.includes("assign-orphan-tabs") &&
  integrity.includes("ensure-recovered-tabs-space") &&
  !/gBrowser\.removeTab\(tab/.test(integrity)
) {
  ok("repair preserves orphan tabs (no removeTab in integrity)");
} else {
  fail("orphan repair may still discard tabs");
}

if (
  mgr.includes("#runAstraSpaceIntegrity") &&
  mgr.includes("ensureAstraRecoveredTabsSpace") &&
  mgr.includes("switchSpaceSafely") &&
  mgr.includes("deleteSpaceSafely") &&
  mgr.includes("astra-spaces-delete-move") &&
  mgr.includes("BUTTON_POS_2") &&
  /void this\.#runAstraSpaceIntegrity\("startup"\)/.test(mgr)
) {
  ok("ZenSpaceManager integrity/switch/delete hooks present");
} else {
  fail("ZenSpaceManager Astra hooks incomplete");
}

if (
  routing.includes("switchSpaceSafely") &&
  routing.includes("_astraSwitchGeneration") &&
  routing.includes("shouldRollbackSwitch") &&
  routing.includes("ownsSwitchGeneration") &&
  routing.includes("rolling back") &&
  routing.includes("openURLInSpace") &&
  routing.includes("moveTabToWorkspace") &&
  !/setAttribute\(\s*["']zen-workspace-id["']/.test(routing)
) {
  ok("routing uses canonical move + transactional switch");
} else {
  fail("routing unsafe or incomplete");
}

if (
  overview.includes("AstraSpaceOverview") &&
  overview.includes("openSpacePeek") &&
  overview.includes("BATCH_SIZE") &&
  overview.includes("Escape") &&
  overview.includes("focusSearch") &&
  !/thumbnail|screenshot|PlacesUtils/i.test(overview) &&
  !/https?:\/\/(?!mozilla\.org)/i.test(overview) &&
  !/addTabsProgressListener/.test(overview)
) {
  ok("Space Peek is lazy/local/no thumbnails");
} else {
  fail("Space Peek unsafe or incomplete");
}

if (
  popups.includes('id="PanelUI-astra-space-peek"') &&
  popups.includes("context_zenPeekWorkspace") &&
  popups.includes("astra-space-peek-switch") &&
  icons.includes("openAstraSpacePeekFor") &&
  icons.includes("focusSearch: false") &&
  icons.includes("focusSearch: true") &&
  icons.includes("zen-compact-animating") &&
  icons.includes("switchSpaceSafely")
) {
  ok("Peek markup + icon triggers present");
} else {
  fail("Peek UI wiring incomplete");
}

if (
  bridge.includes("launchAppInSpace") &&
  bridge.includes("pinAppToCurrentSpace") &&
  appState.includes("spacePins") &&
  appState.includes("SPACE_APP_STATE_VERSION") &&
  appState.includes("sanitizeSpacePins") &&
  appState.includes("privateWindow") &&
  hubMgr.includes("openURLInSpace") &&
  hubMgr.includes("pin-space") &&
  hubMgr.includes("#spacePinIds") &&
  hubMgr.includes("#refreshSpacePins") &&
  hubMgr.includes("#beginFaviconCapture(app, launchedTab)") &&
  /Space routing failed; falling back/.test(hubMgr)
) {
  ok("App Hub Space routing + pins present");
} else {
  fail("App Hub Space bridge incomplete");
}

if (
  ftl.includes("astra-spaces-recovered-tabs-name") &&
  ftl.includes("astra-space-peek-open") &&
  ftl.includes("astra-spaces-delete-move") &&
  ftl.includes("astra-app-hub-pin-current-space") &&
  ftl.includes("astra-space-peek-more") &&
  mgr.includes("astra-spaces-recovered-tabs-name") &&
  hubMgr.includes("astra-app-hub-pin-current-space")
) {
  ok("Fluent Space strings present and referenced");
} else {
  fail("Fluent Space strings missing or unwired");
}

// Eager import chain: Overview must not be static-imported by Manager/Icons/AppHub
{
  const dynamicPeek =
    /ChromeUtils\.importESModule\(\s*"resource:\/\/\/modules\/zen\/AstraSpaceOverview\.mjs"\s*\)/.test(
      mgr
    );
  const noStaticOverview =
    !/import\s+[^;]*AstraSpaceOverview/.test(mgr) &&
    !/import\s+[^;]*AstraSpaceOverview/.test(icons) &&
    !/import\s+[^;]*AstraSpaceOverview/.test(hubMgr) &&
    !/import\s+[^;]*AstraSpaceOverview/.test(integrity);
  if (dynamicPeek && noStaticOverview) {
    ok("Peek module is dynamically imported only");
  } else {
    fail("Peek eager import regression");
  }
}

// Catalog / icons regression guards
const catalog = read("src/zen/common/app-hub/AstraAppHubCatalog.mjs");
const hubIcons = read("src/zen/common/modules/AstraAppHubIcons.mjs");
if (
  /schemaVersion:\s*1/.test(catalog) &&
  hubIcons.includes("MAX_DATA_ICON_CHARS") &&
  hubIcons.includes("MAX_STORED_ICON_BYTES") &&
  (hubIcons.match(/gmail\.svg/g) || []).length >= 1
) {
  ok("App Hub catalog/favicon limits untouched");
} else {
  fail("App Hub catalog/favicon regression");
}

const preload = read("src/zen/common/ZenPreloadedScripts.js");
if (
  !preload.includes("AstraSpaceOverview") &&
  !preload.includes("AstraSpaceAppBridge") &&
  !preload.includes("AstraAppHubManager.mjs")
) {
  ok("no startup Peek/AppBridge/AppHub manager preload");
} else {
  fail("startup preload regression");
}

validateBalancedXulTags("src/browser/base/content/zen-panels/popups.inc");
validateBalancedXulTags("src/browser/base/content/zen-assets.inc.xhtml");

// Duplicate ID check for peek panel
const peekIds = [
  "PanelUI-astra-space-peek",
  "astra-space-peek-title",
  "astra-space-peek-list",
  "astra-space-peek-switch",
  "context_zenPeekWorkspace",
];
for (const id of peekIds) {
  const re = new RegExp(`(?:^|\\s)id="${id}"`, "gm");
  const count = (popups.match(re) || []).length;
  if (count === 1) {
    ok(`unique id ${id}`);
  } else {
    fail(`id ${id} count=${count}`);
  }
}

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll Astra Spaces source checks passed.");
process.exit(0);
