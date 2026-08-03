#!/usr/bin/env python3
"""Marionette verification: compact mode toolbar must not collide with page content."""

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
PORT = 2833
OUT = ROOT / ".tmp-content-scheme" / "compact-toolbar-overlay-results.json"

MEASURE_JS = r"""
function rect(sel) {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    sel: typeof sel === 'string' ? sel : el.id,
    x: Math.round(r.x * 10) / 10,
    y: Math.round(r.y * 10) / 10,
    w: Math.round(r.width * 10) / 10,
    h: Math.round(r.height * 10) / 10,
    opacity: cs.opacity,
    visibility: cs.visibility,
    pointerEvents: cs.pointerEvents,
    zIndex: cs.zIndex,
    position: cs.position,
  };
}
function visibleButtons() {
  const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
  if (!wrap) return [];
  return [...wrap.querySelectorAll('toolbarbutton, .toolbarbutton-1, #nav-bar > *')].map(btn => {
    const r = btn.getBoundingClientRect();
    const cs = getComputedStyle(btn);
    const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
    return visible ? { id: btn.id || btn.className.slice(0,40), x: r.x, y: r.y, w: r.width, h: r.height, opacity: cs.opacity } : null;
  }).filter(Boolean);
}
return {
  compact: document.documentElement.getAttribute('zen-compact-mode'),
  singleToolbar: document.documentElement.getAttribute('zen-single-toolbar'),
  navbar: rect('#zen-appcontent-navbar-wrapper'),
  container: rect('#zen-appcontent-navbar-container'),
  contentTop: rect('#tabbrowser-tabpanels'),
  visibleButtons: visibleButtons(),
  hasHover: document.getElementById('zen-appcontent-navbar-wrapper')?.hasAttribute('zen-has-hover') || false,
};
"""

PAGE_OVERLAP_JS = r"""
const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
const container = document.getElementById('zen-appcontent-navbar-container');
const containerCs = container ? getComputedStyle(container) : null;
const containerVisible = containerCs && containerCs.visibility !== 'hidden' && parseFloat(containerCs.opacity) > 0.05;
const buttons = containerVisible ? [...wrap.querySelectorAll('toolbarbutton, .toolbarbutton-1')].filter(btn => {
  const r = btn.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
}) : [];
const contentY = document.getElementById('tabbrowser-tabpanels').getBoundingClientRect().y;
const collisions = buttons.filter(btn => btn.getBoundingClientRect().y < contentY + 40);
return {
  contentTop: contentY,
  buttonCount: buttons.length,
  collisionCount: collisions.length,
  navbarHover: wrap?.hasAttribute('zen-has-hover') || false,
  navbarH: wrap?.getBoundingClientRect().height || 0,
  containerVisible,
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

    def exa(self, script, args=None, timeout=120):
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
            {"script": wrapped, "args": args or [], "sandbox": "chrome", "newSandbox": True},
            timeout=timeout,
        )
        val = r.get("value", r)
        if isinstance(val, dict) and val.get("error"):
            raise RuntimeError(val["error"])
        return val

    def navigate(self, url: str, timeout=60000):
        self.ex(
            f"""
            const uri = Services.io.newURI({json.dumps(url)});
            gBrowser.loadURI(uri, {{ triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }});
            return true;
            """,
            timeout=timeout,
        )
        time.sleep(4.0)


def kill():
    subprocess.run(
        [
            "powershell", "-NoProfile", "-Command",
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
    d = Path(tempfile.mkdtemp(prefix="astra-overlay-"))
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
        [str(EXE), "-marionette", "-remote-allow-system-access", "-no-remote",
         "-profile", str(profile), f"-marionette-port={port}", "-foreground"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def hover_top(m: M):
    m.ex(r"""
    const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
    const y = 2;
    const x = window.innerWidth / 2;
    ['pointermove','mousemove','mouseover'].forEach(type => {
      window.dispatchEvent(new MouseEvent(type, {clientX: x, clientY: y, bubbles: true, cancelable: true}));
      wrap?.dispatchEvent(new MouseEvent(type, {clientX: x, clientY: y, bubbles: true, cancelable: true}));
    });
    return wrap?.hasAttribute('zen-has-hover') || false;
    """)
    time.sleep(1.2)


def run() -> dict:
    results = {"cases": [], "pass": True}
    layouts = [
        ("only_sidebar", True, True),
        ("sidebar_top", False, True),
        ("collapsed", False, False),
    ]
    sites = [
        ("youtube", "https://www.youtube.com/"),
        ("wikipedia", "https://en.wikipedia.org/wiki/Main_Page"),
        ("bbc", "https://www.bbc.com/news"),
    ]
    for layout, single, expanded in layouts:
        for theme_name, scheme in [("light", 0), ("dark", 1)]:
            kill()
            prof = write_profile({
                "marionette.enabled": True,
                "marionette.port": PORT,
                "zen.welcome-screen.seen": True,
                "zen.view.use-single-toolbar": single,
                "zen.view.sidebar-expanded": expanded,
                "zen.view.window.scheme": scheme,
                "zen.view.compact.hide-tabbar": False,
                "zen.view.compact.hide-toolbar": True,
            })
            launch(prof, PORT)
            if not wait_port(PORT):
                raise RuntimeError("marionette port timeout")
            m = M(PORT)
            m.start()
            m.ex(f"""
              Services.prefs.setBoolPref('zen.view.use-single-toolbar', {'true' if single else 'false'});
              Services.prefs.setBoolPref('zen.view.sidebar-expanded', {'true' if expanded else 'false'});
              gZenVerticalTabsManager._updateEvent();
              gZenCompactModeManager.preference = true;
              return true;
            """)
            time.sleep(1.2)
            at_rest = m.ex(MEASURE_JS)
            for site_name, url in sites:
                m.ex("""
                  const w = document.getElementById('zen-appcontent-navbar-wrapper');
                  if (w) gZenCompactModeManager._setElementExpandAttribute(w, false);
                  return true;
                """)
                time.sleep(0.5)
                m.navigate(url)
                page = m.ex(PAGE_OVERLAP_JS)
                hover_top(m)
                on_hover = m.ex(MEASURE_JS)
                hover_page = m.ex(PAGE_OVERLAP_JS)
                case = {
                    "layout": layout,
                    "theme": theme_name,
                    "site": site_name,
                    "at_rest_buttons": len(at_rest.get("visibleButtons") or []),
                    "at_rest_collisions": page.get("collisionCount", -1),
                    "container_hidden_at_rest": page.get("containerVisible") is False,
                    "hover_revealed": on_hover.get("hasHover"),
                    "hover_buttons": len(on_hover.get("visibleButtons") or []),
                    "hover_usable": (on_hover.get("hasHover") and len(on_hover.get("visibleButtons") or []) > 0),
                }
                # Only Sidebar may keep 3 window controls visible — not toolbar collision.
                if layout == "only_sidebar":
                    if case["at_rest_buttons"] > 3:
                        results["pass"] = False
                elif case["at_rest_buttons"] > 0 or not case["container_hidden_at_rest"]:
                    results["pass"] = False
                if not case["hover_usable"]:
                    results["pass"] = False
                results["cases"].append(case)
            m.req("WebDriver:DeleteSession")
            shutil.rmtree(prof, ignore_errors=True)
    return results


def main():
    kill()
    results = run()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
