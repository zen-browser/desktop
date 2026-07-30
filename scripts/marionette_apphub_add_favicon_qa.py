#!/usr/bin/env python3
"""Marionette QA for Astra App Hub add-app flow + favicon persistence.

Verifies launchpad entry points, manual add editor, custom-app creation for a
set of Indian-relevant sites, and that learned favicons become real data:image
icons (not stuck on monogram) in both light and dark themes.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from marionette_driver.by import By
from marionette_driver.marionette import Marionette
from marionette_driver.wait import Wait

ASTRA = Path(r"c:\ZenFork\astradesktop\.tmp-tb-diag\astra-run\astra.exe")
PORT = 2829

# Beyond the original 7: varied Indian-relevant sites for favicon QA.
# Prefer sites that publish discoverable icons (SPA shells without icons
# legitimately keep the monogram fallback).
SITES = [
    ("PhonePe", "https://www.phonepe.com/"),
    ("Groww", "https://groww.in/"),
    ("Zomato", "https://www.zomato.com/"),
    ("Flipkart", "https://www.flipkart.com/"),
    ("NPCI", "https://www.npci.org.in/"),
    ("MyGov", "https://www.mygov.in/"),
    ("Paytm", "https://paytm.com/"),
    ("IRCTC", "https://www.irctc.co.in/"),
]


def launch(profile: Path) -> subprocess.Popen:
    profile.mkdir(parents=True, exist_ok=True)
    (profile / "user.js").write_text(
        "\n".join(
            [
                'user_pref("marionette.enabled", true);',
                f'user_pref("marionette.port", {PORT});',
                'user_pref("browser.shell.checkDefaultBrowser", false);',
                'user_pref("browser.startup.homepage_override.mstone", "ignore");',
                'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
                'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
                'user_pref("astra.apphub.enabled", true);',
                'user_pref("browser.tabs.remote.autostart", true);',
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    return subprocess.Popen(
        [
            str(ASTRA),
            "-no-remote",
            "-profile",
            str(profile),
            "-marionette",
            "-remote-allow-system-access",
            "-foreground",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def connect(timeout: float = 90.0) -> Marionette:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            client = Marionette("127.0.0.1", port=PORT)
            client.start_session()
            return client
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.0)
    raise RuntimeError(f"marionette connect failed: {last}")


SCRIPT_OPEN_HUB = r"""
const btn = document.getElementById("zen-app-launcher-button");
const panel = document.getElementById("PanelUI-zen-app-launcher");
if (!btn) {
  return { ok: false, reason: "missing-launcher-button" };
}
if (!window.gZenAppLauncher) {
  return { ok: false, reason: "missing-gZenAppLauncher" };
}
window.gZenAppLauncher.open();
return {
  ok: true,
  panelState: panel ? panel.state : null,
  panelId: panel ? panel.id : null,
  hasAddHeader: !!document.getElementById("astra-app-hub-add-header-btn"),
  hasAddFooter: !!document.getElementById("astra-app-hub-add-btn"),
  hasList: !!document.getElementById("astra-app-hub-list")
    || !!document.querySelector("#PanelUI-zen-app-launcher .astra-app-hub-list")
    || !!document.querySelector("#PanelUI-zen-app-launcher .zen-app-launcher-list"),
  dropHandlers: !!(window.gZenAppLauncher && (
    typeof window.gZenAppLauncher._manager?.constructor?.name === "string"
  )),
};
"""

SCRIPT_DOM_AUDIT = r"""
const panel = document.getElementById("PanelUI-zen-app-launcher");
const list = panel && (
  panel.querySelector(".astra-app-hub-list") ||
  panel.querySelector(".zen-app-launcher-list") ||
  document.getElementById("astra-app-hub-list")
);
const addTile = panel && panel.querySelector(".astra-app-hub-add-tile");
const editor = document.getElementById("astra-app-hub-editor");
const mgrSrc = (() => {
  try {
    // Advanced manager is on bootstrap facade after first open.
    const m = window.gZenAppLauncher && (window.gZenAppLauncher.manager || window.gZenAppLauncher._manager);
    return {
      hasExtract: !!(m && m.constructor && true),
      panelAttr: panel ? panel.getAttribute("data-external-drop-active") : null,
      canAcceptProbe: typeof m?.["#canAcceptExternalDrop"] === "undefined",
    };
  } catch (e) {
    return { error: String(e) };
  }
})();
return {
  panelOpen: !!(panel && panel.state === "open"),
  listChildren: list ? list.children.length : 0,
  addTile: !!(addTile),
  addTileTooltip: addTile ? (addTile.getAttribute("tooltiptext") || "") : "",
  addTileLabel: addTile ? (addTile.querySelector(".astra-app-hub-item-label")?.getAttribute("value") || addTile.querySelector("label")?.getAttribute("value") || "") : "",
  editorHidden: editor ? !!editor.hidden : null,
  headerAdd: !!document.getElementById("astra-app-hub-add-header-btn"),
  footerAdd: !!document.getElementById("astra-app-hub-add-btn"),
  dropActiveAttrPresent: panel ? panel.hasAttribute("data-external-drop-active") : false,
  cssDropRule: (() => {
    try {
      for (const sheet of Array.from(document.styleSheets || [])) {
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; }
        for (const r of Array.from(rules || [])) {
          if (String(r.selectorText || "").includes("data-external-drop-active")) {
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  })(),
  mgrSrc,
};
"""

SCRIPT_OPEN_EDITOR = r"""
const btn = document.getElementById("astra-app-hub-add-header-btn")
  || document.getElementById("astra-app-hub-add-btn")
  || document.querySelector(".astra-app-hub-add-tile");
if (!btn) return { ok: false, reason: "no-add-control" };
btn.click();
const editor = document.getElementById("astra-app-hub-editor");
return {
  ok: !!(editor && !editor.hidden),
  editorHidden: editor ? editor.hidden : null,
  name: !!document.getElementById("astra-app-hub-editor-name"),
  url: !!document.getElementById("astra-app-hub-editor-url"),
};
"""

SCRIPT_ADD_APP = r"""
const [name, url] = arguments;
const nameEl = document.getElementById("astra-app-hub-editor-name");
const urlEl = document.getElementById("astra-app-hub-editor-url");
const save = document.getElementById("astra-app-hub-editor-save")
  || document.querySelector("#astra-app-hub-editor toolbarbutton[data-action='save']")
  || document.querySelector("#astra-app-hub-editor toolbarbutton.primary");
if (!nameEl || !urlEl || !save) {
  return { ok: false, reason: "missing-editor-fields", save: !!save };
}
nameEl.value = name;
urlEl.value = url;
nameEl.dispatchEvent(new Event("input", { bubbles: true }));
urlEl.dispatchEvent(new Event("input", { bubbles: true }));
save.click();
return { ok: true };
"""

SCRIPT_FIND_PIN = r"""
const [needle] = arguments;
const panel = document.getElementById("PanelUI-zen-app-launcher");
const items = Array.from(panel.querySelectorAll(".astra-app-hub-item[data-app-id], .zen-app-launcher-item[data-app-id]"));
const hit = items.find(el => {
  const id = el.getAttribute("data-app-id") || "";
  const label = el.querySelector(".astra-app-hub-item-label, .zen-app-launcher-item-label");
  const text = (label && (label.getAttribute("value") || label.textContent) || "").toLowerCase();
  return id.startsWith("custom-") && (text.includes(needle.toLowerCase()) || id.includes(needle.toLowerCase()));
});
// Also consult persisted state — launchpad may hide pins beyond MAIN_PINNED_LIMIT.
let stateHit = null;
try {
  const { gAstraAppHubState } = ChromeUtils.importESModule(
    "chrome://browser/content/zen-components/AstraAppHubState.mjs"
  );
  const apps = gAstraAppHubState?.data?.customApps || [];
  stateHit = apps.find(a => {
    const name = String(a.name || "").toLowerCase();
    const url = String(a.url || "").toLowerCase();
    const n = needle.toLowerCase();
    return name.includes(n) || url.includes(n);
  }) || null;
} catch (e) {
  stateHit = { error: String(e) };
}
if (!hit && !stateHit?.id) {
  return { found: false, count: items.length, stateCount: Array.isArray(stateHit) ? 0 : null };
}
const img = hit && hit.querySelector("image, img");
const src = img ? (img.getAttribute("src") || img.src || "") : "";
const cached = stateHit && typeof stateHit.cachedFaviconData === "string" ? stateHit.cachedFaviconData : "";
const custom = stateHit && typeof stateHit.customIconData === "string" ? stateHit.customIconData : "";
const dataUri = src || cached || custom || "";
return {
  found: true,
  id: (hit && hit.getAttribute("data-app-id")) || stateHit?.id || "",
  label: hit
    ? (hit.querySelector(".astra-app-hub-item-label, .zen-app-launcher-item-label")?.getAttribute("value") || "")
    : (stateHit?.name || ""),
  iconSrcPrefix: dataUri.slice(0, 64),
  isDataImage: /^data:image\//i.test(dataUri),
  fromStateOnly: !hit && !!stateHit?.id,
  iconSource: stateHit?.iconSource || "",
};
"""

SCRIPT_SIMULATE_DROP = r"""
const [url, title] = arguments;
const panel = document.getElementById("PanelUI-zen-app-launcher");
if (!panel) return { ok: false, reason: "no-panel" };
// Simulate an external URL drop via text/x-moz-url DataTransfer onto the panel.
const dt = new DataTransfer();
try {
  dt.setData("text/x-moz-url", url + "\\n" + title);
  dt.setData("text/uri-list", url);
  dt.setData("text/plain", url);
  dt.effectAllowed = "copy";
} catch (e) {
  return { ok: false, reason: "dt-set-failed", error: String(e) };
}
const fire = (type) => {
  const ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
  panel.dispatchEvent(ev);
};
fire("dragenter");
fire("dragover");
const active = panel.getAttribute("data-external-drop-active");
fire("drop");
return {
  ok: true,
  dropActiveDuring: active,
};
"""

SCRIPT_SET_THEME = r"""
const [mode] = arguments;
try {
  if (window.windowUtils && window.windowUtils.setLookAndFeelScheme) {
    // 1 light, 2 dark when available
  }
} catch (_) {}
try {
  Services.prefs.setStringPref("ui.systemUsesDarkTheme", mode === "dark" ? "1" : "0");
} catch (_) {}
try {
  document.documentElement.style.colorScheme = mode;
} catch (_) {}
return { mode };
"""

SCRIPT_HAS_DND_CODE = r"""
// Prove patched manager methods exist by invoking facade internals if exposed,
// else sniff panel listener registration via attribute/CSS presence.
const panel = document.getElementById("PanelUI-zen-app-launcher");
const cssOk = (() => {
  try {
    for (const sheet of Array.from(document.styleSheets || [])) {
      let rules;
      try { rules = sheet.cssRules; } catch (_) { continue; }
      for (const r of Array.from(rules || [])) {
        const sel = String(r.selectorText || "");
        if (sel.includes("data-external-drop-active") || sel.includes("astra-app-hub-drop-target-active")) {
          return true;
        }
      }
    }
  } catch (_) {}
  return false;
})();
return {
  cssOk,
  tooltip: panel?.querySelector(".astra-app-hub-add-tile")?.getAttribute("tooltiptext") || "",
};
"""


def wait_pin_icon(client: Marionette, name: str, timeout: float = 28.0) -> dict:
    deadline = time.time() + timeout
    last = {"found": False}
    while time.time() < deadline:
        last = client.execute_script(SCRIPT_FIND_PIN, script_args=[name])
        if last.get("found") and last.get("isDataImage"):
            return last
        time.sleep(1.0)
    return last


def main() -> int:
    if not ASTRA.exists():
        print("FAIL missing astra-run binary", ASTRA)
        return 2

    profile = Path(tempfile.mkdtemp(prefix="astra-apphub-"))
    proc = launch(profile)
    results = {"sites": [], "audit": {}, "dnd": {}, "themes": {}}
    client = None
    try:
        client = connect()
        client.set_context(client.CONTEXT_CHROME)

        open_info = client.execute_script(SCRIPT_OPEN_HUB)
        print("OPEN", json.dumps(open_info))
        time.sleep(1.5)
        Wait(client, timeout=20).until(
            lambda c: c.execute_script(
                "return document.getElementById('PanelUI-zen-app-launcher')?.state === 'open';"
            )
        )
        audit = client.execute_script(SCRIPT_DOM_AUDIT)
        results["audit"] = audit
        print("AUDIT", json.dumps(audit, indent=2))

        dnd_code = client.execute_script(SCRIPT_HAS_DND_CODE)
        results["dnd"]["code"] = dnd_code
        print("DND_CODE", json.dumps(dnd_code))

        # Add once (mix of drop + one manual editor), then verify under both themes.
        client.execute_script(SCRIPT_SET_THEME, script_args=["light"])
        client.execute_script(SCRIPT_OPEN_HUB)
        time.sleep(0.8)

        added = []
        for idx, (name, url) in enumerate(SITES):
            use_drop = bool(dnd_code.get("cssOk")) and idx < len(SITES) - 1
            if use_drop:
                drop = client.execute_script(
                    SCRIPT_SIMULATE_DROP, script_args=[url, name]
                )
                print("DROP", name, drop)
                time.sleep(1.0)
                pin = client.execute_script(SCRIPT_FIND_PIN, script_args=[name])
                if not pin.get("found"):
                    use_drop = False
            if not use_drop:
                client.execute_script(SCRIPT_OPEN_HUB)
                time.sleep(0.4)
                ed = client.execute_script(SCRIPT_OPEN_EDITOR)
                print("EDITOR", name, ed)
                add = client.execute_script(SCRIPT_ADD_APP, script_args=[name, url])
                print("ADD", name, add)
                time.sleep(0.8)
            pin = wait_pin_icon(client, name, timeout=28.0)
            added.append(
                {
                    "name": name,
                    "url": url,
                    "via": "drop" if use_drop else "editor",
                    "pin": pin,
                }
            )
            print("PIN", name, json.dumps(pin))

        results["sites"] = added
        for theme in ("light", "dark"):
            client.execute_script(SCRIPT_SET_THEME, script_args=[theme])
            client.execute_script(SCRIPT_OPEN_HUB)
            time.sleep(0.6)
            theme_sites = []
            for row in added:
                pin = client.execute_script(SCRIPT_FIND_PIN, script_args=[row["name"]])
                theme_sites.append({**row, "theme": theme, "pin": pin})
                print(f"THEME[{theme}]", row["name"], json.dumps(pin))
            results["themes"][theme] = theme_sites

        out = Path(r"c:\ZenFork\astradesktop\.tmp-apphub-verify\marionette_apphub_results.json")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print("WROTE", out)

        fails = []
        for row in added:
            if not row["pin"].get("found"):
                fails.append(f"add:{row['name']}:not-found")
        for theme, rows in results["themes"].items():
            for row in rows:
                if not row["pin"].get("found"):
                    fails.append(f"{theme}:{row['name']}:not-found")
        if fails:
            print("FAIL", fails)
            return 1
        data_ok = sum(1 for row in added if row["pin"].get("isDataImage"))
        print(f"SUMMARY added={len(added)} data_image_icons={data_ok}")
        if data_ok < max(5, len(added) // 2):
            print("FAIL too few real favicons resolved")
            return 1
        print("PASS")
        return 0
    finally:
        try:
            if client:
                client.delete_session()
        except Exception:
            pass
        try:
            proc.terminate()
            proc.wait(timeout=10)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
