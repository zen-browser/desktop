#!/usr/bin/env node
/* Source-level validation for Astra performance / 3D stability hardening. */
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

const perf = read("prefs/firefox/performance.yaml");
const privacy = read("prefs/privatefox/privacy.yaml");
const containerCss = read("src/zen/common/styles/zen-browser-container.css");
const transparentCss = read("src/zen/common/styles/astra-transparent-mode.css");
const manager = read("src/zen/common/modules/AstraTransparencyManager.mjs");
const preload = read("src/zen/common/ZenPreloadedScripts.js");
const appHubBootstrap = read("src/zen/common/modules/AstraAppHubBootstrap.mjs");
const sets = read("src/zen/common/zen-sets.js");
const commands = read("src/browser/base/content/zen-commands.inc.xhtml");
const theme = read("prefs/zen/theme.yaml");
const browserYaml = read("prefs/firefox/browser.yaml");

function prefValue(src, name) {
  const re = new RegExp(
    `- name:\\s*${name.replace(/\./g, "\\.")}\\r?\\n\\s*value:\\s*(.+)`
  );
  const m = src.match(re);
  return m ? m[1].trim() : null;
}

function zenPref(zenSrc, name) {
  const re = new RegExp(
    `pref\\("${name.replace(/\./g, "\\.")}",\\s*([^)]+)\\)`
  );
  const m = zenSrc.match(re);
  return m ? m[1].trim() : null;
}

// Security invariants
const banned = [
  ["security.sandbox", "value: false"],
  ["fission.autostart", "value: false"],
  ["layers.acceleration.disabled", "value: true"],
  ["gfx.webrender.force-disabled", "value: true"],
  ["gfx.webrender.software", "value: true"],
  ["webgl.force-enabled", "value: true"],
  ["webgl.disabled", "value: true"],
  ["security.sandbox.gpu.level", "value: 0"],
];
const prefBlob = perf + "\n" + privacy;
for (const [needle, bad] of banned) {
  const idx = prefBlob.indexOf(needle);
  if (idx === -1) continue;
  const block = prefBlob.slice(idx, idx + 120);
  if (block.includes(bad)) fail(`banned override near ${needle}`);
}
if (prefValue(privacy, "webgl.disabled") === "false") {
  ok("webgl.disabled remains false (WebGL available)");
} else if (prefValue(privacy, "webgl.disabled") === "true") {
  fail("webgl.disabled forced true");
} else ok("webgl.disabled not forced true");

if (prefValue(theme, "browser.tabs.allow_transparent_browser") === "false") {
  ok("allow_transparent_browser remains false");
} else fail("allow_transparent_browser not false");

// Networking restorations (must match engine upstream defaults)
const dnsPrefetch = prefValue(privacy, "network.dns.disablePrefetch");
if (dnsPrefetch === "false") ok("DNS prefetch re-enabled (disablePrefetch=false)");
else fail(`DNS prefetch still blocked (${dnsPrefetch})`);

const dnsHttps = prefValue(privacy, "network.dns.disablePrefetchFromHTTPS");
if (dnsHttps === "false") ok("HTTPS DNS prefetch re-enabled");
else fail(`disablePrefetchFromHTTPS=${dnsHttps}`);

const prefetchNext = prefValue(privacy, "network.prefetch-next");
if (prefetchNext === "true") ok("link prefetch restored");
else fail(`prefetch-next=${prefetchNext}`);

const speculative = prefValue(privacy, "network.http.speculative-parallel-limit");
if (speculative === "20") ok("speculative-parallel-limit=20");
else fail(`speculative-parallel-limit=${speculative}`);

const http3 = prefValue(privacy, "network.http.http3.enable");
if (http3 === "true") ok("HTTP/3 enabled");
else fail(`http3=${http3}`);

// Performance restorations
const bfcache = prefValue(perf, "browser.sessionhistory.max_total_viewers");
if (bfcache === "-1") ok("BFCache viewers restored to -1");
else fail(`max_total_viewers=${bfcache}`);

const memCache = prefValue(perf, "browser.cache.memory.capacity");
if (memCache === "-1") ok("memory cache capacity dynamic (-1)");
else fail(`memory.capacity=${memCache}`);

const retry = prefValue(perf, "network.http.connection-retry-timeout");
if (retry === "250") ok("connection-retry-timeout=250");
else fail(`connection-retry-timeout=${retry}`);

const connTimeout = prefValue(perf, "network.http.connection-timeout");
if (connTimeout === "90") ok("connection-timeout=90");
else fail(`connection-timeout=${connTimeout}`);

const respTimeout = prefValue(perf, "network.http.response.timeout");
if (respTimeout === "300") ok("response.timeout=300");
else fail(`response.timeout=${respTimeout}`);

if (/javascript\.options\.asmjs[\s\S]{0,40}value:\s*true/.test(perf)) {
  fail("asmjs forced true");
} else ok("asmjs not forced true");

if (/tcp_fastopen_enable[\s\S]{0,80}value:\s*true/.test(perf)) {
  fail("tcp_fastopen still forced true");
} else ok("tcp_fastopen not forced true");

// Process count: Astra must NOT hardcode — upstream is platform-adaptive.
if (/^\s*- name:\s*dom\.ipc\.processCount(\.web)?\s*$/m.test(perf)) {
  fail("Astra still overrides dom.ipc.processCount (must leave upstream adaptive)");
} else ok("no Astra dom.ipc.processCount override");

if (/processCount\.webLargeAllocation/.test(perf)) {
  fail("legacy processCount.webLargeAllocation still present");
} else ok("legacy webLargeAllocation override absent");

// Graphics safety
if (/webgl\.force-enabled[\s\S]{0,40}value:\s*true/.test(prefBlob)) {
  fail("webgl.force-enabled present");
} else ok("no unsafe webgl.force-enabled");

if (/gfx\.webrender\.software[\s\S]{0,40}value:\s*true/.test(prefBlob)) {
  fail("software webrender forced");
} else ok("no forced software WebRender");

if (/gfx\.webrender\.force-disabled[\s\S]{0,40}value:\s*true/.test(prefBlob)) {
  fail("webrender force-disabled");
} else ok("WebRender not force-disabled");

// will-change / translateZ compositor hacks
const containerNoComments = containerCss.replace(/\/\*[\s\S]*?\*\//g, "");
if (/will-change:\s*transform/.test(containerNoComments)) {
  fail("content browser will-change:transform still present");
} else ok("removed content-browser will-change hack");

if (/translateZ\s*\(\s*0\s*\)|translate3d\s*\(\s*0\s*,\s*0\s*,\s*0\s*\)/.test(containerNoComments)) {
  fail("translateZ/3d compositor hack present on content browsers");
} else ok("no translateZ compositor hack on content browsers");

// Transparency: limited blur surfaces
const blurCount = (transparentCss.match(/backdrop-filter:\s*blur/g) || []).length;
if (blurCount <= 4) ok(`limited Astra Glass blur rules (${blurCount})`);
else fail(`too many backdrop-filter blur rules (${blurCount})`);

if (/inDOMFullscreen[\s\S]{0,200}backdrop-filter:\s*none/.test(transparentCss)) {
  ok("fullscreen drops chrome blur");
} else fail("missing fullscreen blur shedding");

if (/setInterval/.test(manager)) fail("transparency setInterval");
else ok("no transparency setInterval");

// Suraksha custom panel retired — no Suraksha modules may load at startup.
if (!preload.includes("AstraSuraksha")) {
  ok("Suraksha retired: no Suraksha preload");
} else fail("retired Suraksha module still preloaded");

// App Hub: bootstrap only at startup; manager lazy on first open
if (
  preload.includes("AstraAppHubBootstrap.mjs") &&
  !preload.includes("AstraAppHubManager.mjs")
) {
  ok("App Hub startup preload is bootstrap-only");
} else fail("preload must be bootstrap-only (no eager managers)");

if (
  appHubBootstrap.includes("#ensureManagerImported") &&
  appHubBootstrap.includes("AstraAppHubManager.mjs")
) {
  ok("App Hub manager lazy-imported from bootstrap");
} else fail("App Hub missing lazy manager import");

if (sets.includes("cmd_zenOpenAppLauncher") && sets.includes("gZenAppLauncher")) {
  ok("App Hub command intact");
} else fail("App Hub command broken");

if (
  sets.includes("cmd_astraOpenSurakshaCenter") &&
  sets.includes("showProtectionsPopup")
) {
  ok("Suraksha command rewired to native protections popup");
} else fail("Suraksha command broken");

if ((commands.match(/cmd_astraOpenSurakshaCenter/g) || []).length >= 1) {
  ok("Suraksha command definition present");
} else fail("Suraksha command missing");

// Session restore: keep lazy pinned restore
if (prefValue(browserYaml, "browser.sessionstore.restore_pinned_tabs_on_demand") === "true") {
  ok("pinned tabs restore on demand");
} else fail("restore_pinned_tabs_on_demand not true");

// No High Performance Mode that disables security
const allSrc = perf + privacy + transparentCss + manager;
if (
  /disable.*ublock|etp\.enabled.*false|sandbox.*level.*0/i.test(allSrc) &&
  /high.?performance.?site/i.test(allSrc)
) {
  fail("HP mode appears to weaken security");
} else ok("no HP-mode security bypass in changed surfaces");

if (/performance\.telemetry|logVisitedUrl|page.?url.*console\.log/i.test(manager)) {
  fail("suspicious URL/perf telemetry logging");
} else ok("no URL performance logging in transparency manager");

// Generated zen.js (gitignored) — verify final values when present
const zenPath = "engine/browser/app/profile/zen.js";
if (exists(zenPath)) {
  const zen = read(zenPath);
  const expect = {
    "network.dns.disablePrefetch": "false",
    "network.dns.disablePrefetchFromHTTPS": "false",
    "network.prefetch-next": "true",
    "network.http.speculative-parallel-limit": "20",
    "browser.sessionhistory.max_total_viewers": "-1",
    "browser.cache.memory.capacity": "-1",
    "network.http.connection-retry-timeout": "250",
    "network.http.connection-timeout": "90",
    "network.http.response.timeout": "300",
    "browser.tabs.allow_transparent_browser": "false",
    "widget.windows.mica": "false",
  };
  for (const [name, want] of Object.entries(expect)) {
    const got = zenPref(zen, name);
    if (got === want) ok(`zen.js ${name}=${got}`);
    else fail(`zen.js ${name}=${got} (want ${want})`);
  }
  // After removing Astra override, zen.js must not force processCount.
  if (zenPref(zen, "dom.ipc.processCount") !== null) {
    fail(
      "zen.js still contains Astra-generated dom.ipc.processCount override (regenerate ffprefs)"
    );
  } else ok("zen.js has no Astra processCount override");
  if (/javascript\.options\.asmjs/.test(zen) && /asmjs\",\s*true/.test(zen)) {
    fail("zen.js forces asmjs true");
  } else ok("zen.js does not force asmjs true");
} else {
  ok("zen.js absent (skip generated-value checks)");
}

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll performance/stability checks passed.");
process.exit(0);
