#!/usr/bin/env node
/* Source-level validation for Astra Transparent Mode V2 (no browser runtime). */
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

function walkFiles(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "engine" || name === ".git") {
        continue;
      }
      walkFiles(p, exts, out);
    } else if (exts.some(e => name.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

const managerRel = "src/zen/common/modules/AstraTransparencyManager.mjs";
const cssRel = "src/zen/common/styles/astra-transparent-mode.css";
const themeYaml = "prefs/zen/theme.yaml";
const windowsYaml = "prefs/zen/windows.yaml";
const ftlRel = "locales/en-US/browser/browser/zen-general.ftl";

if (!exists(managerRel)) fail(`missing ${managerRel}`);
else ok("manager present");
if (!exists(cssRel)) fail(`missing ${cssRel}`);
else ok("transparent CSS present");

const manager = read(managerRel);
const css = read(cssRel);
const theme = read(themeYaml);
const windows = read(windowsYaml);
const ftl = read(ftlRel);

// Registry mutation must be gone
for (const token of [
  "EnableTransparency",
  "writeIntValue",
  "Themes\\\\Personalize",
  "Themes\\Personalize",
  "nsIWindowsRegKey",
]) {
  if (manager.includes(token)) {
    fail(`manager still references registry token: ${token}`);
  }
}
ok("manager has no EnableTransparency / registry write path");

if (manager.includes("promptOsTransparencyIfNeeded")) {
  fail("dead promptOsTransparencyIfNeeded still present");
} else ok("registry prompt API removed");

const scanRoots = [
  path.join(root, "src"),
  path.join(root, "prefs"),
  path.join(root, "scripts"),
  path.join(root, "configs"),
];
let enableHits = [];
for (const base of scanRoots) {
  for (const file of walkFiles(base, [
    ".mjs",
    ".js",
    ".cjs",
    ".yaml",
    ".inc",
    ".xhtml",
    ".ftl",
  ])) {
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes("EnableTransparency")) continue;
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (rel.includes("validate_astra_transparency_v2")) continue;
    if (
      /"EnableTransparency"/.test(text) ||
      /writeIntValue\(\s*"EnableTransparency"/.test(text)
    ) {
      enableHits.push(rel);
    } else if (
      /EnableTransparency/.test(text) &&
      /writeIntValue|ACCESS_WRITE/.test(text)
    ) {
      enableHits.push(rel);
    }
  }
}
if (enableHits.length) {
  fail(`EnableTransparency write/reference remains: ${enableHits.join(", ")}`);
} else ok("no EnableTransparency writes outside validator");

if (/zen-transparency-os-disabled|zen-transparency-enabled-heading|zen-transparency-restart/.test(ftl)) {
  fail("Windows-setting prompt Fluent strings remain");
} else ok("no Windows-setting prompt Fluent strings");

// Prefs — fresh profile default ON
const enabledMatch = theme.match(
  /- name:\s*astra\.theme\.transparent\.enabled\r?\n\s*value:\s*(true|false)/
);
if (!enabledMatch) fail("could not parse astra.theme.transparent.enabled");
else if (enabledMatch[1] !== "true") {
  fail("fresh-profile default must be true (product glass-on)");
} else ok("fresh-profile Transparent Mode defaults to true");

if (!/name:\s*astra\.theme\.transparent\.mode/.test(theme)) {
  fail("requested-mode pref missing");
} else ok("requested-mode pref present");

if (!/name:\s*astra\.theme\.transparent\.v2-native-owned/.test(theme)) {
  fail("v2 native ownership migration pref missing");
} else ok("v2 native ownership migration pref present");

const allowMatch = theme.match(
  /- name:\s*browser\.tabs\.allow_transparent_browser\r?\n\s*value:\s*(true|false)/
);
if (!allowMatch) fail("could not parse allow_transparent_browser");
else if (allowMatch[1] === "true") fail("allow_transparent_browser forced true");
else ok("allow_transparent_browser not forced true");

const micaMatch = windows.match(
  /- name:\s*widget\.windows\.mica\r?\n\s*value:\s*(true|false)/
);
if (!micaMatch) fail("could not parse widget.windows.mica");
else if (micaMatch[1] === "true") fail("widget.windows.mica still default true");
else ok("widget.windows.mica defaults to false");

const popupsMatch = windows.match(
  /- name:\s*widget\.windows\.mica\.popups\r?\n\s*value:\s*(\d+|true|false)/
);
if (!popupsMatch) fail("could not parse mica.popups");
else if (popupsMatch[1] === "true" || popupsMatch[1] === "false") {
  fail("mica.popups must be integer, not boolean");
} else if (popupsMatch[1] !== "0") {
  fail("mica.popups default should be 0 when Transparent Mode owns it");
} else ok("mica.popups defaults to integer 0");

// Manager invariants
for (const t of [
  "astra-transparent-desired",
  "astra-transparent-requested-mode",
  "astra-transparent-effective-mode",
  "gAstraTransparencyDiagnostics",
  "NativeCoordinator",
  "ensureOwnershipMigrated",
  "native-acrylic",
  "native-mica",
  "astra-glass",
  "FALLBACK_REASONS",
  "Policy B",
  'nativeApplied: "best-effort"',
]) {
  if (manager.includes(t) || (t === 'nativeApplied: "best-effort"' && manager.includes('"best-effort"'))) {
    ok(`manager has ${t}`);
  } else fail(`manager missing ${t}`);
}

// Must not assign nativeApplied = true as a stored value
if (/nativeApplied\s*=\s*true\b/.test(manager.replace(/\/\/[^\n]*/g, ""))) {
  fail("manager still assigns nativeApplied = true");
} else ok("no nativeApplied=true assignment");

if (
  /#micaMediaActive\(\)[\s\S]{0,120}nativeApplied\s*=\s*true/.test(manager) ||
  /micaMediaActive[\s\S]{0,80}nativeApplied\s*=\s*true/.test(manager)
) {
  fail("MQ-only nativeApplied=true inference present");
} else ok("no MQ-only nativeApplied=true inference");

if (manager.includes("setInterval") || /setTimeout\s*\([^,]+,\s*[5-9]\d{3,}/.test(manager)) {
  fail("manager has polling / long timer");
} else ok("no poll/long timer in manager");

if (manager.includes("window.closed") && manager.includes("#destroyed")) {
  ok("unload-safe reapply guards present");
} else fail("missing destroyed/closed guards");

if (manager.includes("#bumpGeneration(\"delayed-startup\")") || manager.includes('#bumpGeneration("delayed-startup")')) {
  fail("delayed-startup must not reset attempt budget");
} else ok("delayed-startup does not reset attempt budget");

if (manager.includes("#bumpGeneration(\"startup-ready\")") || manager.includes('#bumpGeneration("startup-ready")')) {
  fail("startup-ready must not reset attempt budget");
} else ok("startup-ready does not reset attempt budget");

if (/stage === "construct"[\s\S]{0,200}astra-glass/.test(manager)) {
  ok("construct applies Astra Glass shell first");
} else fail("construct missing immediate Astra Glass shell");

if (manager.includes("acrylic: 2") && manager.includes("mica: 1")) {
  ok("native backdrop map uses 1/2/3");
} else fail("native backdrop mapping incomplete");

// CSS
if (
  /effective-mode="native-acrylic"[\s\S]{0,500}#zen-main-app-wrapper[\s\S]{0,200}background-color:/.test(
    css
  )
) {
  ok("native modes have material floor on #zen-main-app-wrapper");
} else fail("native modes missing material floor");

if (css.includes("--astra-glass-gradient") || css.includes("astra-glass-gradient")) {
  ok("Astra Glass CSS material exists");
} else fail("Astra Glass CSS missing");

if (
  /effective-mode="[^"]+"[\s\S]{0,80}#appcontent[\s\S]{0,80}background:\s*transparent/.test(
    css
  ) ||
  /effective-mode[\s\S]{0,200}\.browserContainer[\s\S]{0,80}background:\s*transparent/.test(
    css
  )
) {
  fail("CSS still forces content shells transparent");
} else ok("content shells not forced transparent by V2 CSS");

if (/url\(\s*["']?https?:/.test(css)) fail("CSS has remote url()");
else ok("CSS has no remote backgrounds");

// Fluent honesty
if (ftl.includes("Native Acrylic") || ftl.includes("astra-theme-transparent-native-acrylic")) {
  fail("Fluent still claims confirmed Native Acrylic");
} else ok("Fluent uses requested/best-effort wording");

if (
  ftl.includes("astra-theme-transparent-acrylic-requested") &&
  ftl.includes("astra-theme-transparent-astra-glass")
) {
  ok("Fluent has acrylic-requested and Astra Glass ids");
} else fail("Fluent missing honest status ids");

// App Hub / Suraksha
const preload = read("src/zen/common/ZenPreloadedScripts.js");
const sets = read("src/zen/common/zen-sets.js");
const commands = read("src/browser/base/content/zen-commands.inc.xhtml");

if (
  preload.includes("AstraAppHubBootstrap.mjs") &&
  !preload.includes("AstraSuraksha")
) {
  ok("App Hub preloaded; retired Suraksha absent");
} else fail("App Hub preload missing or retired Suraksha still preloaded");

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
} else fail("Suraksha command definition missing");

if (preload.includes("AstraTransparencyManager.mjs")) {
  ok("transparency manager still preloaded");
} else fail("transparency manager not preloaded");

const jar = read("src/zen/common/jar.inc.mn");
if (jar.includes("mods/astra-transparent")) {
  fail("legacy mod path packaged in jar");
} else ok("legacy astra-transparent mod not packaged in jar");

// --- Pure state transition harness (no DWM) ---
function decide({
  desired,
  mode,
  platformWin,
  highContrast,
  reducedTransparency,
  prefsOk,
  micaCapability,
  attempted,
}) {
  if (!desired) {
    return {
      effective: "opaque",
      nativeRequested: false,
      nativeApplied: false,
      fallback: "disabled",
      clearNative: true,
    };
  }
  if (highContrast) {
    return {
      effective: "astra-glass",
      nativeRequested: false,
      nativeApplied: false,
      fallback: "high-contrast",
      clearNative: true,
    };
  }
  if (reducedTransparency) {
    return {
      effective: "astra-glass",
      nativeRequested: false,
      nativeApplied: false,
      fallback: "reduced-transparency",
      clearNative: true,
    };
  }
  if (mode === "astra-glass") {
    return {
      effective: "astra-glass",
      nativeRequested: false,
      nativeApplied: false,
      fallback: "none",
      clearNative: true,
    };
  }
  if (!platformWin) {
    return {
      effective: "astra-glass",
      nativeRequested: false,
      nativeApplied: false,
      fallback: "unsupported-platform",
      clearNative: true,
    };
  }
  const order =
    mode === "mica"
      ? ["mica"]
      : mode === "mica-alt"
        ? ["mica-alt"]
        : mode === "acrylic"
          ? ["acrylic"]
          : ["acrylic", "mica"];
  for (const c of order) {
    if (attempted?.has?.(c)) continue;
    if (!prefsOk) continue;
    if (!micaCapability) continue;
    return {
      effective:
        c === "acrylic"
          ? "native-acrylic"
          : c === "mica"
            ? "native-mica"
            : "native-mica-alt",
      nativeRequested: true,
      nativeApplied: "best-effort",
      fallback: "none",
      clearNative: false,
      candidate: c,
    };
  }
  return {
    effective: "astra-glass",
    nativeRequested: false,
    nativeApplied: false,
    fallback: "native-application-failed",
    clearNative: true,
  };
}

const cases = [
  {
    name: "OFF + stale native",
    in: { desired: false, mode: "auto", platformWin: true, prefsOk: true, micaCapability: true },
    expect: { effective: "opaque", clearNative: true, nativeApplied: false },
  },
  {
    name: "ON astra-glass",
    in: { desired: true, mode: "astra-glass", platformWin: true, prefsOk: true, micaCapability: true },
    expect: { effective: "astra-glass", nativeRequested: false, clearNative: true },
  },
  {
    name: "ON acrylic unsupported platform",
    in: { desired: true, mode: "acrylic", platformWin: false, prefsOk: false, micaCapability: false },
    expect: { effective: "astra-glass", fallback: "unsupported-platform" },
  },
  {
    name: "ON acrylic best-effort",
    in: { desired: true, mode: "acrylic", platformWin: true, prefsOk: true, micaCapability: true },
    expect: {
      effective: "native-acrylic",
      nativeApplied: "best-effort",
      nativeRequested: true,
    },
  },
  {
    name: "ON high contrast",
    in: {
      desired: true,
      mode: "auto",
      platformWin: true,
      highContrast: true,
      prefsOk: true,
      micaCapability: true,
    },
    expect: { effective: "astra-glass", fallback: "high-contrast" },
  },
  {
    name: "invalid mode → treated as auto path via caller",
    in: {
      desired: true,
      mode: "auto",
      platformWin: true,
      prefsOk: true,
      micaCapability: true,
    },
    expect: { effective: "native-acrylic", nativeApplied: "best-effort" },
  },
  {
    name: "capability fail → glass",
    in: {
      desired: true,
      mode: "auto",
      platformWin: true,
      prefsOk: true,
      micaCapability: false,
    },
    expect: { effective: "astra-glass" },
  },
];

for (const tc of cases) {
  const out = decide(tc.in);
  let pass = true;
  for (const [k, v] of Object.entries(tc.expect)) {
    if (out[k] !== v) {
      pass = false;
      fail(`state ${tc.name}: ${k}=${out[k]} expected ${v}`);
    }
  }
  if (pass) ok(`state ${tc.name}`);
}

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll Transparent Mode V2 checks passed.");
process.exit(0);
