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
if (
  !bootstrap.includes("AstraAppHubCatalog") &&
  !/^\s*import\s+.*AstraAppHubManager/m.test(bootstrap) &&
  !bootstrapTop.includes("AstraAppHubManager.mjs") &&
  bootstrap.includes("ChromeUtils.importESModule") &&
  bootstrap.includes("AstraAppHubManager.mjs")
) {
  ok("bootstrap does not import catalog/manager eagerly");
} else fail("bootstrap eagerly imports catalog or manager");

const fallbackBlock = popups.slice(
  popups.indexOf('id="PanelUI-zen-app-launcher-fallback"'),
  popups.indexOf("Advanced UI shell")
);
const fallbackUrls = (fallbackBlock.match(/data-url="/g) || []).length;
if (fallbackUrls >= 44) ok(`44-app fallback IDs remain intact (${fallbackUrls})`);
else fail(`fallback apps reduced (${fallbackUrls})`);

const fallbackMonograms = (fallbackBlock.match(/data-monogram="/g) || []).length;
const fallbackMonogramLabels = (
  fallbackBlock.match(/zen-app-launcher-item-monogram/g) || []
).length;
if (fallbackMonograms >= 44 && fallbackMonogramLabels >= 44) {
  ok(`fallback monograms present (${fallbackMonograms})`);
} else {
  fail(
    `fallback monograms incomplete (${fallbackMonograms} attrs / ${fallbackMonogramLabels} labels)`
  );
}

const fallbackImages = (
  fallbackBlock.match(/class="zen-app-launcher-item-icon"/g) || []
).length;
const fallbackNames = (
  fallbackBlock.match(/zen-app-launcher-item-name/g) || []
).length;
const fallbackDisabledMono = (
  fallbackBlock.match(/zen-app-launcher-item-monogram"[^>]*\sdisabled=/g) || []
).length;
if (fallbackImages >= 44 && fallbackNames >= 44) {
  ok(`fallback has image+name for each app (${fallbackImages}/${fallbackNames})`);
} else {
  fail(
    `fallback missing image/name nodes (${fallbackImages} icons / ${fallbackNames} names)`
  );
}
if (fallbackDisabledMono === 0) {
  ok("fallback monograms are not disabled");
} else fail("fallback monograms still use disabled=true");

if (
  /app-hub-icons\//.test(fallbackBlock) &&
  !/https?:\/\/.*favicon|duckduckgo\.com\/ip3|gstatic\.com\/favicon|clearbit/i.test(
    fallbackBlock
  )
) {
  ok("fallback icons use local chrome app-hub-icons paths");
} else fail("fallback icons missing or use remote favicon proxy");

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

if (
  hubMgr.includes("data-icon-loaded") &&
  hubMgr.includes("data-icon-error") &&
  hubMgr.includes("zen-app-launcher-item-icon-stack") &&
  hubMgr.includes('document.createElement("img")') &&
  bootstrap.includes("#bindFallbackIconHandlers") &&
  bootstrap.includes("#destroyListeners") &&
  /<html:img class="zen-app-launcher-item-icon"/.test(fallbackBlock) &&
  !/<image class="zen-app-launcher-item-icon"/.test(fallbackBlock)
) {
  ok("advanced+fallback use HTML img load/error (not XUL image)");
} else fail("icon load/error handling missing or still uses XUL image");

if (
  hubMgr.includes("resolvePlacesFaviconURL") &&
  hubMgr.includes("#enrichCustomAppIcon") &&
  hubMgr.includes("button.isConnected") &&
  hubIcons.includes("getFaviconForPage") &&
  hubIcons.includes("data:image/") &&
  !/["'`]page-icon:/.test(hubIcons) &&
  !/["'`]page-icon:/.test(hubMgr) &&
  !/favicon\?\.uri/.test(hubMgr)
) {
  ok("user-added favicon uses Places dataURI only (no page-icon/remote uri)");
} else fail("user-added favicon Places path missing or unsafe");

if (
  !bootstrap.includes("AstraAppHubIcons") &&
  !bootstrap.includes("PlacesUtils") &&
  !bootstrap.includes("getFaviconForPage") &&
  !bootstrap.includes("ASTRA_APP_HUB_CATALOG")
) {
  ok("bootstrap performs no startup icon/catalog/Places work");
} else fail("bootstrap references icon/catalog/Places at module scope");

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

if (
  hubCss.includes("astra-app-hub-fallback-banner") &&
  hubCss.includes('app-hub-mode="fallback"') &&
  hubCss.includes("zen-app-launcher-item-monogram")
) {
  ok("App Hub CSS keeps fallback mode + compact banner + monograms");
} else fail("App Hub fallback CSS incomplete");

// —— SURAKSHA ——
const surMgr = read("src/zen/common/modules/AstraSurakshaManager.mjs");
const surCss = read("src/zen/common/styles/astra-suraksha.css");
const surFtl = read("locales/en-US/browser/browser/zen-suraksha.ftl");

if (
  preload.includes("AstraSurakshaBootstrap.mjs") &&
  !preload.includes("AstraSurakshaManager.mjs")
) {
  ok("Suraksha bootstrap remains only startup preload");
} else fail("Suraksha manager eagerly preloaded");

if (surMgr.includes("if (this.isOpen)") && surMgr.includes("#safe(")) {
  ok("adapters remain open-gated / failure-isolated");
} else fail("Suraksha open-gated refresh missing");

if (
  surMgr.includes("#variantForState") &&
  surMgr.includes("#applyCardVariant") &&
  /return "good"|return "attention"|return "danger"|return "neutral"|return "loading"/.test(
    surMgr
  )
) {
  ok("status variants are bounded");
} else fail("Suraksha status variants missing/unbounded");

if (/security score|site safe|100% safe|scam-proof|fully up to date/i.test(surMgr + surFtl)) {
  fail("fake Suraksha score/safety claim present");
} else ok("no fake Suraksha score/safety claims");

if (/getAllLogins|Services\.logins|searchLogins|nsILoginInfo/i.test(surMgr)) {
  fail("Suraksha manager accesses credentials");
} else ok("no credential access in Suraksha manager");

if (
  surCss.includes("--astra-status-good") &&
  surCss.includes("data-variant") &&
  surCss.includes("astra-suraksha-footer") &&
  !/backdrop-filter\s*:/.test(surCss)
) {
  ok("Suraksha visual system + footer without nested backdrop-filter");
} else fail("Suraksha visual system incomplete or uses backdrop-filter cards");

const surCssIconUrls = [...surCss.matchAll(/url\("([^"]+)"\)/g)].map(m => m[1]);
const badSurIcons = surCssIconUrls.filter(
  u =>
    /identity-icon\.svg/.test(u) ||
    /chrome:\/\/global\/skin\/icons\/(security|delete|link|warning|reload)\.svg/.test(
      u
    ) ||
    /chrome:\/\/mozapps\/skin\/extensions\/extension\.svg/.test(u) ||
    (/chrome:\/\/browser\/skin\/tracking-protection\.svg/.test(u) &&
      !u.includes("zen-icons"))
);
if (badSurIcons.length) {
  fail(`Suraksha CSS uses unproven/obsolete icon chrome URLs: ${badSurIcons.join(", ")}`);
} else if (
  surCss.includes("chrome://browser/skin/zen-icons/security.svg") &&
  surCss.includes("chrome://browser/skin/zen-icons/info.svg") &&
  surCss.includes("chrome://browser/skin/zen-icons/edit-delete.svg") &&
  surCss.includes("chrome://browser/skin/zen-icons/extension.svg")
) {
  ok("Suraksha icons use proven zen-icons jar paths");
} else fail("Suraksha icon packaging incomplete");

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

if (
  surFtl.includes("astra-suraksha-footer-privacy = Privacy Settings") &&
  surFtl.includes("astra-suraksha-action-etp-panel = Open tracking protection") &&
  surFtl.includes("astra-suraksha-loading = Checking") &&
  surFtl.includes("astra-suraksha-card-title-protection = Tracking Protection")
) {
  ok("Suraksha Fluent provides message values for HTML textContent");
} else fail("Suraksha Fluent missing HTML message values (attribute-only would blank HTML)");

if (
  surMgr.includes("aria-controls") &&
  surMgr.includes("aria-expanded") &&
  surMgr.includes("data-suraksha-toggle-details") &&
  popups.includes("astra-suraksha-card-safebrowsing-details") &&
  popups.includes("astra-suraksha-card-passwords-details")
) {
  ok("Suraksha collapsible details expose aria-expanded/controls + unique IDs");
} else fail("Suraksha details a11y wiring incomplete");

if (
  surCss.includes('astra-suraksha-mode="advanced"] .astra-suraksha-scroll') &&
  surCss.includes("overflow-y: auto") &&
  surCss.includes(".astra-suraksha-scroll")
) {
  ok("Suraksha primary scroll is mode-scoped (single active region)");
} else fail("Suraksha primary scroll region not mode-scoped");

if (
  popups.includes("astra-suraksha-footer") &&
  popups.includes("astra-suraksha-section-site-controls") &&
  popups.includes("astra-suraksha-card-hero") &&
  popups.includes("astra-suraksha-shell") &&
  popups.includes("<html:article") &&
  popups.includes("astra-suraksha-scroll")
) {
  ok("Suraksha IA: HTML shell + hero + site controls + compact footer");
} else fail("Suraksha information architecture incomplete");

if (
  surMgr.includes('createElementNS') &&
  surMgr.includes("http://www.w3.org/1999/xhtml") &&
  surMgr.includes('btn.type = "button"') &&
  surMgr.includes("#onAdvancedClick") &&
  !surMgr.includes("createXULElement(\"toolbarbutton\")") &&
  !surMgr.includes("#onAdvancedCommand")
) {
  ok("Suraksha dynamic actions use HTML buttons + delegated click");
} else fail("Suraksha still uses XUL toolbarbutton/command for dynamic actions");

const cardRuleMatch = surCss.match(
  /\.astra-suraksha-card\s*\{[^}]+\}/
);
const cardRule = cardRuleMatch ? cardRuleMatch[0] : "";
const headRuleMatch = surCss.match(
  /\.astra-suraksha-card-head\s*\{[^}]+\}/
);
const headRule = headRuleMatch ? headRuleMatch[0] : "";
if (
  surCss.includes("display: grid") &&
  /grid-template-areas:/.test(cardRule) &&
  /block-size:\s*auto/.test(cardRule) &&
  !/block-size:\s*\d+px/.test(cardRule) &&
  !/height:\s*\d+px/.test(cardRule) &&
  !/min-height:\s*[1-9]/.test(cardRule) &&
  !/position:\s*absolute/.test(surCss) &&
  !/margin-(block-start|top):\s*-/.test(surCss) &&
  /display:\s*grid/.test(headRule) &&
  !/display:\s*contents/.test(headRule)
) {
  ok("Suraksha cards use nested intrinsic CSS grid (no fixed/absolute/contents overlap hacks)");
} else fail("Suraksha card layout still uses fixed height, contents, or overlap workarounds");

const advancedStart = popups.indexOf('id="PanelUI-astra-suraksha-advanced"');
const advancedEnd = popups.indexOf("</panel>", advancedStart);
const advancedBlock = popups.slice(advancedStart, advancedEnd);
const longAdvancedRows = (
  advancedBlock.match(/class="astra-suraksha-action subviewbutton"/g) || []
).length;
const advancedXulToolbarActions = (
  advancedBlock.match(/<toolbarbutton[^>]*data-suraksha-action/g) || []
).length;
if (longAdvancedRows === 0 && advancedXulToolbarActions === 0) {
  ok("no duplicate oversized / XUL toolbarbutton advanced card actions");
} else {
  fail(
    `advanced action markup regression (subview=${longAdvancedRows}, xul=${advancedXulToolbarActions})`
  );
}

if (
  surCss.includes("overflow-y: auto") &&
  surCss.includes(".astra-suraksha-scroll")
) {
  ok("Suraksha has primary scroll container");
} else fail("Suraksha scroll container missing");

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
const surPanel = popups.indexOf('id="PanelUI-astra-suraksha"');
if (hubPanel >= 0 && surPanel >= 0 && hubPanel < surPanel) {
  ok("App Hub and Suraksha panels are siblings in markup order");
} else fail("App Hub/Suraksha panel sibling order broken");

// Attribute id= only (avoid matching data-l10n-id=). Scope to App Hub + Suraksha panels.
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
if (!dupes.length) ok("no duplicate IDs in App Hub/Suraksha panels");
else fail(`duplicate IDs in App Hub/Suraksha panels: ${[...new Set(dupes)].join(", ")}`);

// Fluent refs used by new Suraksha/App Hub finishing strings
for (const id of [
  "astra-app-hub-advanced-unavailable",
  "astra-app-hub-retry",
  "astra-suraksha-subtitle",
  "astra-suraksha-section-site-controls",
  "astra-suraksha-footer-privacy",
  "astra-suraksha-card-title-protection",
]) {
  const ftl = id.startsWith("astra-app-hub") ? hubFtl : surFtl;
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
    hubMgr.includes("#enrichCustomAppIcon")
  ) {
    ok("private windows skip Places favicon enrichment");
  } else fail("private-window favicon skip missing");
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
