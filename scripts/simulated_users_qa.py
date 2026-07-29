#!/usr/bin/env python3
"""Multi-persona simulated-user QA against a real Astra build via Marionette.

Spins up fresh profiles, drives distinct Indian-user personas through realistic
sessions, and captures branding leftovers, layout rects, and UX friction.
Does not sandboxed-guess — all findings come from live chrome DOM / computed style.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
# Prefer hot-patched local run dir (tracks latest source fixes); fall back to install.
_ASTRA_RUN = ROOT / ".tmp-tb-diag" / "astra-run" / "astra.exe"
_ASTRA_INSTALL = Path(r"C:\Program Files\Astra Browser\astra.exe")
DEFAULT_EXE = _ASTRA_RUN if _ASTRA_RUN.exists() else _ASTRA_INSTALL
DIAG = ROOT / ".tmp-tb-diag" / "simulated-users-qa"
OUT_DIR = DIAG / "results"
DEFAULT_PORT = 2831

# Persona search-engine submission templates (Services.search often unavailable in chrome sandbox)
ENGINE_SUBMIT = {
    "google": "https://www.google.com/search?q={q}",
    "bing": "https://www.bing.com/search?q={q}",
    "duckduckgo": "https://duckduckgo.com/?q={q}",
    "ddg": "https://duckduckgo.com/?q={q}",
    "perplexity": "https://www.perplexity.ai/search?q={q}",
    "yahoo": "https://search.yahoo.com/search?p={q}",
}

# ---------------------------------------------------------------------------
# Personas — realistic Indian user spread (dict list, not separate files)
# ---------------------------------------------------------------------------
PERSONAS: list[dict[str, Any]] = [
    {
        "id": "priya_student",
        "name": "Priya (College Student)",
        "primary_language_habit": "Hindi-English mixed search queries",
        "typical_sites": ["education", "youtube"],
        "search_engine_preference": "Google",
        "device_context": "Windows",
        "tech_familiarity": "average",
        "searches": [
            "DU semester exam date sheet 2026",
            "NPTEL Python course free",
            "youtube study with me lofi",
        ],
        "urls": [
            "https://www.youtube.com/",
            "https://nptel.ac.in/",
            "https://www.du.ac.in/",
        ],
        "astra_feature": "compact_mode",
        "settings_panels": ["general", "appearance"],
        "engine_id_hint": "google",
    },
    {
        "id": "rajesh_sbo",
        "name": "Rajesh (Small Business Owner)",
        "primary_language_habit": "pure English",
        "typical_sites": ["whatsapp_web", "banking"],
        "search_engine_preference": "Bing",
        "device_context": "Windows",
        "tech_familiarity": "average",
        "searches": [
            "SBI net banking login",
            "GST return due date",
            "WhatsApp Web business tips",
        ],
        "urls": [
            "https://web.whatsapp.com/",
            "https://onlinesbi.sbi/",
            "https://www.gst.gov.in/",
        ],
        "astra_feature": "app_hub",
        "settings_panels": ["privacy", "general"],
        "engine_id_hint": "bing",
        "app_hub_targets": ["WhatsApp", "Gmail"],
    },
    {
        "id": "meena_gov",
        "name": "Meena (Gov-service User)",
        "primary_language_habit": "regional-language-leaning (Hindi queries)",
        "typical_sites": ["digilocker", "irctc", "gov"],
        "search_engine_preference": "DuckDuckGo",
        "device_context": "Windows",
        "tech_familiarity": "novice",
        "searches": [
            "डिजिलॉकर आधार कार्ड डाउनलोड",
            "IRCTC ticket booking",
            "आधार कार्ड अपडेट",
        ],
        "urls": [
            "https://www.digilocker.gov.in/",
            "https://www.irctc.co.in/",
            "https://uidai.gov.in/",
        ],
        "astra_feature": "app_hub",
        "settings_panels": ["privacy", "appearance"],
        "engine_id_hint": "ddg",
        "app_hub_targets": ["DigiLocker", "IRCTC"],
        "check_sidebar_nav_when_panel_open": True,
    },
    {
        "id": "arjun_casual",
        "name": "Arjun (Casual Social/News)",
        "primary_language_habit": "Hindi-English mixed",
        "typical_sites": ["news", "youtube", "social"],
        "search_engine_preference": "Google",
        "device_context": "Windows",
        "tech_familiarity": "novice",
        "searches": [
            "aaj ki taaza khabar cricket",
            "India vs England highlights youtube",
            "weather mumbai aaj",
        ],
        "urls": [
            "https://www.ndtv.com/",
            "https://www.youtube.com/",
            "https://timesofindia.indiatimes.com/",
        ],
        "astra_feature": "sidebar_nav",
        "settings_panels": ["general", "privacy"],
        "engine_id_hint": "google",
        "check_sidebar_nav_when_panel_open": True,
    },
    {
        "id": "kavya_power",
        "name": "Kavya (Power User)",
        "primary_language_habit": "pure English",
        "typical_sites": ["github", "docs", "news", "youtube"],
        "search_engine_preference": "Perplexity",
        "device_context": "Windows",
        "tech_familiarity": "power-user",
        "searches": [
            "firefox marionette chrome context example",
            "css container queries browser support",
            "best vertical tabs workflow",
        ],
        "urls": [
            "https://github.com/",
            "https://developer.mozilla.org/",
            "https://news.ycombinator.com/",
        ],
        "astra_feature": "split_view",
        "settings_panels": ["appearance", "general"],
        "engine_id_hint": "perplexity",
        "also_try": ["tab_groups", "compact_mode"],
    },
    {
        "id": "suresh_migrant",
        "name": "Suresh (Chrome Migrant / First-time Switcher)",
        "primary_language_habit": "pure English",
        "typical_sites": ["shopping", "news"],
        "search_engine_preference": "Yahoo",
        "device_context": "Windows",
        "tech_familiarity": "novice",
        "searches": [
            "best phone under 20000 India",
            "flipkart sale today",
            "how to import bookmarks from chrome",
        ],
        "urls": [
            "https://www.amazon.in/",
            "https://www.flipkart.com/",
            "https://www.hindustantimes.com/",
        ],
        "astra_feature": "settings_import_about",
        "settings_panels": ["general", "privacy", "appearance"],
        "engine_id_hint": "yahoo",
        "look_for_import": True,
    },
]


# ---------------------------------------------------------------------------
# Marionette (raw socket — chrome sandbox, matches prior Astra QA scripts)
# ---------------------------------------------------------------------------
def read_msg(sock: socket.socket, timeout: float = 120) -> Any:
    sock.settimeout(timeout)
    buf = b""
    while b":" not in buf:
        c = sock.recv(1)
        if not c:
            raise RuntimeError("marionette connection closed")
        buf += c
    ls, rest = buf.split(b":", 1)
    length = int(ls)
    while len(rest) < length:
        rest += sock.recv(length - len(rest))
    return json.loads(rest.decode())


def send_msg(sock: socket.socket, obj: Any) -> None:
    data = json.dumps(obj, separators=(",", ":")).encode()
    sock.sendall(f"{len(data)}:".encode() + data)


class MarionetteClient:
    def __init__(self, port: int):
        self.sock = socket.create_connection(("127.0.0.1", port), 30)
        read_msg(self.sock)
        self._id = 0

    def req(self, name: str, params: dict | None = None, timeout: float = 120) -> Any:
        self._id += 1
        send_msg(self.sock, [0, self._id, name, params or {}])
        resp = read_msg(self.sock, timeout)
        if resp[2]:
            raise RuntimeError(resp[2])
        r = resp[3]
        return r["value"] if isinstance(r, dict) and set(r.keys()) == {"value"} else r

    def new_session(self) -> None:
        self.req("WebDriver:NewSession", {"capabilities": {}}, 180)
        self.req("Marionette:SetContext", {"value": "chrome"})
        self.req(
            "WebDriver:SetTimeouts",
            {"implicit": 0, "pageLoad": 300000, "script": 300000},
        )

    def ex(self, script: str, timeout: float = 90) -> Any:
        return self.req(
            "WebDriver:ExecuteScript",
            {"script": script, "args": [], "sandbox": "chrome", "newSandbox": True},
            timeout,
        )

    def exa(self, script: str, timeout: float = 300) -> Any:
        return self.req(
            "WebDriver:ExecuteAsyncScript",
            {"script": script, "args": [], "sandbox": "chrome", "newSandbox": True},
            timeout,
        )


def kill_astra() -> None:
    subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-Command",
            "Get-Process astra,plugin-container -ErrorAction SilentlyContinue | Stop-Process -Force",
        ],
        check=False,
        capture_output=True,
    )
    time.sleep(1.5)


def wait_port(port: int, timeout: float = 120) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), 1):
                return True
        except OSError:
            time.sleep(0.5)
    return False


def write_user_js(profile: Path, port: int, persona: dict[str, Any]) -> None:
    engine = persona.get("engine_id_hint", "google")
    lines = [
        f'user_pref("marionette.port", {port});',
        'user_pref("zen.welcome-screen.seen", true);',
        'user_pref("browser.aboutwelcome.enabled", false);',
        'user_pref("browser.shell.checkDefaultBrowser", false);',
        'user_pref("browser.startup.homepage_override.mstone", "ignore");',
        'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
        'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
        'user_pref("app.update.enabled", false);',
        'user_pref("app.update.auto", false);',
        'user_pref("zen.view.use-single-toolbar", false);',
        'user_pref("zen.view.sidebar-expanded", true);',
        'user_pref("sidebar.revamp", true);',
        # Prefer the persona's search engine when possible (soft — runtime also sets)
        f'user_pref("browser.urlbar.placeholderName", "{persona["search_engine_preference"]}");',
    ]
    # Novices get expanded sidebar so Back/Forward discovery can be measured
    if persona.get("tech_familiarity") == "novice":
        lines.append('user_pref("zen.view.sidebar-expanded", true);')
    profile.mkdir(parents=True, exist_ok=True)
    (profile / "user.js").write_text("\n".join(lines) + "\n", encoding="utf-8")
    # silence unused
    _ = engine


# ---------------------------------------------------------------------------
# Per-persona chrome session script (varied behavior, shared capture helpers)
# ---------------------------------------------------------------------------
SESSION_JS = r"""
const persona = arguments[0];
const done = arguments[arguments.length - 1];

(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const findings = [];
  const push = (category, severity, title, detail) => {
    findings.push({ category, severity, title, detail, persona_id: persona.id });
  };

  const rectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: +r.x.toFixed(2), y: +r.y.toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      left: +r.left.toFixed(2), right: +r.right.toFixed(2),
      top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2),
    };
  };

  const visibleTextNodes = (root) => {
    const hits = [];
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === 3) {
        const t = (node.textContent || "").replace(/\s+/g, " ").trim();
        if (t && /\bZen\b/.test(t)) {
          const parent = node.parentElement;
          hits.push({
            text: t.slice(0, 200),
            tag: parent?.tagName || null,
            id: parent?.id || null,
            className: (parent?.className || "").toString().slice(0, 120),
          });
        }
        return;
      }
      if (node.nodeType === 1) {
        const el = node;
        // skip script/style
        if (["SCRIPT", "STYLE", "link"].includes(el.tagName)) return;
        for (const attr of ["title", "tooltiptext", "aria-label", "label", "value", "placeholder"]) {
          const v = el.getAttribute?.(attr);
          if (v && /\bZen\b/.test(v)) {
            hits.push({ text: v.slice(0, 200), attr, tag: el.tagName, id: el.id || null });
          }
        }
        for (const c of el.childNodes) walk(c);
      }
    };
    walk(root);
    return hits;
  };

  const measureLayout = (label) => {
    const nav = document.getElementById("nav-bar");
    const content =
      document.querySelector(".browserSidebarContainer") ||
      document.getElementById("tabbrowser-tabpanels");
    const wrap = document.getElementById("zen-appcontent-navbar-wrapper");
    const toolbox = document.getElementById("navigator-toolbox");
    const sidebar =
      document.getElementById("zen-sidebar") ||
      document.getElementById("sidebar-main") ||
      document.getElementById("sidebar-box");
    const appHubBtn = document.getElementById("zen-app-launcher-button");
    const compactBtn =
      document.getElementById("zen-toggle-compact-mode") ||
      document.getElementById("zen-compact-mode-toggle");
    const overflow = document.getElementById("nav-bar-overflow-button");
    const panelUI = document.getElementById("PanelUI-button");
    const railNav = document.getElementById("astra-sidebar-navigation");

    const nr = rectOf(nav);
    const cr = rectOf(content);
    const wr = rectOf(wrap);
    const sr = rectOf(sidebar);
    const issues = [];

    if (nr && cr) {
      const overhang = +(nr.right - cr.right).toFixed(2);
      if (Math.abs(overhang) > 1.5) {
        issues.push({
          kind: "nav_content_right_misalign",
          overhang,
          navRight: nr.right,
          contentRight: cr.right,
        });
      }
    }
    // Clipping / zero-size critical controls
    for (const [name, el] of [
      ["app_hub_btn", appHubBtn],
      ["compact_btn", compactBtn],
      ["overflow", overflow],
      ["panel_ui", panelUI],
      ["sidebar_nav", railNav],
    ]) {
      if (!el) continue;
      const r = rectOf(el);
      const cs = getComputedStyle(el);
      if (r && (r.w < 1 || r.h < 1) && cs.display !== "none" && cs.visibility !== "hidden") {
        issues.push({ kind: "zero_size_control", name, rect: r });
      }
      // Overlap check vs neighbors in toolbar
      if (el.parentElement) {
        const sibs = [...el.parentElement.children].filter(c => c !== el && c.getBoundingClientRect().width > 0);
        for (const s of sibs.slice(0, 8)) {
          const a = el.getBoundingClientRect();
          const b = s.getBoundingClientRect();
          const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          if (overlapX > 2 && overlapY > 2 && a.width > 4 && b.width > 4) {
            // Only flag if both are toolbarbuttons (avoid false positives)
            if (el.localName?.includes("toolbar") || s.localName?.includes("toolbar") ||
                el.classList?.contains("toolbarbutton-1") || s.classList?.contains("toolbarbutton-1")) {
              issues.push({
                kind: "toolbar_overlap",
                a: el.id || name,
                b: s.id || s.localName,
                overlapX: +overlapX.toFixed(2),
                overlapY: +overlapY.toFixed(2),
              });
              break;
            }
          }
        }
      }
    }

    // App Hub panel if open
    const hub = document.getElementById("PanelUI-zen-app-launcher");
    let hubRect = null;
    if (hub && (hub.hasAttribute("panelopen") || hub.state === "open" || hub.hasAttribute("open"))) {
      hubRect = rectOf(hub);
      if (hubRect && (hubRect.w < 80 || hubRect.h < 80)) {
        issues.push({ kind: "apphub_too_small", rect: hubRect });
      }
      if (hubRect && (hubRect.right > window.innerWidth + 2 || hubRect.bottom > window.innerHeight + 2)) {
        issues.push({ kind: "apphub_clipped", rect: hubRect, winW: window.innerWidth, winH: window.innerHeight });
      }
    }

    return {
      label,
      winW: window.innerWidth,
      winH: window.innerHeight,
      nav: nr,
      content: cr,
      wrap: wr,
      sidebar: sr,
      toolbox: rectOf(toolbox),
      appHubBtn: rectOf(appHubBtn),
      compactBtn: rectOf(compactBtn),
      railNav: rectOf(railNav),
      hubPanel: hubRect,
      issues,
    };
  };

  const setScheme = async (scheme) => {
    // zen.view.window.scheme: 0=auto? 1=light 2=dark (prior scripts used 1/2)
    try { Services.prefs.setIntPref("zen.view.window.scheme", scheme); } catch (e) {}
    try {
      Services.prefs.setIntPref(
        "layout.css.prefers-color-scheme.content-override",
        scheme === 2 ? 0 : 1
      );
    } catch (e) {}
    await sleep(600);
  };

  const installConsoleProbe = () => {
    if (window.__astraSimUserConsole) return;
    const hits = [];
    const wrap = (level, orig) =>
      function (...args) {
        try {
          const text = args
            .map((a) => {
              try {
                if (a == null) return String(a);
                if (typeof a === "string") return a;
                if (a && a.message) return String(a.message);
                return String(a);
              } catch (_) {
                return "[unprintable]";
              }
            })
            .join(" ");
          if (/\bZen\b/i.test(text) || /\bzen browser\b/i.test(text)) {
            hits.push({ level, text: text.slice(0, 400), t: Date.now() });
          }
        } catch (_) {}
        return orig.apply(console, args);
      };
    console.log = wrap("log", console.log.bind(console));
    console.warn = wrap("warn", console.warn.bind(console));
    console.error = wrap("error", console.error.bind(console));
    console.info = wrap("info", console.info.bind(console));
    window.__astraSimUserConsole = hits;
  };

  const out = {
    persona: {
      id: persona.id,
      name: persona.name,
      tech_familiarity: persona.tech_familiarity,
      feature: persona.astra_feature,
    },
    steps: {},
    branding: { chromeHits: [], about: null, settings: [], consoleHits: [], windowTitle: null },
    layout: { light: null, dark: null },
    feature: {},
    ux: [],
    findings: findings,
    ok: true,
  };

  try {
    installConsoleProbe();

    // Wait for browser chrome
    for (let i = 0; i < 60; i++) {
      if (window.gBrowser) break;
      await sleep(500);
    }
    if (!window.gBrowser) {
      out.ok = false;
      out.error = "gBrowser never ready";
      done(out);
      return;
    }

    out.branding.windowTitle = document.documentElement.getAttribute("title") ||
      document.title ||
      (Services.wm.getMostRecentWindow("navigator:browser")?.document?.title) ||
      null;
    if (out.branding.windowTitle && /\bZen\b/.test(out.branding.windowTitle)) {
      push("branding", "high", "Window title still says Zen", { title: out.branding.windowTitle });
    }

    // Soft-set default search via known Astra engine submission URLs
    // (Services.search is often undefined inside Marionette chrome sandbox)
    const ENGINE_SUBMIT = {
      google: "https://www.google.com/search?q=",
      bing: "https://www.bing.com/search?q=",
      duckduckgo: "https://duckduckgo.com/?q=",
      ddg: "https://duckduckgo.com/?q=",
      perplexity: "https://www.perplexity.ai/search?q=",
      yahoo: "https://search.yahoo.com/search?p=",
    };
    const engineKey = (persona.engine_id_hint || "google").toLowerCase();
    const enginePrefix = ENGINE_SUBMIT[engineKey] || ENGINE_SUBMIT.google;
    out.steps.searchEngine = {
      wanted: persona.search_engine_preference,
      engineKey,
      prefix: enginePrefix,
    };
    try {
      const ss = Services.search;
      if (ss) {
        await ss.init();
        const engines = await ss.getVisibleEngines();
        const wanted = (persona.search_engine_preference || "").toLowerCase();
        const match = engines.find((e) => {
          const n = (e.name || "").toLowerCase();
          const id = (e.id || e.identifier || "").toLowerCase();
          return n.includes(wanted) || id.includes(engineKey);
        });
        if (match) {
          await ss.setDefault(match);
          out.steps.searchEngine.set = match.name;
        } else {
          out.steps.searchEngine.available = engines.map((e) => e.name).slice(0, 12);
        }
      }
    } catch (e) {
      out.steps.searchEngine.searchServiceError = String(e);
    }

    // ---- Searches via preferred engine URL templates ----
    const searchResults = [];
    for (const q of persona.searches || []) {
      const t0 = performance.now();
      try {
        const navUrl = enginePrefix + encodeURIComponent(q);
        const tab = gBrowser.addTrustedTab(navUrl);
        gBrowser.selectedTab = tab;
        await sleep(2200);
        searchResults.push({
          query: q,
          url: gBrowser.currentURI?.spec || null,
          ms: Math.round(performance.now() - t0),
        });
      } catch (e) {
        searchResults.push({ query: q, error: String(e) });
      }
    }
    out.steps.searches = searchResults;

    // ---- Open typical site tabs ----
    const tabResults = [];
    for (const u of persona.urls || []) {
      const t0 = performance.now();
      try {
        const tab = gBrowser.addTrustedTab(u);
        gBrowser.selectedTab = tab;
        await sleep(1800);
        tabResults.push({
          url: u,
          final: gBrowser.currentURI?.spec || null,
          ms: Math.round(performance.now() - t0),
          title: (tab.label || "").slice(0, 80),
        });
      } catch (e) {
        tabResults.push({ url: u, error: String(e) });
      }
    }
    out.steps.tabs = tabResults;

    // Slow loads (persona-relevant)
    for (const t of tabResults) {
      if (t.ms && t.ms > 8000) {
        push("ux", "medium", `Slow tab load for ${t.url}`, { ms: t.ms, final: t.final });
      }
    }

    // ---- Astra-specific feature per persona ----
    const feature = persona.astra_feature;
    if (feature === "app_hub") {
      const feat = { opened: false, targets: {}, labels: [], zenInPanel: [] };
      try {
        if (window.gAstraAppHubBootstrap?.toggle) {
          await window.gAstraAppHubBootstrap.toggle();
        } else {
          document.getElementById("zen-app-launcher-button")?.click();
        }
        await sleep(1200);
        const panel = document.getElementById("PanelUI-zen-app-launcher");
        feat.opened = !!(
          panel &&
          (panel.hasAttribute("panelopen") || panel.state === "open" || panel.hasAttribute("open") ||
           panel.getBoundingClientRect().height > 40)
        );
        const items = [
          ...(panel?.querySelectorAll(
            ".astra-app-hub-item[data-app-id], .zen-app-launcher-item[data-app-id], [data-app-id]"
          ) || []),
        ];
        feat.labels = items
          .map((el) =>
            (
              el.getAttribute("tooltiptext") ||
              el.getAttribute("aria-label") ||
              el.getAttribute("data-app-id") ||
              el.textContent ||
              ""
            )
              .replace(/\s+/g, " ")
              .trim()
          )
          .filter(Boolean)
          .slice(0, 40);
        feat.zenInPanel = visibleTextNodes(panel || document.createDocumentFragment());
        if (feat.zenInPanel.length) {
          push("branding", "high", "App Hub panel shows Zen text", { hits: feat.zenInPanel.slice(0, 8) });
        }
        for (const want of persona.app_hub_targets || []) {
          const el = items.find((i) => {
            const blob = (
              (i.getAttribute("tooltiptext") || "") +
              " " +
              (i.getAttribute("aria-label") || "") +
              " " +
              (i.getAttribute("data-app-id") || "") +
              " " +
              (i.textContent || "")
            ).toLowerCase();
            return blob.includes(want.toLowerCase());
          });
          if (!el) {
            feat.targets[want] = { ok: false, reason: "missing" };
            push("ux", "high", `App Hub missing expected app: ${want}`, {
              availableSample: feat.labels.slice(0, 15),
            });
            continue;
          }
          const before = gBrowser.currentURI?.spec;
          const tabCountBefore = gBrowser.tabs.length;
          try {
            const appId = el.getAttribute("data-app-id");
            if (appId && window.gAstraAppHubManager?.openApp) {
              await gAstraAppHubManager.openApp(appId, { mode: "tab", source: "sim-user" });
            } else if (appId && window.gZenAppLauncher?.openApp) {
              await gZenAppLauncher.openApp(appId, { mode: "tab", source: "sim-user" });
            } else {
              el.click();
            }
          } catch (e) {
            try { el.click(); } catch (_) {}
            feat.targets[want] = { ...(feat.targets[want] || {}), clickError: String(e) };
          }
          await sleep(1200);
          const after = gBrowser.currentURI?.spec;
          const tabCountAfter = gBrowser.tabs.length;
          const ok =
            (after && after !== "about:blank" && after !== before) ||
            tabCountAfter > tabCountBefore;
          feat.targets[want] = {
            ok: !!ok,
            before,
            after,
            tabCountBefore,
            tabCountAfter,
            appId: el.getAttribute("data-app-id"),
          };
          if (!ok) {
            push("ux", "medium", `App Hub launch did not navigate for ${want}`, feat.targets[want]);
          }
          // reopen for next
          if (window.gAstraAppHubBootstrap?.open) {
            try { await window.gAstraAppHubBootstrap.open(); } catch (_) {}
          } else if (window.gAstraAppHubBootstrap?.toggle) {
            try { await window.gAstraAppHubBootstrap.toggle(); } catch (_) {}
          } else {
            document.getElementById("zen-app-launcher-button")?.click();
          }
          await sleep(600);
        }
        // close
        try {
          panel?.hidePopup?.();
        } catch (_) {}
        if (!feat.opened) {
          push("ux", "high", "App Hub failed to open", feat);
        }
      } catch (e) {
        feat.error = String(e);
        push("ux", "high", "App Hub interaction errored", { error: String(e) });
      }
      out.feature = feat;

      // Novice: can they still find Back/Forward with panel/sidebar context?
      if (persona.check_sidebar_nav_when_panel_open) {
        const backTop = document.getElementById("back-button");
        const backSide = document.getElementById("astra-sidebar-back");
        const fwdSide = document.getElementById("astra-sidebar-forward");
        const topR = rectOf(backTop);
        const sideR = rectOf(backSide);
        const topHidden =
          !backTop ||
          getComputedStyle(backTop).display === "none" ||
          getComputedStyle(backTop).visibility === "hidden" ||
          (topR && topR.w < 1);
        const sideOk = !!(backSide && sideR && sideR.w > 1 && sideR.h > 1);
        out.feature.navDiscoverability = {
          topBackHidden: topHidden,
          sidebarBackPresent: sideOk,
          sidebarFwdPresent: !!(fwdSide && rectOf(fwdSide)?.w > 1),
          topBack: topR,
          sideBack: sideR,
        };
        if (topHidden && !sideOk && persona.tech_familiarity === "novice") {
          push(
            "ux",
            "high",
            "Novice cannot find Back/Forward (top hidden, sidebar nav missing/zero-size)",
            out.feature.navDiscoverability
          );
        }
      }
    } else if (feature === "compact_mode") {
      const feat = {};
      try {
        if (!window.gZenCompactModeManager) {
          feat.ok = false;
          feat.reason = "gZenCompactModeManager missing";
          push("ux", "medium", "Compact Mode manager missing", feat);
        } else {
          const before = document.documentElement.getAttribute("zen-compact-mode");
          gZenCompactModeManager.preference = true;
          await sleep(700);
          const onAttr = document.documentElement.getAttribute("zen-compact-mode");
          const layoutOn = measureLayout("compact_on");
          gZenCompactModeManager.preference = false;
          await sleep(700);
          const offAttr = document.documentElement.getAttribute("zen-compact-mode");
          feat.ok = onAttr === "true" || onAttr === "" || !!onAttr;
          feat.before = before;
          feat.onAttr = onAttr;
          feat.offAttr = offAttr;
          feat.layoutOn = layoutOn;
          if (!feat.ok) {
            push("ux", "medium", "Compact Mode did not engage", feat);
          }
          for (const iss of layoutOn.issues || []) {
            push("layout", "medium", `Layout issue in Compact Mode: ${iss.kind}`, iss);
          }
        }
      } catch (e) {
        feat.error = String(e);
        push("ux", "medium", "Compact Mode errored", { error: String(e) });
      }
      out.feature = feat;
    } else if (feature === "split_view") {
      const feat = {};
      try {
        if (!window.gZenViewSplitter) {
          feat.ok = false;
          feat.reason = "gZenViewSplitter missing";
          push("ux", "high", "Split View API missing for power user", feat);
        } else {
          const t1 = gBrowser.selectedTab;
          const t2 = gBrowser.addTrustedTab("https://example.com/");
          await sleep(900);
          gZenViewSplitter.splitTabs([t1, t2], "vsep");
          await sleep(700);
          const splitAttr = document.querySelector("[zen-split-view='true'], tab-split-view-wrapper, .zen-split-view");
          const group = gZenViewSplitter.currentGroup;
          feat.ok = !!(splitAttr || group || t1.splitView);
          feat.hasWrapper = !!splitAttr;
          feat.hasGroup = !!group;
          feat.layout = measureLayout("split_on");
          // Also try a quick folder/tab-group style action if available
          if ((persona.also_try || []).includes("tab_groups")) {
            try {
              if (gBrowser.addTabGroup) {
                const tg = gBrowser.addTabGroup([t2], { label: "Work" });
                feat.tabGroup = { ok: !!tg, id: tg?.id || null };
              } else if (window.gZenFolders || window.gZenWorkspaces) {
                feat.tabGroup = {
                  ok: true,
                  note: "addTabGroup missing; folders/workspaces present",
                  folders: !!window.gZenFolders,
                  workspaces: !!window.gZenWorkspaces,
                };
              } else {
                feat.tabGroup = { ok: false, reason: "no tab group API" };
                push("ux", "medium", "Tab groups API not available", feat.tabGroup);
              }
            } catch (e) {
              feat.tabGroup = { ok: false, error: String(e) };
            }
          }
          try {
            if (gZenViewSplitter.toggleShortcut) gZenViewSplitter.toggleShortcut("unsplit");
            else if (gZenViewSplitter.unsplitTabs) gZenViewSplitter.unsplitTabs();
          } catch (_) {}
          await sleep(400);
          try { gBrowser.removeTab(t2); } catch (_) {}
          if (!feat.ok) {
            push("ux", "high", "Split View failed to activate", feat);
          }
          for (const iss of (feat.layout?.issues || [])) {
            push("layout", "medium", `Layout issue in Split View: ${iss.kind}`, iss);
          }
        }
      } catch (e) {
        feat.error = String(e);
        push("ux", "high", "Split View errored", { error: String(e) });
      }
      out.feature = feat;
    } else if (feature === "sidebar_nav") {
      const feat = {};
      try {
        const host = document.getElementById("astra-sidebar-navigation");
        const back = document.getElementById("astra-sidebar-back");
        const fwd = document.getElementById("astra-sidebar-forward");
        const reload = document.getElementById("astra-sidebar-reload");
        feat.host = !!host;
        feat.commands = {
          back: !!back,
          forward: !!fwd,
          reload: !!reload,
          backCmd: back?.getAttribute("command"),
          fwdCmd: fwd?.getAttribute("command"),
        };
        feat.rects = { host: rectOf(host), back: rectOf(back), fwd: rectOf(fwd), reload: rectOf(reload) };
        // Exercise back after navigating
        const before = gBrowser.currentURI?.spec;
        if (back) {
          back.click();
          await sleep(800);
        }
        feat.afterBack = gBrowser.currentURI?.spec;
        feat.navigated = feat.afterBack !== before;
        if (!host || !back) {
          push("ux", "high", "Sidebar navigation missing for casual/novice user", feat);
        }
        // Open AI sidebar / web panel if present
        const aiBtn =
          document.getElementById("zen-sidepanel-button") ||
          document.querySelector("#zen-sidebar-panels toolbarbutton, #astra-ai-sidebar-button");
        if (aiBtn) {
          try {
            aiBtn.click();
            await sleep(800);
            feat.aiPanelAttempted = true;
            feat.aiPanelOpen = !!document.querySelector(
              "#zen-sidebar-web-panel[open], #zen-sidebar-web-panel:not([hidden]), .zen-sidebar-panel[open]"
            );
          } catch (e) {
            feat.aiPanelError = String(e);
          }
        }
      } catch (e) {
        feat.error = String(e);
        push("ux", "medium", "Sidebar nav check errored", { error: String(e) });
      }
      out.feature = feat;
    } else if (feature === "settings_import_about") {
      const feat = { importUI: null };
      // Import discovery happens in settings walk below
      out.feature = feat;
    }

    // ---- Layout Light + Dark ----
    try {
      await setScheme(1);
      out.layout.light = measureLayout("light");
      for (const iss of out.layout.light.issues || []) {
        push("layout", "medium", `Light theme layout: ${iss.kind}`, iss);
      }
      // Open App Hub briefly in light for panel rect
      try {
        if (window.gAstraAppHubBootstrap?.toggle) await window.gAstraAppHubBootstrap.toggle();
        else document.getElementById("zen-app-launcher-button")?.click();
        await sleep(700);
        const lightHub = measureLayout("light_apphub");
        out.layout.light_apphub = lightHub;
        for (const iss of lightHub.issues || []) {
          push("layout", "medium", `Light App Hub layout: ${iss.kind}`, iss);
        }
        document.getElementById("PanelUI-zen-app-launcher")?.hidePopup?.();
      } catch (_) {}

      await setScheme(2);
      out.layout.dark = measureLayout("dark");
      for (const iss of out.layout.dark.issues || []) {
        push("layout", "medium", `Dark theme layout: ${iss.kind}`, iss);
      }
      try {
        if (window.gAstraAppHubBootstrap?.toggle) await window.gAstraAppHubBootstrap.toggle();
        else document.getElementById("zen-app-launcher-button")?.click();
        await sleep(700);
        const darkHub = measureLayout("dark_apphub");
        out.layout.dark_apphub = darkHub;
        for (const iss of darkHub.issues || []) {
          push("layout", "medium", `Dark App Hub layout: ${iss.kind}`, iss);
        }
        document.getElementById("PanelUI-zen-app-launcher")?.hidePopup?.();
      } catch (_) {}
      await setScheme(1);
    } catch (e) {
      out.layout.error = String(e);
    }

    // ---- Settings panels ----
    try {
      const prefTab = gBrowser.addTrustedTab("about:preferences");
      gBrowser.selectedTab = prefTab;
      await sleep(1800);
      let prefBrowser = prefTab.linkedBrowser;
      for (let i = 0; i < 20 && prefBrowser?.currentURI?.spec?.startsWith("about:blank"); i++) {
        await sleep(200);
      }
      const prefDoc = prefBrowser?.contentDocument || null;
      const scanPrefs = (doc, panelName) => {
        if (!doc) return { panelName, zenHits: [], categories: [], error: "no prefDoc" };
        const hits = visibleTextNodes(doc);
        const sampleCats = [...doc.querySelectorAll("*[data-category], .category, #categories > *")]
          .map((el) => (el.textContent || el.getAttribute("title") || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 30);
        return { panelName, zenHits: hits.slice(0, 20), categories: sampleCats };
      };

      const panels = persona.settings_panels || ["general"];
      for (const p of panels) {
        try {
          const win = prefBrowser?.contentWindow;
          if (win?.gotoPref) {
            const map = {
              general: "paneGeneral",
              privacy: "panePrivacy",
              appearance: "paneAstraAppearance",
            };
            try { win.gotoPref(map[p] || p); } catch (_) {
              try { win.gotoPref(p); } catch (__) {}
            }
          }
          const cats = [...(prefDoc?.querySelectorAll("#categories > *, .category") || [])];
          const want = p.toLowerCase();
          const cat = cats.find((c) => {
            const t = ((c.textContent || "") + (c.getAttribute("title") || "")).toLowerCase();
            return (
              t.includes(want) ||
              (want === "appearance" && /appear|theme|look|astra/i.test(t)) ||
              (want === "privacy" && /privacy|security/i.test(t)) ||
              (want === "general" && /general|home/i.test(t))
            );
          });
          if (cat) {
            try { cat.click(); } catch (_) {}
            await sleep(700);
          }
          const scanned = scanPrefs(prefDoc, p);
          out.branding.settings.push(scanned);
          for (const h of scanned.zenHits) {
            push("branding", "high", `Settings (${p}) shows Zen text`, h);
          }
        } catch (e) {
          out.branding.settings.push({ panelName: p, error: String(e) });
        }
      }

      // Import discovery for migrant persona
      if (persona.look_for_import) {
        const bodyText = (prefDoc?.body?.innerText || prefDoc?.documentElement?.innerText || "").slice(0, 20000);
        const hasImport = /import/i.test(bodyText) && /(chrome|bookmarks|passwords|data)/i.test(bodyText);
        // Also probe migration wizard availability in chrome
        let wizardApi = false;
        try {
          const { MigrationUtils } = ChromeUtils.importESModule(
            "resource:///modules/MigrationUtils.sys.mjs"
          );
          wizardApi = typeof MigrationUtils?.showMigrationWizard === "function";
        } catch (_) {
          try {
            wizardApi = typeof MigrationUtils !== "undefined";
          } catch (__) {}
        }
        out.feature.importUI = {
          hasImportKeyword: /import/i.test(bodyText),
          hasChromeOrData: /(chrome|bookmarks|passwords|browsing data)/i.test(bodyText),
          ok: hasImport || wizardApi,
          wizardApi,
          sample: bodyText.replace(/\s+/g, " ").match(/.{0,40}import.{0,60}/i)?.[0] || null,
        };
        if (!out.feature.importUI.ok) {
          push(
            "ux",
            "high",
            "Chrome migrant cannot find Import UI in Settings",
            out.feature.importUI
          );
        }
      }
    } catch (e) {
      out.steps.settingsError = String(e);
    }

    // ---- About Astra ----
    try {
      openAboutDialog();
      let aboutWin = null;
      for (let i = 0; i < 40; i++) {
        const wins = [...Services.wm.getEnumerator("Browser:About")];
        if (wins.length) {
          aboutWin = wins[0];
          break;
        }
        await sleep(200);
      }
      if (aboutWin) {
        const doc = aboutWin.document;
        const text = (doc.documentElement?.innerText || "").replace(/\s+/g, " ").trim();
        const zenHits = visibleTextNodes(doc);
        let wordmark = null;
        try {
          const resp = await fetch("chrome://branding/content/about-wordmark.svg", { cache: "reload" });
          const svg = await resp.text();
          wordmark = {
            hasAstraBrowser: /Astra Browser/.test(svg),
            hasZenPath: /M9\.9986/.test(svg),
            hasZenText: /\bZen\b/.test(svg),
          };
        } catch (e) {
          wordmark = { error: String(e) };
        }
        out.branding.about = {
          open: true,
          title: doc.title || null,
          textSample: text.slice(0, 300),
          hasAstra: /Astra/i.test(text),
          hasZen: /\bZen\b/.test(text),
          zenHits: zenHits.slice(0, 15),
          wordmark,
        };
        if (out.branding.about.hasZen || zenHits.length) {
          push("branding", "high", "About dialog shows Zen", {
            title: doc.title,
            hits: zenHits.slice(0, 8),
          });
        }
        if (wordmark && wordmark.hasZenText) {
          push("branding", "high", "About wordmark SVG still contains Zen text", wordmark);
        }
        if (wordmark && !wordmark.hasAstraBrowser) {
          push("branding", "high", "About wordmark missing 'Astra Browser'", wordmark);
        }
        try { aboutWin.close(); } catch (_) {}
      } else {
        out.branding.about = { open: false };
        push("ux", "medium", "About dialog did not open", {});
      }
    } catch (e) {
      out.branding.about = { error: String(e) };
    }

    // ---- Chrome-wide visible Zen scan (main window) ----
    out.branding.chromeHits = visibleTextNodes(document).slice(0, 40);
    for (const h of out.branding.chromeHits) {
      // Filter internal/dev-only class names that aren't user-visible labels if text is empty — already text-based
      push("branding", "high", "Visible chrome UI still says Zen", h);
    }

    out.branding.consoleHits = (window.__astraSimUserConsole || []).slice(0, 30);
    for (const h of out.branding.consoleHits) {
      // Only flag if it looks user-facing (toast-like) — still record; severity medium for console
      push("branding", "medium", "Console message mentions Zen during normal use", h);
    }

    // Dedup findings titles lightly inside persona
    const seen = new Set();
    out.findings = findings.filter((f) => {
      const k = f.category + "|" + f.title + "|" + JSON.stringify(f.detail).slice(0, 80);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    out.ok = true;
    done(out);
  } catch (e) {
    out.ok = false;
    out.error = String(e);
    out.stack = e && e.stack;
    out.findings = findings;
    done(out);
  }
})().catch((e) => done({ ok: false, error: String(e), stack: e && e.stack }));
"""


def run_persona(
    persona: dict[str, Any],
    exe: Path,
    port: int,
    keep_profile: bool = False,
) -> dict[str, Any]:
    profile = DIAG / f"profile-{persona['id']}"
    result_path = OUT_DIR / f"{persona['id']}.json"
    kill_astra()
    if profile.exists():
        shutil.rmtree(profile, ignore_errors=True)
    write_user_js(profile, port, persona)

    proc = subprocess.Popen(
        [
            str(exe),
            "-marionette",
            "-remote-allow-system-access",
            "-no-remote",
            "-profile",
            str(profile),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    meta: dict[str, Any] = {
        "persona_id": persona["id"],
        "started": time.time(),
        "exe": str(exe),
        "port": port,
        "profile": str(profile),
    }
    try:
        if not wait_port(port, 120):
            raise RuntimeError(f"Marionette port {port} did not open")
        client = MarionetteClient(port)
        client.new_session()
        for _ in range(90):
            if client.ex("return !!window.gBrowser;"):
                break
            time.sleep(0.5)
        # Pass persona as arg — Marionette ExecuteAsyncScript uses arguments[0]=callback when
        # using WebDriver classic; with our raw client we put callback as arguments[0] in script
        # and need to pass persona as args[0] which becomes arguments[0] IF callback is last.
        # Our SESSION_JS expects: arguments[0]=done, arguments[1]=persona.
        # WebDriver:ExecuteAsyncScript appends callback as last arg. So we pass persona in args.
        result = client.req(
            "WebDriver:ExecuteAsyncScript",
            {
                "script": SESSION_JS,
                "args": [persona],
                "sandbox": "chrome",
                "newSandbox": True,
            },
            420,
        )
        if isinstance(result, dict) and set(result.keys()) == {"value"}:
            result = result["value"]
        meta["finished"] = time.time()
        meta["duration_s"] = round(meta["finished"] - meta["started"], 1)
        payload = {"meta": meta, "result": result}
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return payload
    except Exception as e:
        meta["error"] = str(e)
        payload = {"meta": meta, "result": {"ok": False, "error": str(e), "findings": []}}
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return payload
    finally:
        try:
            proc.terminate()
        except Exception:
            pass
        kill_astra()
        if not keep_profile and profile.exists():
            # keep prefs evidence lightly — actually remove for disk; results JSON has findings
            shutil.rmtree(profile, ignore_errors=True)


def consolidate(all_payloads: list[dict[str, Any]]) -> dict[str, Any]:
    buckets = {
        "branding": [],
        "layout": [],
        "ux": [],
    }
    # Dedupe key -> item
    index: dict[str, dict[str, Any]] = {}

    for payload in all_payloads:
        result = payload.get("result") or {}
        persona_id = (result.get("persona") or {}).get("id") or payload.get("meta", {}).get(
            "persona_id"
        )
        for f in result.get("findings") or []:
            cat = f.get("category") or "ux"
            if cat not in buckets:
                cat = "ux"
            # Normalize title for dedupe
            title = f.get("title") or "untitled"
            # Collapse chrome Zen hits that share same id/text
            detail = f.get("detail") or {}
            if isinstance(detail, dict):
                norm_detail = detail.get("text") or detail.get("kind") or json.dumps(detail, sort_keys=True)[:120]
            else:
                norm_detail = str(detail)[:120]
            key = f"{cat}::{re.sub(r'\\s+', ' ', title).strip()}::{norm_detail}"
            if key not in index:
                item = {
                    "category": cat,
                    "title": title,
                    "severity": f.get("severity") or "medium",
                    "personas": [persona_id] if persona_id else [],
                    "detail": detail,
                    "root_cause": None,  # filled later by tracer
                }
                index[key] = item
                buckets[cat].append(item)
            else:
                if persona_id and persona_id not in index[key]["personas"]:
                    index[key]["personas"].append(persona_id)
                # escalate severity if any high
                if f.get("severity") == "high":
                    index[key]["severity"] = "high"

    severity_rank = {"high": 0, "medium": 1, "low": 2}
    for cat in buckets:
        buckets[cat].sort(key=lambda x: (severity_rank.get(x["severity"], 9), x["title"]))

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "persona_count": len(all_payloads),
        "counts": {k: len(v) for k, v in buckets.items()},
        "branding_leftovers": buckets["branding"],
        "css_layout_alignment": buckets["layout"],
        "ux_functional_friction": buckets["ux"],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Simulated-user QA for Astra via Marionette")
    ap.add_argument("--exe", type=Path, default=DEFAULT_EXE)
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--persona", action="append", help="Run only this persona id (repeatable)")
    ap.add_argument("--keep-profiles", action="store_true")
    ap.add_argument("--skip-run", action="store_true", help="Only consolidate existing result JSON")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    DIAG.mkdir(parents=True, exist_ok=True)

    selected = PERSONAS
    if args.persona:
        wanted = set(args.persona)
        selected = [p for p in PERSONAS if p["id"] in wanted]
        missing = wanted - {p["id"] for p in selected}
        if missing:
            print("Unknown personas:", ", ".join(sorted(missing)), file=sys.stderr)
            return 2

    if not args.exe.exists():
        print(f"Astra binary not found: {args.exe}", file=sys.stderr)
        return 2

    payloads: list[dict[str, Any]] = []
    if args.skip_run:
        for p in selected:
            path = OUT_DIR / f"{p['id']}.json"
            if path.exists():
                payloads.append(json.loads(path.read_text(encoding="utf-8")))
    else:
        print(f"EXE={args.exe}")
        print(f"Running {len(selected)} persona(s) on port {args.port}...")
        for i, persona in enumerate(selected):
            print(f"\n=== [{i+1}/{len(selected)}] {persona['name']} ({persona['id']}) ===")
            payload = run_persona(persona, args.exe, args.port, keep_profile=args.keep_profiles)
            payloads.append(payload)
            result = payload.get("result") or {}
            nfind = len(result.get("findings") or [])
            print(
                f"  ok={result.get('ok')} findings={nfind} "
                f"duration={payload.get('meta', {}).get('duration_s')}s"
            )
            for f in (result.get("findings") or [])[:8]:
                print(f"    - [{f.get('severity')}/{f.get('category')}] {f.get('title')}")

    report = consolidate(payloads)
    report_path = OUT_DIR / "consolidated_report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n===== CONSOLIDATED =====")
    print(json.dumps(report["counts"], indent=2))
    print(f"WROTE {report_path}")
    for section in ("branding_leftovers", "css_layout_alignment", "ux_functional_friction"):
        items = report[section]
        print(f"\n## {section} ({len(items)})")
        for it in items[:25]:
            print(
                f"  [{it['severity']}] {it['title']} "
                f"— personas={','.join(it['personas'] or [])}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
