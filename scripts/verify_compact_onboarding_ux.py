#!/usr/bin/env python3
"""Marionette verification for compact mode UX (Parts A/B) and onboarding (Part C)."""

from __future__ import annotations

import json
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(r"c:\ZenFork\astradesktop")
EXE = ROOT / ".tmp-content-scheme" / "astra-run" / "astra.exe"
PORT = 2832
OUT = ROOT / ".tmp-content-scheme" / "compact-onboarding-ux-results.json"

MEASURE_JS = r"""
function rect(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    id,
    x: Math.round(r.x * 10) / 10,
    y: Math.round(r.y * 10) / 10,
    w: Math.round(r.width * 10) / 10,
    h: Math.round(r.height * 10) / 10,
    opacity: cs.opacity,
    display: cs.display,
  };
}
function contentTop() {
  const panel = document.getElementById('tabbrowser-tabpanels');
  return panel ? Math.round(panel.getBoundingClientRect().y * 10) / 10 : null;
}
return {
  compact: document.documentElement.getAttribute('zen-compact-mode'),
  autohide: document.documentElement.getAttribute('zen-compact-autohide-sidebar'),
  singleToolbar: document.documentElement.getAttribute('zen-single-toolbar'),
  sidebarExpanded: document.documentElement.getAttribute('zen-sidebar-expanded'),
  navbar: rect('zen-appcontent-navbar-wrapper'),
  toolbox: rect('navigator-toolbox'),
  contentTop: contentTop(),
  sidebarHover: document.getElementById('navigator-toolbox')?.hasAttribute('zen-has-hover') || false,
};
"""


class M:
    def __init__(self, port: int):
        self.port = port
        self.sock = socket.create_connection(("127.0.0.1", port), timeout=30)
        self._read()
        self._id = 0

    def _read(self, timeout=120):
        self.sock.settimeout(timeout)
        buf = b""
        while b":" not in buf:
            chunk = self.sock.recv(1)
            if not chunk:
                raise RuntimeError("socket closed")
            buf += chunk
        length = int(buf.split(b":", 1)[0])
        rest = buf.split(b":", 1)[1]
        while len(rest) < length:
            rest += self.sock.recv(length - len(rest))
        return json.loads(rest.decode("utf-8"))

    def req(self, name, params=None, timeout=120):
        self._id += 1
        payload = json.dumps([0, self._id, name, params or {}]).encode("utf-8")
        self.sock.sendall(f"{len(payload)}:".encode("ascii") + payload)
        resp = self._read(timeout=timeout)
        if resp[2]:
            raise RuntimeError(f"{name}: {resp[2]}")
        return resp[3]

    def start(self):
        self.req("WebDriver:NewSession", {"capabilities": {}}, timeout=180)
        self.req("Marionette:SetContext", {"value": "chrome"})

    def ex(self, script, timeout=90):
        r = self.req(
            "WebDriver:ExecuteScript",
            {"script": script, "args": [], "sandbox": "chrome", "newSandbox": True},
            timeout=timeout,
        )
        return r.get("value", r)

    def exa(self, script, timeout=120):
        wrapped = (
            "(() => {"
            "const done = arguments[arguments.length - 1];"
            "(async () => {"
            "try { done(await (" + script + ")); }"
            "catch (e) { done({error: String(e), stack: e?.stack}); }"
            "})();"
            "})()"
        )
        r = self.req(
            "WebDriver:ExecuteAsyncScript",
            {"script": wrapped, "args": [], "sandbox": "chrome", "newSandbox": True},
            timeout=timeout,
        )
        val = r.get("value", r)
        if isinstance(val, dict) and val.get("error"):
            raise RuntimeError(val["error"])
        return val


def kill():
    subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-Command",
            "Get-Process astra,plugin-container,firefox -ErrorAction SilentlyContinue | Stop-Process -Force",
        ],
        check=False,
    )
    time.sleep(2)


def wait_port(port: int, seconds=90) -> bool:
    for _ in range(seconds):
        try:
            s = socket.create_connection(("127.0.0.1", port), timeout=2)
            s.close()
            return True
        except OSError:
            time.sleep(1)
    return False


def write_profile(prefs: dict[str, object]) -> Path:
    d = Path(tempfile.mkdtemp(prefix="astra-ux-"))
    lines = []
    for k, v in prefs.items():
        if isinstance(v, bool):
            lines.append(f'user_pref("{k}", {str(v).lower()});')
        elif isinstance(v, int):
            lines.append(f'user_pref("{k}", {v});')
        else:
            lines.append(f'user_pref("{k}", "{v}");')
    (d / "user.js").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return d


def launch(profile: Path, port: int):
    subprocess.Popen(
        [
            str(EXE),
            "-marionette",
            "-remote-allow-system-access",
            "-no-remote",
            "-profile",
            str(profile),
            f"-marionette-port={port}",
            "-foreground",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def set_layout(m: M, *, single: bool, expanded: bool):
    m.ex(
        f"""
        Services.prefs.setBoolPref('zen.view.use-single-toolbar', {'true' if single else 'false'});
        Services.prefs.setBoolPref('zen.view.sidebar-expanded', {'true' if expanded else 'false'});
        gZenVerticalTabsManager._updateEvent();
        return true;
        """
    )
    time.sleep(0.8)


def set_compact(m: M, on: bool):
    m.ex(
        f"""
        gZenCompactModeManager.preference = {'true' if on else 'false'};
        return document.documentElement.getAttribute('zen-compact-mode');
        """
    )
    time.sleep(1.0)


def set_theme(m: M, scheme: int):
    m.ex(
        f"""
        Services.prefs.setIntPref('zen.view.window.scheme', {scheme});
        return true;
        """
    )
    time.sleep(0.5)


def measure(m: M) -> dict:
    return m.ex(MEASURE_JS)


def hover_sidebar_edge(m: M):
    m.ex(
        r"""
        const sidebar = document.getElementById('navigator-toolbox');
        const rect = sidebar.getBoundingClientRect();
        const x = document.documentElement.hasAttribute('zen-right-side') ? window.innerWidth - 2 : 2;
        const y = Math.max(40, rect.top + 80);
        ['mousemove','mouseover'].forEach(type => {
          window.dispatchEvent(new MouseEvent(type, {clientX: x, clientY: y, bubbles: true}));
        });
        sidebar.dispatchEvent(new MouseEvent('mouseover', {clientX: x, clientY: y, bubbles: true}));
        return sidebar.hasAttribute('zen-has-hover');
        """
    )
    time.sleep(1.2)


def run_part_a_b() -> dict:
    results = {"part_a": [], "part_b": []}
    layouts = [
        ("only_sidebar", True, True),
        ("sidebar_top", False, True),
        ("collapsed", False, False),
    ]
    for name, single, expanded in layouts:
        for theme_name, scheme in [("light", 0), ("dark", 1)]:
            kill()
            prof = write_profile(
                {
                    "marionette.enabled": True,
                    "marionette.port": PORT,
                    "zen.welcome-screen.seen": True,
                    "zen.view.use-single-toolbar": single,
                    "zen.view.sidebar-expanded": expanded,
                    "zen.view.window.scheme": scheme,
                    "zen.view.compact.hide-tabbar": False,
                    "zen.view.compact.hide-toolbar": True,
                }
            )
            launch(prof, PORT)
            if not wait_port(PORT):
                raise RuntimeError("marionette port timeout")
            m = M(PORT)
            m.start()
            set_theme(m, scheme)
            set_layout(m, single=single, expanded=expanded)
            before = measure(m)
            set_compact(m, True)
            after = measure(m)
            entry = {
                "layout": name,
                "theme": theme_name,
                "before_compact": before,
                "after_compact": after,
                "navbar_h_le_1": (after.get("navbar") or {}).get("h", 99) <= 1,
            }
            results["part_a"].append(entry)

            if name == "only_sidebar":
                hover = hover_sidebar_edge(m)
                revealed = measure(m)
                autohide = after.get("autohide") == "true"
                sidebar_hidden = (after.get("toolbox") or {}).get("x", 0) < -20 or (
                    (after.get("toolbox") or {}).get("w", 0) > 0
                    and not after.get("sidebarHover")
                )
                results["part_b"].append(
                    {
                        "layout": name,
                        "theme": theme_name,
                        "autohide_attr": autohide,
                        "sidebar_hidden_when_compact": sidebar_hidden,
                        "hover_reveals": hover or revealed.get("sidebarHover"),
                        "after_hover": revealed,
                    }
                )

            # Other layouts must not set autohide attribute
            if name != "only_sidebar":
                results["part_b"].append(
                    {
                        "layout": name,
                        "theme": theme_name,
                        "autohide_attr_false": after.get("autohide") is None,
                    }
                )
            m.req("WebDriver:DeleteSession")
            shutil.rmtree(prof, ignore_errors=True)
    return results


WELCOME_JS = r"""
(async () => {
async function clickL10n(id) {
  const nodes = [...document.querySelectorAll('[data-l10n-id]')];
  const el = nodes.find(n => n.getAttribute('data-l10n-id') === id);
  if (!el) throw new Error('missing ' + id);
  el.click();
  await new Promise(r => setTimeout(r, 400));
}
async function waitTitle(id, ms=15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = document.getElementById('zen-welcome-sidebar-title');
    if (t && t.getAttribute('data-l10n-id') === id) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('timeout ' + id);
}
const out = { steps: [] };
if (!document.getElementById('zen-welcome-start-button')) throw new Error('no welcome');
document.getElementById('zen-welcome-start-button').click();
await new Promise(r => setTimeout(r, 600));
await waitTitle('zen-welcome-browser-title');
out.steps.push('browser_choice');
out.hasChoiceList = !!document.querySelector('.zen-welcome-choice-list');
out.hasImportBtn = !!document.querySelector('.zen-welcome-browser-import-btn');
document.querySelector('input[value="chrome"]').click();
await clickL10n('zen-welcome-continue');
await waitTitle('zen-welcome-ublock-title');
out.chromeLayout = {
  single: Services.prefs.getBoolPref('zen.view.use-single-toolbar'),
  expanded: Services.prefs.getBoolPref('zen.view.sidebar-expanded'),
};
await clickL10n('zen-welcome-back');
await waitTitle('zen-welcome-browser-title');
document.querySelector('input[value="new"]').click();
await clickL10n('zen-welcome-continue');
await waitTitle('zen-welcome-ublock-title');
out.newLayout = {
  single: Services.prefs.getBoolPref('zen.view.use-single-toolbar'),
  expanded: Services.prefs.getBoolPref('zen.view.sidebar-expanded'),
};
return out;
})()
"""


def run_part_c() -> dict:
    out = {"light": None, "dark": None}
    for theme_name, scheme in [("light", 0), ("dark", 1)]:
        kill()
        prof = write_profile(
            {
                "marionette.enabled": True,
                "marionette.port": PORT,
                "zen.welcome-screen.seen": False,
                "zen.view.window.scheme": scheme,
            }
        )
        launch(prof, PORT)
        if not wait_port(PORT):
            raise RuntimeError("welcome marionette timeout")
        m = M(PORT)
        m.start()
        time.sleep(3)
        data = m.exa(WELCOME_JS, timeout=120)
        out[theme_name] = data
        m.req("WebDriver:DeleteSession")
        shutil.rmtree(prof, ignore_errors=True)
    return out


def summarize(results: dict) -> dict:
    part_a_ok = all(x["navbar_h_le_1"] for x in results["part_a"])
    part_b_ok = all(
        (
            x.get("autohide_attr")
            and (x.get("hover_reveals") or x.get("sidebar_hidden_when_compact"))
        )
        if x.get("layout") == "only_sidebar"
        else x.get("autohide_attr_false")
        for x in results["part_b"]
    )
    part_c = results.get("part_c", {})
    light = part_c.get("light") or {}
    dark = part_c.get("dark") or {}
    part_c_ok = (
        light.get("hasChoiceList")
        and light.get("hasImportBtn")
        and light.get("chromeLayout", {}).get("single") is False
        and light.get("newLayout", {}).get("single") is True
        and dark.get("hasChoiceList")
        and dark.get("newLayout", {}).get("single") is True
    )
    return {
        "part_a_pass": part_a_ok,
        "part_b_pass": part_b_ok,
        "part_c_pass": part_c_ok,
    }


def main():
    if not EXE.exists():
        raise SystemExit(f"missing {EXE}; run scripts/patch_omni_compact_ux.py first")
    results = {"part_a": [], "part_b": [], "part_c": {}}
    print("=== Part A/B compact mode ===")
    ab = run_part_a_b()
    results.update(ab)
    print("=== Part C onboarding ===")
    results["part_c"] = run_part_c()
    results["summary"] = summarize(results)
    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("wrote", OUT)
    print(json.dumps(results["summary"], indent=2))
    if not all(results["summary"].values()):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
