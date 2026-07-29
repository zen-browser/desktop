#!/usr/bin/env node
/* Source-level validation for Astra UI finishing (tabs, App Hub, Suraksha). */
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
        fail(`XUL unclosed declaration in ${rel}:${line}`);
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

// —— TAB GEOMETRY ——
const astraTabs = read("src/zen/common/styles/astra-tabs.css");
if (
  astraTabs.includes("padding-inline") &&
  astraTabs.includes("--astra-tab-lane-gutter") &&
  astraTabs.includes("zen-workspace-tabs-section")
) {
  ok("tab lane uses owning-container logical gutter");
} else fail("tab lane gutter missing");

if (/:root\s+\.tab-background\s*\{\s*margin-inline:\s*0/.test(astraTabs)) {
  fail("astra-tabs globally zeros every tab-background margin without gutter");
} else ok("no global zero tab-background margin without container gutter");

if (
  /tab-background[^{]*\{[^}]*margin(?:-inline)?\s*:\s*-/.test(astraTabs) ||
  /translateX\s*\(/.test(astraTabs) ||
  /translateZ\s*\(/.test(astraTabs) ||
  /will-change\s*:/.test(astraTabs)
) {
  fail("tab geometry uses negative margin/translate/will-change workaround");
} else ok("no negative-margin/translate/will-change tab workaround");

if (!/width\s*:\s*-moz-available/.test(astraTabs)) {
  ok("astra-tabs does not force -moz-available full-bleed width");
} else fail("astra-tabs forces full-bleed -moz-available width");

// —— APP HUB ——
const hubMgr = read("src/zen/common/modules/AstraAppHubManager.mjs");
const hubCss = read("src/zen/common/styles/astra-app-hub.css");
const hubFtl = read("locales/en-US/browser/browser/zen-app-hub.ftl");
const jar = read("src/zen/common/jar.inc.mn");
const preload = read("src/zen/common/ZenPreloadedScripts.js");
const popups = read("src/browser/base/content/zen-panels/popups.inc");
const catalogRel = "src/zen/common/app-hub/AstraAppHubCatalog.mjs";
const CATALOG_MODULE_URL =
  "chrome://browser/content/zen-components/AstraAppHubCatalog.mjs";

if (!exists(catalogRel)) {
  fail("catalog ESM module missing on disk");
} else {
  const catalogJarLines = jar
    .split(/\r?\n/)
    .filter(line =>
      /^\s*content\/browser\/zen-components\/AstraAppHubCatalog\.mjs\b/.test(
        line
      )
    );
  if (catalogJarLines.length === 1) ok("catalog packaged exactly once");
  else fail(`catalog jar entries != 1 (${catalogJarLines.length})`);

  if (jar.includes("astra-app-hub-catalog.json")) {
    fail("legacy catalog JSON still packaged");
  } else ok("legacy catalog JSON mapping removed");

  if (hubMgr.includes(CATALOG_MODULE_URL)) {
    ok("manager catalog URL matches JAR destination");
  } else fail("manager catalog URL mismatch");

  if (exists("src/zen/common/app-hub/astra-app-hub-catalog.json")) {
    fail("legacy catalog JSON file still present (must be single canonical source)");
  } else ok("single canonical ESM catalog source");
}

if (
  hubMgr.includes("loadPackagedCatalog") &&
  hubMgr.includes("ChromeUtils.importESModule") &&
  hubMgr.includes("ASTRA_APP_HUB_CATALOG") &&
  hubMgr.includes("#applyCatalogReadyState") &&
  hubMgr.includes("#retryCatalog") &&
  hubMgr.includes("#retryInFlight") &&
  hubMgr.includes("#catalogRetryExhausted") &&
  !hubMgr.includes("NetUtil") &&
  !/\bfetch\s*\(/.test(hubMgr) &&
  !/channel\.open\s*\(/.test(hubMgr)
) {
  ok("App Hub ESM catalog loader + fail-safe state machine present");
} else fail("App Hub fail-safe state machine incomplete or still uses fetch/NetUtil");

const preloadSrc = read("src/zen/common/ZenPreloadedScripts.js");
if (
  /ChromeUtils\.importESModule\(\s*"chrome:\/\/browser\/content\/zen-components\//.test(
    preloadSrc
  ) &&
  /ChromeUtils\.importESModule\(\s*"chrome:\/\/browser\/content\/zen-components\/AstraAppHubState\.mjs"/.test(
    hubMgr
  )
) {
  ok("chrome:// ES module imports have in-tree precedent (preload + App Hub)");
} else fail("chrome:// ES module import precedent missing");

const applyReadyFn = hubMgr.slice(
  hubMgr.indexOf("#applyCatalogReadyState()"),
  hubMgr.indexOf("#showFallbackFailureBanner(")
);
if (
  hubMgr.includes("#applyCatalogReadyState") &&
  /setAdvancedReady\?\.\(ready\)/.test(applyReadyFn) &&
  applyReadyFn.includes("stage: \"render\"") &&
  applyReadyFn.includes("this.#rebuildList()") &&
  applyReadyFn.includes("this.#rendered") &&
  applyReadyFn.includes("this.#destroyed || window.closed") &&
  hubMgr.includes("#handoffFocusFromHiddenFallback") &&
  applyReadyFn.indexOf("this.#rebuildList()") <
    applyReadyFn.indexOf("setAdvancedReady?.(ready)")
) {
  ok("advanced-ready gated on catalog+shell+render, destroyed-safe, rebuild-before-handoff");
} else fail("advanced-ready gating missing or unsafe handoff order");

if (
  hubMgr.includes("#showFallbackFailureBanner") &&
  hubMgr.includes("astra-app-hub-advanced-unavailable") &&
  hubMgr.includes("retry-catalog")
) {
  ok("catalog failure activates fallback + retry banner");
} else fail("fallback failure banner missing");

if (/Try again after restarting|restart required/i.test(hubMgr + hubFtl)) {
  fail("restart-only recovery message still present");
} else ok("no restart-only App Hub recovery message");

if (/https?:\/\/.*catalog|fetch\(\s*["']https?:/i.test(hubMgr)) {
  fail("remote catalog request detected");
} else ok("no remote catalog request");

if (
  preload.includes("AstraAppHubBootstrap.mjs") &&
  !preload.includes("AstraAppHubManager.mjs") &&
  !preload.includes("AstraAppHubCatalog.mjs")
) {
  ok("no startup manager/catalog import");
} else fail("App Hub manager/catalog eagerly preloaded");

const bootstrap = read("src/zen/common/modules/AstraAppHubBootstrap.mjs");
const bootstrapTop = bootstrap.slice(0, bootstrap.indexOf("class AstraAppHubBootstrap"));
// V3: the manager chrome URL may be declared as a module-scope const string, but
// nothing (catalog or manager) may be *imported* eagerly. importESModule must
// only appear inside the class (lazy init/prewarm), never before the class body.
if (
  !bootstrap.includes("AstraAppHubCatalog") &&
  !/^\s*import\s+.*AstraAppHubManager/m.test(bootstrap) &&
  !bootstrapTop.includes("importESModule") &&
  bootstrap.includes("ChromeUtils.importESModule") &&
  bootstrap.includes("AstraAppHubManager.mjs")
) {
  ok("bootstrap lazy-imports manager (no eager catalog/manager import)");
} else fail("bootstrap eagerly imports catalog or manager");

// V3 single shell: popups.inc must NOT carry the static fallback catalog block.
if (!popups.includes("PanelUI-zen-app-launcher-fallback")) {
  ok("popups.inc has no static PanelUI-zen-app-launcher-fallback block (single shell)");
} else fail("popups.inc still contains the removed static fallback block");

// V3 minimal shell: one container + one list, packaged in app-hub-mode="shell".
if (
  popups.includes('id="PanelUI-zen-app-launcher-container"') &&
  popups.includes('id="PanelUI-zen-app-launcher-list"') &&
  /app-hub-mode="shell"/.test(popups)
) {
  ok("popups.inc keeps the minimal single-shell container + list (app-hub-mode=shell)");
} else fail("popups.inc single-shell container/list/mode missing");

// Idle prewarm after delayed startup (V3 perf finishing).
if (
  (/idleDispatchToMainThread/.test(bootstrap) ||
    /requestIdleCallback/.test(bootstrap)) &&
  /#schedulePrewarm|#dispatchIdlePrewarm|prewarm/.test(bootstrap) &&
  (bootstrap.includes("delayedStartupFinished") ||
    bootstrap.includes("browser-delayed-startup-finished"))
) {
  ok("bootstrap idle-prewarms the manager after delayed startup");
} else fail("bootstrap idle prewarm / delayed-startup deferral missing");

// The normal-state "basic apps are ready" notice must never appear anywhere.
const NORMAL_UNAVAILABLE_NOTICE =
  "Advanced App Hub is unavailable. Basic apps are ready.";
if (
  !hubMgr.includes(NORMAL_UNAVAILABLE_NOTICE) &&
  !hubFtl.includes(NORMAL_UNAVAILABLE_NOTICE) &&
  !bootstrap.includes(NORMAL_UNAVAILABLE_NOTICE)
) {
  ok("no normal-state 'basic apps are ready' unavailable banner string");
} else fail("normal-state 'basic apps are ready' banner string still present");

// V3 single shell: the 44-app catalog is owned by the manager/catalog module,
// not a static fallback subtree. Confirm the packaged catalog + icons still hold
// 44 apps (imported-catalog shape is verified in validateCatalogModuleShape).
const catalogSrc = read(catalogRel);
if (/schemaVersion:\s*1/.test(catalogSrc)) {
  ok("catalog declares schemaVersion 1 (single canonical source)");
} else fail("catalog schemaVersion missing");

const hubIcons = read("src/zen/common/modules/AstraAppHubIcons.mjs");
if (
  hubIcons.includes("ASTRA_APP_HUB_ICONS") &&
  hubIcons.includes("getPackagedIconURL") &&
  hubIcons.includes(
    "chrome://browser/content/zen-components/app-hub-icons/"
  ) &&
  !/https?:\/\/.*favicon|duckduckgo\.com\/ip3|clearbit/i.test(hubIcons)
) {
  ok("packaged icon registry present (local chrome only)");
} else fail("packaged icon registry missing or allows remote icons");

const iconJarLines = jar
  .split(/\r?\n/)
  .filter(line =>
    /^\s*content\/browser\/zen-components\/app-hub-icons\//.test(line)
  );
if (iconJarLines.length === 44) {
  ok("exactly 44 app-hub icon JAR mappings");
} else fail(`app-hub icon JAR mappings != 44 (${iconJarLines.length})`);

if (
  hubCss.includes('data-icon-loaded="true"') &&
  /\[data-icon-loaded="true"\][\s\S]*visibility:\s*hidden/.test(hubCss) &&
  /icon-stack\s*>\s*\.zen-app-launcher-item-icon[\s\S]*visibility:\s*hidden/.test(
    hubCss
  ) &&
  /\[data-icon-loaded="true"\]\s*>\s*\.zen-app-launcher-item-icon[\s\S]*visibility:\s*visible/.test(
    hubCss
  ) &&
  !/#PanelUI-zen-app-launcher-fallback \.zen-app-launcher-item-icon \{\s*display:\s*none/s.test(
    hubCss
  ) &&
  !/-moz-context-properties/.test(hubCss)
) {
  ok("icon success hides monogram; pre-load monogram visible; no fill mask");
} else fail("icon/monogram visibility CSS incomplete");

// V3: tiles are built by the manager with an XHTML <img> (createElementNS), and
// load/error must be bound BEFORE src so a synchronous/cached decode cannot be
// missed. XUL <image> no longer fires load/error (Bug 1815229).
if (
  hubMgr.includes("data-icon-loaded") &&
  hubMgr.includes("data-icon-error") &&
  hubMgr.includes("astra-app-hub-item-icon-stack") &&
  /createElementNS\(\s*[\s\S]{0,40}"http:\/\/www\.w3\.org\/1999\/xhtml",\s*[\s\S]{0,20}"img"/.test(
    hubMgr
  ) &&
  !/document\.createElement\("img"\)/.test(hubMgr)
) {
  ok("manager builds tiles with XHTML img (createElementNS) load/error, not XUL image");
} else fail("manager icon load/error handling missing or still uses XUL image");

// The manager must reconcile each already-complete <img> right after setting
// src (image.complete / naturalWidth) so a synchronous decode does not leave the
// tile stuck on its monogram. Shared #reconcileIconState helper owns this.
if (
  hubMgr.includes("#reconcileIconState") &&
  /image\.src\s*=\s*\w+[\s\S]{0,500}#reconcileIconState/.test(hubMgr) &&
  /#reconcileIconState[\s\S]*\.complete/.test(hubMgr) &&
  /#reconcileIconState[\s\S]*naturalWidth/.test(hubMgr) &&
  /#reconcileIconState[\s\S]*data-icon-loaded/.test(hubMgr) &&
  /#reconcileIconState[\s\S]*data-icon-error/.test(hubMgr)
) {
  ok("manager reconciles already-complete icons via complete/naturalWidth (no monogram-only lock)");
} else {
  fail(
    "manager does not reconcile already-complete icons; synchronously-decoded logos would not render"
  );
}

if (
  hubMgr.includes("resolvePlacesFaviconURL") &&
  hubMgr.includes("resolveCustomAppFaviconDataURI") &&
  hubMgr.includes("#enrichCustomAppIcon") &&
  hubMgr.includes("button.isConnected") &&
  hubMgr.includes("#beginFaviconCapture") &&
  hubMgr.includes("#stopAllFaviconCaptures") &&
  hubMgr.includes("#cancelFaviconCapture") &&
  hubMgr.includes("setCachedFaviconData") &&
  hubMgr.includes("expectedUrl") &&
  hubMgr.includes("addTabsProgressListener") &&
  hubMgr.includes("STATE_IS_WINDOW") &&
  hubMgr.includes("customIconData") &&
  hubMgr.includes("cachedFaviconData") &&
  hubMgr.includes("#pendingResetIcon") &&
  hubMgr.includes('"reset-icon"') &&
  hubMgr.includes("migrateLegacyIconFileName") &&
  hubMgr.includes("astra-app-hub-error-icon-too-large") &&
  hubMgr.includes("astra-app-hub-error-private-edit") &&
  !/\bonLinkIconAvailable\s*\(/.test(hubMgr) &&
  hubIcons.includes("getFaviconForPage") &&
  hubIcons.includes("fetchRemoteFaviconAsDataURI") &&
  hubIcons.includes("parseHtmlIconCandidates") &&
  hubIcons.includes("resolveCustomAppFaviconDataURI") &&
  hubIcons.includes("data:image/") &&
  hubIcons.includes("sanitizeDataImageURI") &&
  hubIcons.includes("pickCustomIconAsDataURI") &&
  hubIcons.includes("customIconData") &&
  hubIcons.includes("MAX_DATA_ICON_CHARS") &&
  hubIcons.includes("MAX_STORED_ICON_BYTES") &&
  hubIcons.includes("MAX_DECODE_EDGE") &&
  hubIcons.includes("rasterBytesToSafeDataURI") &&
  hubIcons.includes("migrateLegacyIconFileName") &&
  hubIcons.includes('type: "image/png"') &&
  !hubIcons.includes("localIconFileURI") &&
  !/\bsrc\s*=\s*["'`]file:/i.test(hubIcons) &&
  !/["'`]page-icon:/.test(hubIcons) &&
  !/["'`]page-icon:/.test(hubMgr) &&
  !/favicon\?\.uri/.test(hubMgr) &&
  !/favicon\.uri\.spec/.test(hubIcons) &&
  !/duckduckgo\.com\/ip3|gstatic\.com\/favicon|clearbit|google\.com\/s2\/favicons/i.test(
    hubMgr + hubIcons
  )
) {
  ok(
    "custom favicon: Places + direct site discovery + bounded capture + no proxy"
  );
} else fail("custom favicon hardening incomplete or unsafe");

const hubState = read("src/zen/common/modules/AstraAppHubState.mjs");
if (
  hubState.includes("cachedFaviconData") &&
  hubState.includes("customIconData") &&
  hubState.includes("sanitizeDataImageURI") &&
  hubState.includes("iconSource") &&
  hubState.includes("clearCustomIcon") &&
  hubState.includes("urlChanged") &&
  hubState.includes("setCachedFaviconData") &&
  hubState.includes("expectedUrl") &&
  hubState.includes("MAX_TOTAL_CUSTOM_ICON_CHARS") &&
  /MAX_DATA_ICON_CHARS\s*=\s*256\s*\*\s*1024/.test(hubState) &&
  hubState.includes('iconSource: "monogram"') &&
  hubState.includes("image/svg") &&
  hubState.includes("moz-extension:") &&
  !hubState.includes("image/x-icon") &&
  !hubState.includes("700_000")
) {
  ok("state stores custom/learned icons with URL-change clear");
} else fail("App Hub state custom-icon schema incomplete");

if (
  hubFtl.includes("astra-app-hub-editor-icon") &&
  hubFtl.includes("astra-app-hub-editor-reset-icon") &&
  hubFtl.includes("astra-app-hub-error-icon-unsupported") &&
  hubFtl.includes("astra-app-hub-error-icon-too-large") &&
  hubFtl.includes("astra-app-hub-error-private-edit") &&
  hubMgr.includes("astra-app-hub-error-icon-unsupported") &&
  hubMgr.includes("#setEditorErrorL10n")
) {
  ok("App Hub icon/private Fluent strings wired");
} else fail("App Hub icon Fluent strings missing or unwired");

if (
  hubMgr.includes("expectedOrigin") &&
  hubMgr.includes("cross-origin-final") &&
  hubMgr.includes("same-origin") &&
  hubState.includes("urlChanged") &&
  /cachedFaviconData\s*=\s*""/.test(hubState)
) {
  ok("redirect same-origin policy + URL-edit clears learned favicon");
} else fail("redirect/URL-edit favicon guards incomplete");

if (
  !bootstrap.includes("AstraAppHubIcons") &&
  !bootstrap.includes("PlacesUtils") &&
  !bootstrap.includes("getFaviconForPage") &&
  !bootstrap.includes("ASTRA_APP_HUB_CATALOG") &&
  !bootstrap.includes("#beginFaviconCapture")
) {
  ok("bootstrap performs no startup icon/catalog/Places work");
} else fail("bootstrap references icon/catalog/Places at module scope");

// First-open manager request must expose the exact failing stage and must NOT
// permanently process-cache a rejection behind a stale flag; a later open or a
// Retry can re-attempt. The manager exposes a sanitized advanced diagnostic.
if (
  bootstrap.includes('"manager-import"') &&
  bootstrap.includes('"manager-create"') &&
  bootstrap.includes('"manager-init"') &&
  !bootstrap.includes("#managerImportFailed") &&
  bootstrap.includes("managerStage") &&
  hubMgr.includes("get advancedDiagnostics()")
) {
  ok("App Hub manager: staged diagnostics, retryable rejection, manager-ready flag exposed");
} else {
  fail(
    "App Hub manager staging / non-cached rejection / advancedDiagnostics incomplete"
  );
}
// advanced-ready must still be gated after rebuild and the import must use the
// proven chrome URL with the current-window global.
// V3 declares the manager chrome URL as a module const and imports it lazily
// with the current-window global. Accept either the literal URL or the const.
if (
  /MANAGER_MODULE_URL\s*=\s*\n?\s*"chrome:\/\/browser\/content\/zen-components\/AstraAppHubManager\.mjs"/.test(
    bootstrap
  ) &&
  /ChromeUtils\.importESModule\(\s*(?:MANAGER_MODULE_URL|"chrome:\/\/browser\/content\/zen-components\/AstraAppHubManager\.mjs"),\s*\{\s*global:\s*"current"\s*\}\s*\)/.test(
    bootstrap
  )
) {
  ok("App Hub manager import uses proven chrome URL + current-window global");
} else {
  fail("App Hub manager import URL/global option incorrect");
}

if (
  !jar.includes("ICON_SOURCES.md") &&
  exists("src/zen/common/app-hub/ICON_SOURCES.md")
) {
  const sources = read("src/zen/common/app-hub/ICON_SOURCES.md");
  const sourceRows = (sources.match(/^\| [a-z][a-z0-9-]* \|/gm) || []).length;
  if (
    sources.includes("| File |") &&
    /trademark/i.test(sources) &&
    /generated-identification/i.test(sources) &&
    !/C:\\\\ZenFork|C:\/ZenFork/i.test(sources) &&
    sourceRows === 44
  ) {
    ok("ICON_SOURCES.md documents 44 apps (source-only, not JAR-packaged)");
  } else fail("ICON_SOURCES.md incomplete or implies bad provenance");
} else fail("ICON_SOURCES.md missing or incorrectly JAR-mapped");

// V3 single shell: CSS keeps the compact fatal banner + monogram styling, must
// NOT depend on app-hub-mode="fallback", keeps a single scroll region, and
// reveals the favorite star on hover AND keyboard focus (focus-within).
const hubScrollRegions = (hubCss.match(/overflow-y:\s*auto/g) || []).length;
if (
  hubCss.includes("astra-app-hub-fallback-banner") &&
  hubCss.includes("astra-app-hub-retry-btn") &&
  hubCss.includes("zen-app-launcher-item-monogram") &&
  !/app-hub-mode="fallback"/.test(hubCss) &&
  hubScrollRegions <= 1 &&
  /:hover .astra-app-hub-fav-btn/.test(hubCss) &&
  /:focus-within .astra-app-hub-fav-btn/.test(hubCss)
) {
  ok("App Hub CSS: single-shell fatal banner + monogram + single scroll + fav hover/focus (no fallback mode)");
} else fail("App Hub single-shell CSS incomplete");

// —— SURAKSHA (retired) ——
// The custom Suraksha panel is fully retired. The button remains and opens
// Firefox's native protections popup via cmd_astraOpenSurakshaCenter.
const surFtl = read("locales/en-US/browser/browser/zen-suraksha.ftl");

if (
  !preload.includes("AstraSuraksha") &&
  !exists("src/zen/common/modules/AstraSurakshaBootstrap.mjs") &&
  !exists("src/zen/common/modules/AstraSurakshaManager.mjs") &&
  !exists("src/zen/common/styles/astra-suraksha.css")
) {
  ok("Suraksha custom panel modules/CSS retired");
} else fail("Suraksha retirement incomplete (modules/CSS/preload remain)");

if (!popups.includes("PanelUI-astra-suraksha")) {
  ok("Suraksha custom panel markup removed from popups.inc");
} else fail("Suraksha panel markup still present in popups.inc");

const setsSrc = read("src/zen/common/zen-sets.js");
if (
  setsSrc.includes("cmd_astraOpenSurakshaCenter") &&
  setsSrc.includes("openAstraSurakshaProtectionsPopup") &&
  setsSrc.includes("resolveAstraSurakshaAnchor") &&
  setsSrc.includes("_protectionsPopup")
) {
  ok("Suraksha command opens native protections via stable urlbar anchor");
} else fail("Suraksha command not rewired to native protections popup");

if (
  surFtl.includes("astra-suraksha-button") &&
  surFtl.includes("astra-suraksha-appmenu")
) {
  ok("Suraksha button Fluent strings retained");
} else fail("Suraksha button Fluent strings missing");

const zenIconJar = read("src/browser/themes/shared/zen-icons/jar.inc.mn");
for (const icon of [
  "tracking-protection.svg",
  "security.svg",
  "extension.svg",
  "security-warning.svg",
  "info.svg",
  "edit-delete.svg",
  "link.svg",
  "reload.svg",
  "search-glass.svg",
]) {
  if (
    zenIconJar.includes(`zen-icons/${icon}`) ||
    zenIconJar.includes(`nucleo/${icon}`)
  ) {
    ok(`zen-icons jar packs ${icon}`);
  } else fail(`zen-icons jar missing ${icon}`);
}

if (hubCss.includes("chrome://browser/skin/zen-icons/search-glass.svg")) {
  ok("App Hub search icon uses proven zen-icons path");
} else fail("App Hub search icon not using zen-icons jar asset");

// —— SIDEBAR WIDTH ——
const cui = read("src/zen/common/sys/ZenCustomizableUI.sys.mjs");
if (
  cui.includes("#isValidSidebarWidth") &&
  cui.includes("#clearPersistedSidebarWidth") &&
  cui.includes("px > 0") &&
  cui.includes("px$/") &&
  /Services\.xulStore\.removeValue\(\s*uri,\s*"navigator-toolbox",\s*"width"\s*\)/.test(
    cui
  ) &&
  /Services\.xulStore\.removeValue\(\s*uri,\s*"navigator-toolbox",\s*"style"\s*\)/.test(
    cui
  ) &&
  cui.includes('AppConstants.platform === "macosx" ? "230px" : "186px"')
) {
  ok("sidebar: invalid persisted width cleared via XULStore; upstream default preserved");
} else {
  fail("sidebar invalid-width handling / upstream default / canonical-clear incomplete");
}
// Native splitter remains the sole resize owner — no second custom drag system.
if (
  cui.includes('createXULElement("splitter")') &&
  cui.includes('"zen-sidebar-splitter"') &&
  cui.includes('splitter.setAttribute("resizebefore", "sibling")') &&
  !/addEventListener\("mousemove"/.test(cui)
) {
  ok("sidebar: native splitter is sole resize owner (no second drag system)");
} else {
  fail("sidebar splitter ownership missing or a second drag system was added");
}

// Upstream Zen intent: sidebar-top defaults to compact-mode only. App Hub +
// Suraksha are creatable widgets (palette / App Menu), never default-placed.
const topDefaults = cui.match(
  /registerArea\(\s*"zen-sidebar-top-buttons"[\s\S]*?defaultPlacements:\s*\[([\s\S]*?)\]/
);
if (
  topDefaults &&
  topDefaults[1].includes("zen-toggle-compact-mode") &&
  !topDefaults[1].includes("zen-app-launcher-button") &&
  !topDefaults[1].includes("astra-suraksha-button")
) {
  ok("sidebar-top defaultPlacements are compact-mode only (no App Hub/Suraksha)");
} else {
  fail("sidebar-top defaultPlacements still include App Hub/Suraksha");
}

// Suraksha owns its public widget id on a single real toolbarbutton — no nested
// public <toolbaritem> wrapper and no separate inner toolbarbutton id.
if (
  !/<toolbaritem\s+id="astra-suraksha-button"/.test(cui) &&
  /<toolbarbutton\s+id="astra-suraksha-button"[\s\S]*?command="cmd_astraOpenSurakshaCenter"/.test(
    cui
  ) &&
  !cui.includes('id="astra-suraksha-toolbarbutton"')
) {
  ok("Suraksha is a direct toolbarbutton (no nested public toolbaritem)");
} else {
  fail("Suraksha direct toolbarbutton wiring missing or still nested in a toolbaritem");
}

// Versioned one-time sidebar cleanup migration (App Hub + Suraksha removed from
// sidebar-top; one-time 186px/230px width reset via XULStore).
const uim = read("src/zen/common/modules/ZenUIManager.mjs");
if (
  uim.includes("astra.ui.sidebar-cleanup.version") &&
  uim.includes("_migrateAstraSidebarCleanupIfNeeded") &&
  uim.includes("CustomizableUI.removeWidgetFromArea") &&
  uim.includes("zen-app-launcher-button") &&
  uim.includes("astra-suraksha-button") &&
  /removeValue\(\s*uri,\s*"navigator-toolbox",\s*"width"\s*\)/.test(uim) &&
  uim.includes('"230px" : "186px"')
) {
  ok("sidebar cleanup migration present (versioned removal + one-time width reset)");
} else fail("sidebar cleanup migration incomplete");

// The cleanup removal list must be Astra-only — never target extension/uBlock.
const removeIdsMatch = uim.match(/removeIds\s*=\s*\[([\s\S]*?)\]/);
if (
  removeIdsMatch &&
  removeIdsMatch[1].includes("zen-app-launcher-button") &&
  removeIdsMatch[1].includes("astra-suraksha-button") &&
  !/uBlock|ublock0|extension|webext/i.test(removeIdsMatch[1])
) {
  ok("sidebar cleanup removal list is Astra-only (no extension/uBlock)");
} else {
  fail("sidebar cleanup removal list missing or includes extension/uBlock widgets");
}

// —— GENERAL / XUL ——
const markupFiles = [
  "src/browser/base/content/zen-panels/popups.inc",
  "src/browser/base/content/zen-panels/site-data.inc",
  "src/browser/base/content/zen-commands.inc.xhtml",
  "src/browser/components/preferences/zenTabsManagement.inc.xhtml",
];
for (const rel of markupFiles) {
  if (!exists(rel)) {
    fail(`missing markup ${rel}`);
    continue;
  }
  validateBalancedXulTags(rel);
}

const hubPanel = popups.indexOf('id="PanelUI-zen-app-launcher"');
if (hubPanel >= 0) {
  ok("App Hub panel present in markup");
} else fail("App Hub panel missing from popups.inc");

// Attribute id= only (avoid matching data-l10n-id=). Scope to the App Hub panel.
const hubSurStart = popups.indexOf('id="PanelUI-zen-app-launcher"');
const hubSurEnd = popups.indexOf('id="PanelUI-zen-india-gov"');
const hubSurBlock = popups.slice(
  hubSurStart >= 0 ? hubSurStart : 0,
  hubSurEnd >= 0 ? hubSurEnd : popups.length
);
const ids = [...hubSurBlock.matchAll(/(?:^|[\s])id="([^"]+)"/gm)].map(
  m => m[1]
);
const seen = new Set();
const dupes = [];
for (const id of ids) {
  if (seen.has(id)) dupes.push(id);
  else seen.add(id);
}
if (!dupes.length) ok("no duplicate IDs in App Hub panel");
else fail(`duplicate IDs in App Hub panel: ${[...new Set(dupes)].join(", ")}`);

// Fluent refs used by App Hub finishing strings
for (const id of [
  "astra-app-hub-advanced-unavailable",
  "astra-app-hub-retry",
]) {
  const ftl = hubFtl;
  if (ftl.includes(`${id} =`) || ftl.includes(`${id}=\n`)) ok(`Fluent ${id}`);
  else fail(`missing Fluent ${id}`);
}

async function validateCatalogModuleShape() {
  const { pathToFileURL } = require("url");
  const catalogPath = path.join(root, catalogRel);
  if (!fs.existsSync(catalogPath)) {
    fail("cannot import missing catalog module");
    return;
  }
  const mod = await import(pathToFileURL(catalogPath).href);
  const catalog = mod.ASTRA_APP_HUB_CATALOG;
  if (!catalog) {
    fail("ASTRA_APP_HUB_CATALOG export missing");
    return;
  }
  if (catalog.schemaVersion === 1) ok("imported catalog schemaVersion is 1");
  else fail(`imported catalog schemaVersion ${catalog.schemaVersion}`);
  if (Array.isArray(catalog.categories) && catalog.categories.length === 10) {
    ok("imported catalog has exactly 10 categories");
  } else {
    fail(
      `imported catalog categories != 10 (${catalog.categories?.length})`
    );
  }
  if (Array.isArray(catalog.apps) && catalog.apps.length === 44) {
    ok("imported catalog has exactly 44 apps");
  } else fail(`imported catalog apps != 44 (${catalog.apps?.length})`);

  const catIds = new Set(catalog.categories.map(c => c.id));
  const appIds = new Set();
  let remoteIcon = false;
  let badCat = 0;
  let badUrl = 0;
  let missingIconKey = 0;
  let missingMonogram = 0;
  let badMonogram = 0;
  const iconKeys = new Set();
  const hubIconsSrc = fs.readFileSync(
    path.join(root, "src/zen/common/modules/AstraAppHubIcons.mjs"),
    "utf8"
  );
  const iconsDir = path.join(root, "src/zen/common/app-hub/icons");
  for (const app of catalog.apps) {
    if (appIds.has(app.id)) fail(`duplicate app id ${app.id}`);
    appIds.add(app.id);
    if (!catIds.has(app.category)) badCat++;
    try {
      const u = new URL(app.url);
      if (u.protocol !== "https:" && u.protocol !== "http:") badUrl++;
    } catch {
      badUrl++;
    }
    if (
      typeof app.icon === "string" &&
      /^https?:/i.test(app.icon)
    ) {
      remoteIcon = true;
    }
    if (typeof app.iconKey !== "string" || !app.iconKey.trim()) {
      missingIconKey++;
    } else {
      iconKeys.add(app.iconKey);
      if (!hubIconsSrc.includes(`${app.iconKey}:`) && !hubIconsSrc.includes(`"${app.iconKey}"`)) {
        // allow either bare key or quoted key in registry
        if (!new RegExp(`["']?${app.iconKey}["']?\\s*:`).test(hubIconsSrc)) {
          fail(`iconKey ${app.iconKey} missing from ASTRA_APP_HUB_ICONS`);
        }
      }
    }
    if (typeof app.monogram !== "string" || !app.monogram.trim()) {
      missingMonogram++;
    } else if (app.monogram.trim().length < 1 || app.monogram.trim().length > 3) {
      badMonogram++;
    }
  }
  if (!badCat) ok("imported catalog category references valid");
  else fail(`${badCat} apps reference unknown categories`);
  if (!badUrl) ok("imported catalog URLs valid");
  else fail(`${badUrl} apps have invalid URLs`);
  if (!remoteIcon) ok("imported catalog has no remote icon URLs");
  else fail("imported catalog contains remote icon URLs");
  if (!missingIconKey && iconKeys.size === 44) {
    ok("every catalog app has iconKey (44)");
  } else {
    fail(
      `iconKey incomplete (missing=${missingIconKey}, unique=${iconKeys.size})`
    );
  }
  if (!missingMonogram && !badMonogram) {
    ok("every catalog app has monogram (1–3 chars)");
  } else {
    fail(
      `monogram incomplete (missing=${missingMonogram}, badLen=${badMonogram})`
    );
  }

  const iconFiles = fs.existsSync(iconsDir)
    ? fs.readdirSync(iconsDir).filter(f => /\.(svg|png|ico|webp)$/i.test(f))
    : [];
  if (iconFiles.length === 44 && iconFiles.every(f => /\.svg$/i.test(f))) {
    ok("44 packaged SVG icon source files on disk (no png/ico)");
  } else fail(`icon source files != 44 SVG (${iconFiles.length})`);

  let oversized = 0;
  let totalBytes = 0;
  for (const file of iconFiles) {
    const full = path.join(iconsDir, file);
    const st = fs.statSync(full);
    totalBytes += st.size;
    if (st.size > 32 * 1024) {
      oversized++;
      fail(`oversized SVG ${file} (${st.size} bytes)`);
    }
    const raw = fs.readFileSync(full, "utf8");
    if (
      /<script[\s>]|onload=|onclick=|onerror=|foreignObject|xlink:href=["']https?:|href=["']https?:|url\(\s*['"]?https?:|<animate[\s>]|base64,/i.test(
        raw
      ) ||
      !/<svg[\s>]/.test(raw) ||
      !/viewBox=/.test(raw)
    ) {
      fail(`unsafe/malformed SVG content in ${file}`);
    }
  }
  if (!oversized) {
    ok(
      `packaged SVG icons safe/valid (total ${(totalBytes / 1024).toFixed(1)} KB)`
    );
  }

  if (
    hubMgr.includes("PrivateBrowsingUtils.isWindowPrivate") &&
    hubMgr.includes("#enrichCustomAppIcon") &&
    hubMgr.includes("#beginFaviconCapture") &&
    hubMgr.includes("astra-app-hub-error-private-edit") &&
    /isWindowPrivate\(window\)[\s\S]{0,200}#beginFaviconCapture|PrivateBrowsingUtils\.isWindowPrivate\(window\)[\s\S]{0,80}return/m.test(
      hubMgr
    )
  ) {
    ok("private windows skip Places favicon enrichment");
  } else fail("private-window favicon skip missing");

  if (
    hubIcons.includes("resolveLocalIconPath") &&
    hubIcons.includes("migrateLegacyIconFileName") &&
    !/image\.src\s*=\s*.*file:/i.test(hubMgr) &&
    !hubIcons.includes("localIconFileURI")
  ) {
    ok("legacy icons migrate via profile dir; no file:// render");
  } else fail("legacy file:// icon render still possible");
}

validateCatalogModuleShape()
  .catch(err => {
    fail(`catalog module import failed: ${err.message}`);
  })
  .finally(() => {
    if (errors.length) {
      console.error(`\n${errors.length} failure(s)`);
      process.exit(1);
    }
    console.log("\nAll Astra UI finishing checks passed.");
    process.exit(0);
  });
