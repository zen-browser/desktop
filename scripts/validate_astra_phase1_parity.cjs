#!/usr/bin/env node
/* Source-level validation for Astra Phase 1 native parity. */
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

const energy = read("src/zen/common/modules/ZenEnergySaver.mjs");
const phase1 = read("src/zen/common/modules/AstraPhase1Actions.mjs");
const folders = read("src/zen/folders/ZenFolders.mjs");
const preload = read("src/zen/common/ZenPreloadedScripts.js");
const welcome = read("src/zen/welcome/ZenWelcome.mjs");
const welcomeFtl = read("locales/en-US/browser/browser/zen-welcome.ftl");
const tabsInc = read("src/browser/components/preferences/zenTabsManagement.inc.xhtml");
const prefsYamlEnergy = exists("prefs/zen/energy-saver.yaml")
  ? read("prefs/zen/energy-saver.yaml")
  : "";
const multilingual = read("prefs/firefox/multilingual.yaml");
const foldersYaml = read("prefs/zen/folders.yaml");
const sb = read("src/zen/common/modules/AstraSurakshaSafeBrowsing.mjs");
const pw = read("src/zen/common/modules/AstraSurakshaPasswords.mjs");
const manager = read("src/zen/common/modules/AstraSurakshaManager.mjs");
const jar = read("src/zen/common/jar.inc.mn");
const policies = exists("build/AppDir/distribution/policies.json")
  ? read("build/AppDir/distribution/policies.json")
  : "";

// Energy Saver — single manager, bounded modes
if (energy.includes('VALID_MODES = new Set(["auto", "on", "off"])')) {
  ok("Energy Saver modes bounded to auto/on/off");
} else fail("Energy Saver mode set missing");
if (energy.includes("#setAttributeOnAllWindows") && energy.includes("getEnumerator")) {
  ok("Energy Saver syncs attribute across browser windows");
} else fail("Energy Saver missing multi-window attribute sync");
if (energy.includes("zen.energy-saver.mode") && energy.includes("astra-energy-saver")) {
  ok("Energy Saver uses existing attribute and mode pref");
} else fail("Energy Saver pref/attribute wiring missing");

if (
  energy.includes("astra-energy-saver-enabled-manual") &&
  energy.includes("astra-energy-saver-disabled-manual")
) {
  ok("Energy Saver toasts distinguish manual vs battery reasons");
} else fail("Energy Saver toast honesty missing");
if (/layers\.acceleration\.disabled|webrender\.software|sandbox|fission/i.test(energy)) {
  fail("Energy Saver must not touch security/graphics prefs");
} else ok("Energy Saver does not disable security/HA");
if ((energy.match(/export const gZenEnergySaver/g) || []).length === 1) {
  ok("one Energy Saver export");
} else fail("Energy Saver export count wrong");

if (prefsYamlEnergy.includes('zen.energy-saver.mode') && prefsYamlEnergy.includes('"auto"')) {
  ok("energy-saver.yaml default auto");
} else fail("energy-saver.yaml missing/default wrong");

// Performance settings links
for (const about of ["about:processes", "about:unloads", "about:memory"]) {
  if (tabsInc.includes(about) || read("src/browser/components/preferences/zen-settings.js").includes(about)) {
    ok(`performance link ${about}`);
  } else fail(`missing performance link ${about}`);
}
if (/force.?webrender|disable.?sandbox|processCount|webgl\.force|acceleration\.disabled/i.test(tabsInc)) {
  fail("performance settings exposes unsafe prefs");
} else ok("performance settings has no unsafe pref controls");

// Tab search — native % only
if (phase1.includes('OPENPAGE_TOKEN = "%"') && phase1.includes("RESULT_SOURCE.TABS")) {
  ok("tab search uses native % / TABS searchMode");
} else fail("tab search not native");
if (/tabIndex|allTabs\.map|gBrowser\.tabs\.filter/.test(phase1)) {
  fail("custom tab index/scan present");
} else ok("no custom tab scan");
if (!/localStorage|sessionStorage|Services\.prefs\.set.*search/.test(phase1)) {
  ok("no stored tab-search queries");
} else fail("tab search persists queries");

// Narrate — native Reader only
if (phase1.includes("View:ReaderView") && !/speechSynthesis|SpeechSynthesis|fetch\(.*tts/i.test(phase1)) {
  ok("Read Aloud uses native Reader path without cloud TTS");
} else fail("Read Aloud path unsafe or missing");
if (phase1.includes("isReaderActive") && phase1.includes("setTimeout")) {
  ok("Read Aloud confirms Reader before success toast");
} else fail("Read Aloud success path not verified");

// Translation
if (/intl\.multilingual\.downloadEnabled[\s\S]*value:\s*true/.test(multilingual)) {
  ok("translation model downloads enabled via Firefox path");
} else fail("intl.multilingual.downloadEnabled not true");
if (!/translate\.google|deepl\.com|astra.*translate/i.test(multilingual + phase1 + tabsInc)) {
  ok("no Astra/cloud translation servers");
} else fail("cloud translation reference found");

// Suraksha adapters lazy/open-gated
if (
  !preload.includes("AstraSurakshaSafeBrowsing") &&
  !preload.includes("AstraSurakshaPasswords") &&
  !preload.includes("AstraSurakshaManager")
) {
  ok("new Suraksha adapters not in startup preload");
} else fail("Suraksha adapters eagerly preloaded");
if (
  manager.includes("readSafeBrowsing") &&
  manager.includes("readPasswords") &&
  manager.includes("if (this.isOpen)")
) {
  ok("Suraksha manager wires new cards with open-gated refresh");
} else fail("Suraksha manager wiring incomplete");
if (manager.includes("astra-suraksha-card-detail-extra") && pw.includes("passwords-partial")) {
  ok("Suraksha detail cards render full detail list + partial password state");
} else fail("Suraksha detail honesty incomplete");
if (/getAllLogins|Services\.logins|searchLogins|nsILoginInfo/i.test(pw)) {
  fail("password adapter accesses credentials");
} else ok("password adapter is prefs-only");
if (/No threats found|fully up to date|security score|% safe/i.test(sb)) {
  fail("Safe Browsing adapter has fake claims");
} else ok("Safe Browsing adapter has no fake freshness/score");
if (/fetch\(|XMLHttpRequest|http-on-modify/i.test(sb + pw)) {
  fail("Suraksha Phase1 adapters perform network/request work");
} else ok("Suraksha Phase1 adapters are local prefs-only");

if (jar.includes("AstraSurakshaSafeBrowsing.mjs") && jar.includes("AstraSurakshaPasswords.mjs")) {
  ok("jar packages new Suraksha adapters");
} else fail("jar missing new Suraksha adapters");

// Accordion extends ZenFolders
if (
  folders.includes("zen.folders.accordion-mode") &&
  folders.includes("#collapseSiblingFolders") &&
  foldersYaml.includes("zen.folders.accordion-mode")
) {
  ok("accordion extends existing ZenFolders");
} else fail("accordion wiring missing");
if (folders.includes("tab?.selected") || folders.includes("tab.selected")) {
  ok("accordion skips folders holding selected tabs");
} else fail("accordion missing active-tab guard");
if (/TabCollectionStore|second.?group.?database|new TabGroupManager/i.test(folders)) {
  fail("second tab-group store detected");
} else ok("no second tab-group store");

// Marketing honesty
if (!welcome.includes("zen-feat-gestures") && !welcomeFtl.includes("mouse gestures")) {
  ok("mouse-gesture marketing claim removed");
} else fail("mouse-gesture claim still present");
if (/fastest browser|100% safe|scam proof/i.test(welcomeFtl)) {
  fail("unsupported marketing claim remains");
} else ok("welcome marketing cleaned");
if (welcomeFtl.includes("packaged") && welcomeFtl.includes("uBlock")) {
  ok("uBlock wording matches Windows/Linux packaging truth");
} else fail("uBlock packaging-honest wording missing");
if (/No telemetry sent to anyone|Force secure connections always/i.test(welcomeFtl)) {
  fail("absolute privacy overclaim remains");
} else ok("welcome privacy claims tempered");

// uBlock packaging truth
const xpiPath = "build/AppDir/distribution/extensions/uBlock0@raymondhill.net.xpi";
if (exists(xpiPath)) ok("signed uBlock XPI present in build/AppDir/distribution");
else fail("uBlock XPI missing from expected packaging path");
if (
  policies.includes("uBlock0@raymondhill.net") &&
  policies.includes("force_installed")
) {
  ok("policies force_install + lock uBlock");
} else fail("policies.json uBlock force_installed missing");

// App Hub / Suraksha bootstrap architecture
if (
  preload.includes("AstraAppHubBootstrap.mjs") &&
  !preload.includes("AstraAppHubManager.mjs") &&
  preload.includes("AstraSurakshaBootstrap.mjs")
) {
  ok("App Hub/Suraksha bootstrap-only preload preserved");
} else fail("preload architecture regression");

const hubMgr = read("src/zen/common/modules/AstraAppHubManager.mjs");
if (
  hubMgr.includes("#applyCatalogReadyState") &&
  hubMgr.includes("#retryCatalog") &&
  hubMgr.includes("#retryInFlight") &&
  hubMgr.includes("#catalogRetryExhausted") &&
  hubMgr.includes("#handoffFocusFromHiddenFallback") &&
  hubMgr.includes("AstraAppHubCatalog.mjs") &&
  hubMgr.includes("ASTRA_APP_HUB_CATALOG") &&
  hubMgr.includes("iconKey") &&
  hubMgr.includes("getPackagedIconURL") &&
  !hubMgr.includes("NetUtil") &&
  !/\bfetch\s*\(/.test(hubMgr) &&
  !/Try again after restarting/i.test(hubMgr)
) {
  ok("App Hub catalog fail-safe keeps fallback (ESM, no restart-only path)");
} else fail("App Hub catalog fail-safe regression");

const hubIconsParity = read("src/zen/common/modules/AstraAppHubIcons.mjs");
const hubJarParity = read("src/zen/common/jar.inc.mn");
if (
  hubIconsParity.includes("ASTRA_APP_HUB_ICONS") &&
  hubIconsParity.includes("getFaviconForPage") &&
  hubIconsParity.includes("data:image/") &&
  hubIconsParity.includes("sanitizeDataImageURI") &&
  hubIconsParity.includes("cachedFaviconData") &&
  hubIconsParity.includes("MAX_STORED_ICON_BYTES") &&
  hubIconsParity.includes("migrateLegacyIconFileName") &&
  !/["'`]page-icon:/.test(hubIconsParity) &&
  !/\bsrc\s*=\s*["'`]file:/i.test(hubIconsParity) &&
  (hubJarParity.match(/app-hub-icons\//g) || []).length >= 44 &&
  !hubJarParity.includes("ICON_SOURCES.md")
) {
  ok("App Hub packaged icon registry + JAR mappings present");
} else fail("App Hub icon packaging regression");

const hubMgrParityExtra = read("src/zen/common/modules/AstraAppHubManager.mjs");
if (
  hubMgrParityExtra.includes("#beginFaviconCapture") &&
  hubMgrParityExtra.includes("addTabsProgressListener") &&
  hubMgrParityExtra.includes("#stopAllFaviconCaptures") &&
  hubMgrParityExtra.includes("#cancelFaviconCapture") &&
  hubMgrParityExtra.includes("expectedUrl") &&
  !/\bonLinkIconAvailable\s*\(/.test(hubMgrParityExtra)
) {
  ok("App Hub bounded favicon capture present");
} else fail("App Hub favicon capture regression");

// Transparent / performance invariants
const theme = read("prefs/zen/theme.yaml");
if (/browser\.tabs\.allow_transparent_browser[\s\S]*value:\s*false/.test(theme)) {
  ok("allow_transparent_browser remains false");
} else fail("allow_transparent_browser not false");

const perf = read("prefs/firefox/performance.yaml");
const privacy = read("prefs/privatefox/privacy.yaml");
if (/^\s*- name:\s*dom\.ipc\.processCount/m.test(perf)) {
  fail("processCount override reintroduced");
} else ok("no processCount override");
if (
  /network\.dns\.disablePrefetch[\s\S]*value:\s*false/.test(privacy) &&
  /network\.prefetch-next[\s\S]*value:\s*true/.test(privacy)
) {
  ok("performance networking prefs intact");
} else fail("performance networking prefs regresssed");

if (/fission\.autostart[\s\S]*value:\s*false|security\.sandbox[\s\S]*value:\s*false/.test(perf + privacy)) {
  fail("sandbox/Fission weakened");
} else ok("sandbox/Fission not weakened in Astra prefs");

/**
 * Stack-based XUL/XML tag balance check.
 * Reports file, line, expected tag, and actual tag on mismatch/unclosed tags.
 */
function validateBalancedXulTags(rel) {
  const filePath = path.join(root, rel);
  const text = fs.readFileSync(filePath, "utf8");
  const stack = [];
  let i = 0;
  let line = 1;

  const advance = (n) => {
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

    if (text.startsWith("<![CDATA[", i)) {
      const end = text.indexOf("]]>", i + 9);
      if (end < 0) {
        fail(`XUL unclosed CDATA in ${rel}:${line}`);
        return;
      }
      advance(end + 3 - i);
      continue;
    }

    if (text[i] !== "<") {
      i++;
      continue;
    }

    // Declarations / processing instructions — skip to '>'
    if (text[i + 1] === "!" || text[i + 1] === "?") {
      const startLine = line;
      let j = i + 2;
      while (j < text.length && text[j] !== ">") {
        if (text[j] === "\n") line++;
        j++;
      }
      if (j >= text.length) {
        fail(`XUL unclosed declaration in ${rel}:${startLine}`);
        return;
      }
      i = j + 1;
      continue;
    }

    const tagStartLine = line;
    const isClose = text[i + 1] === "/";
    let j = i + (isClose ? 2 : 1);
    while (j < text.length && /[A-Za-z0-9_:-]/.test(text[j])) j++;
    if (j === i + (isClose ? 2 : 1)) {
      i++;
      continue;
    }
    const tagName = text.slice(i + (isClose ? 2 : 1), j);

    // Scan to end of tag, respecting quotes
    let inQuote = null;
    let selfClosing = false;
    let closed = false;
    while (j < text.length) {
      const ch = text[j];
      if (ch === "\n") line++;
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
        j++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        j++;
        continue;
      }
      if (ch === "/" && text[j + 1] === ">") {
        selfClosing = true;
        j += 2;
        closed = true;
        break;
      }
      if (ch === ">") {
        j++;
        closed = true;
        break;
      }
      j++;
    }
    if (!closed) {
      fail(`XUL unclosed tag <${tagName}> in ${rel}:${tagStartLine}`);
      return;
    }

    i = j;

    if (selfClosing) continue;

    if (isClose) {
      if (!stack.length) {
        fail(
          `XUL tag mismatch in ${rel}:${tagStartLine}: expected (none), found </${tagName}>`
        );
        return;
      }
      const top = stack[stack.length - 1];
      if (top.name !== tagName) {
        fail(
          `XUL tag mismatch in ${rel}:${tagStartLine}: expected </${top.name}>, found </${tagName}>`
        );
        return;
      }
      stack.pop();
    } else {
      stack.push({ name: tagName, line: tagStartLine });
    }
  }

  if (stack.length) {
    const top = stack[stack.length - 1];
    fail(
      `XUL unclosed tag in ${rel}: <${top.name}> opened at line ${top.line} (expected </${top.name}>)`
    );
    return;
  }
  ok(`balanced XUL tags ${rel}`);
}

const xulMarkupFiles = [
  "src/browser/base/content/zen-panels/popups.inc",
  "src/browser/base/content/zen-panels/site-data.inc",
  "src/browser/base/content/zen-commands.inc.xhtml",
  "src/browser/components/preferences/zenTabsManagement.inc.xhtml",
];
for (const rel of xulMarkupFiles) {
  if (!exists(rel)) {
    fail(`missing XUL markup file ${rel}`);
    continue;
  }
  validateBalancedXulTags(rel);
}

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll Phase 1 parity checks passed.");
process.exit(0);
