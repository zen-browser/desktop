#!/usr/bin/env python3
"""Marionette: responsive UI checks across common viewport sizes."""

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
PORT = 2836
OUT = ROOT / ".tmp-content-scheme" / "responsive-ui-results.json"

SIZES = [
    ("1366x768", 1366, 768),
    ("1920x1080", 1920, 1080),
    ("2560x1440", 2560, 1440),
]

LAYOUT_JS = r"""
function rect(sel) {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    sel: typeof sel === 'string' ? sel : (el.id || el.tagName),
    x: Math.round(r.x), y: Math.round(r.y),
    w: Math.round(r.width), h: Math.round(r.height),
    overflow: cs.overflow, visibility: cs.visibility, opacity: cs.opacity,
  };
}
function clickable(sel, min=20) {
  const el = document.querySelector(sel);
  if (!el) return { sel, present: false };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    sel, present: true,
    w: Math.round(r.width), h: Math.round(r.height),
    ok: r.width >= min && r.height >= min && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05,
  };
}
const win = { innerW: window.innerWidth, innerH: window.innerHeight, dpr: window.devicePixelRatio };
const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
const toolbox = document.getElementById('navigator-toolbox');
const appHub = document.getElementById('PanelUI-zen-app-launcher');
const wrapCs = wrap ? getComputedStyle(wrap) : null;
const issues = [];
// Clip checks: chrome elements should stay within window (with small slack)
for (const el of [wrap, toolbox]) {
  if (!el) continue;
  const r = el.getBoundingClientRect();
  if (r.width > win.innerW + 40) issues.push(el.id + ': wider than window');
  if (r.height > win.innerH + 40) issues.push(el.id + ': taller than window');
}
const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
return {
  win,
  compact: document.documentElement.getAttribute('zen-compact-mode'),
  chromeRevealed: document.documentElement.getAttribute('zen-compact-chrome-revealed'),
  navbar: rect('#zen-appcontent-navbar-wrapper'),
  toolbox: rect('#navigator-toolbox'),
  content: rect('#tabbrowser-tabpanels'),
  // Overlay backdrop now paints on the wrapper itself (not .zen-toolbar-background).
  overlayBg: wrapRect ? {
    w: Math.round(wrapRect.width),
    h: Math.round(wrapRect.height),
    display: wrapCs?.display,
    bg: wrapCs?.backgroundColor,
    border: wrapCs?.borderBottom,
    shadow: wrapCs?.boxShadow,
  } : null,
  buttons: {
    back: clickable('#back-button'),
    forward: clickable('#forward-button'),
    appHub: clickable('#zen-app-launcher-button, #PanelUI-zen-app-launcher-button, toolbarbutton[cuid], #app-launcher-button'),
    compact: clickable('#zen-compact-mode-button, #zen-sidebar-compact-mode-button'),
  },
  appHubOpen: appHub ? { open: appHub.hasAttribute('panelopen') || appHub.state === 'open' || getComputedStyle(appHub).display !== 'none',
    w: Math.round(appHub.getBoundingClientRect().width),
    h: Math.round(appHub.getBoundingClientRect().height) } : null,
  issues,
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
    d = Path(tempfile.mkdtemp(prefix="astra-responsive-"))
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


def resize(m: M, w: int, h: int):
    m.ex(f"""
      window.resizeTo({w}, {h});
      return {{ w: window.outerWidth, h: window.outerHeight, iw: window.innerWidth, ih: window.innerHeight }};
    """)
    time.sleep(0.8)


def run() -> dict:
    results = {"sizes": [], "pass": True, "fixes_needed": []}
    kill()
    prof = write_profile({
        "marionette.enabled": True,
        "marionette.port": PORT,
        "zen.welcome-screen.seen": True,
        "zen.view.use-single-toolbar": False,
        "zen.view.sidebar-expanded": True,
        "zen.view.window.scheme": 0,
        "zen.view.compact.hide-tabbar": True,
        "zen.view.compact.hide-toolbar": True,
    })
    launch(prof, PORT)
    if not wait_port(PORT):
        raise RuntimeError("marionette port timeout")
    m = M(PORT)
    m.start()
    m.ex("""
      Services.prefs.setBoolPref('zen.view.use-single-toolbar', false);
      Services.prefs.setBoolPref('zen.view.sidebar-expanded', true);
      Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
      gZenVerticalTabsManager._updateEvent();
      gZenCompactModeManager.preference = true;
      return true;
    """)
    time.sleep(1.0)

    for name, w, h in SIZES:
        actual = resize(m, w, h)
        # Reveal toolbar overlay for sizing check (unified chrome when available)
        m.ex(r"""
          if (gZenCompactModeManager.usesUnifiedCompactChrome) {
            gZenCompactModeManager._setCompactChromeRevealed(true);
          } else {
            const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
            gZenCompactModeManager._setElementExpandAttribute(wrap, true, 'zen-has-hover');
          }
          return true;
        """)
        time.sleep(0.5)
        layout = m.ex(LAYOUT_JS)
        # Hide again + check sidebar edge
        m.ex(r"""
          if (gZenCompactModeManager.usesUnifiedCompactChrome) {
            gZenCompactModeManager._setCompactChromeRevealed(false, { immediate: true });
            gZenCompactModeManager._pendingEdgePointer = { x: 2, y: Math.round(window.innerHeight/2) };
            gZenCompactModeManager._processUnifiedChromeReveal();
          } else {
            const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
            gZenCompactModeManager._setElementExpandAttribute(wrap, false, 'zen-has-hover');
            gZenCompactModeManager._pendingEdgePointer = { x: 2, y: Math.round(window.innerHeight/2) };
            gZenCompactModeManager._processEdgeReveal();
          }
          return true;
        """)
        time.sleep(0.4)
        sidebar = m.ex(LAYOUT_JS)

        win = layout.get("win") or {}
        overlay = layout.get("overlayBg") or {}
        navbar = layout.get("navbar") or {}
        issues = list(layout.get("issues") or [])

        # Overlay should span near-full width and have reasonable chrome height
        overlay_ok = True
        if overlay:
            if overlay.get("w", 0) < (win.get("innerW", 0) * 0.7):
                issues.append("overlay too narrow vs viewport")
                overlay_ok = False
            h = overlay.get("h", 0) or 0
            if h < 20 or h > 160:
                issues.append(f"overlay height unusual: {h}")
                overlay_ok = False
            bg = overlay.get("bg") or ""
            if "rgba(0, 0, 0, 0)" in bg or bg == "transparent":
                issues.append("overlay background transparent")
                overlay_ok = False
        if navbar.get("h", 0) < 20:
            issues.append("revealed navbar height too small")
            overlay_ok = False

        # Click targets
        btns = layout.get("buttons") or {}
        click_ok = True
        for key, info in btns.items():
            if info.get("present") and not info.get("ok"):
                issues.append(f"{key} too small to click: {info}")
                click_ok = False

        size_ok = overlay_ok and click_ok and not issues
        if not size_ok:
            results["pass"] = False
            results["fixes_needed"].append({"size": name, "issues": issues})

        results["sizes"].append({
            "size": name,
            "requested": {"w": w, "h": h},
            "actual_resize": actual,
            "ok": size_ok,
            "issues": issues,
            "win": win,
            "navbar": navbar,
            "overlayBg": overlay,
            "buttons": btns,
            "sidebar_revealed_w": (sidebar.get("toolbox") or {}).get("w"),
            "dpr": win.get("dpr"),
        })

    # Higher-DPI note: report devicePixelRatio from last size
    results["dpi_note"] = (
        f"devicePixelRatio={results['sizes'][-1]['dpr'] if results['sizes'] else 'n/a'}; "
        "OS-level DPI scaling not forced in Marionette — reported via window.devicePixelRatio."
    )

    m.req("WebDriver:DeleteSession")
    shutil.rmtree(prof, ignore_errors=True)
    return results


def main():
    if not EXE.exists():
        raise SystemExit(f"missing {EXE}")
    kill()
    results = run()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
    print("wrote", OUT)
    raise SystemExit(0 if results["pass"] else 1)


if __name__ == "__main__":
    main()
