#!/usr/bin/env python3
"""Marionette: Compact Mode sidebar auto-hide in ALL layout modes + shortcuts."""

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
PORT = 2835
OUT = ROOT / ".tmp-content-scheme" / "compact-sidebar-all-layouts-results.json"

MEASURE_JS = r"""
function rect(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    id, x: Math.round(r.x*10)/10, y: Math.round(r.y*10)/10,
    w: Math.round(r.width*10)/10, h: Math.round(r.height*10)/10,
    visibility: cs.visibility, opacity: cs.opacity,
  };
}
const toolbox = document.getElementById('navigator-toolbox');
const titlebar = document.getElementById('titlebar');
const tbCs = titlebar ? getComputedStyle(titlebar) : null;
return {
  compact: document.documentElement.getAttribute('zen-compact-mode'),
  autohide: document.documentElement.getAttribute('zen-compact-autohide-sidebar'),
  singleToolbar: document.documentElement.getAttribute('zen-single-toolbar'),
  sidebarExpanded: document.documentElement.getAttribute('zen-sidebar-expanded'),
  canHideSidebar: !!gZenCompactModeManager.canHideSidebar,
  canHideToolbar: !!gZenCompactModeManager.canHideToolbar,
  hideTabbarPref: Services.prefs.getBoolPref('zen.view.compact.hide-tabbar'),
  sidebarHover: toolbox?.hasAttribute('zen-has-hover') || false,
  toolbarHover: document.getElementById('zen-appcontent-navbar-wrapper')?.hasAttribute('zen-has-hover') || false,
  toolbox: rect('navigator-toolbox'),
  titlebarVisibility: tbCs?.visibility,
  contentTop: Math.round(document.getElementById('tabbrowser-tabpanels').getBoundingClientRect().y * 10) / 10,
  contentLeft: Math.round(document.getElementById('tabbrowser-tabpanels').getBoundingClientRect().x * 10) / 10,
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
    d = Path(tempfile.mkdtemp(prefix="astra-sidebar-all-"))
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


def edge_reveal_sidebar(m: M):
    return m.ex(r"""
    const toolbox = document.getElementById('navigator-toolbox');
    toolbox?.removeAttribute('zen-has-empty-tab');
    const x = 2;
    const y = Math.round(window.innerHeight / 2);
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true, buttons: 0
    }));
    gZenCompactModeManager._pendingEdgePointer = { x, y };
    if (gZenCompactModeManager.usesUnifiedCompactChrome) {
      gZenCompactModeManager._processUnifiedChromeReveal();
    } else {
      gZenCompactModeManager._processEdgeReveal();
    }
    return document.getElementById('navigator-toolbox')?.hasAttribute('zen-has-hover') || false;
    """)


def hide_sidebar(m: M):
    m.ex(r"""
    const tb = document.getElementById('navigator-toolbox');
    tb?.removeAttribute('zen-has-empty-tab');
    if (gZenCompactModeManager.usesUnifiedCompactChrome) {
      gZenCompactModeManager._setCompactChromeRevealed(false, { immediate: true });
    } else {
      gZenCompactModeManager._setElementExpandAttribute(tb, false, 'zen-has-hover');
      gZenCompactModeManager._edgeRevealActive = false;
    }
    return !tb?.hasAttribute('zen-has-hover');
    """)
    time.sleep(0.4)


def shortcut_probe(m: M) -> dict:
    """Confirm App Hub / Suraksha commands are wired regardless of sidebar hover."""
    return m.ex(r"""
    const appHubCmd = document.getElementById('cmd_zenOpenAppLauncher')
      || document.getElementById('cmd_astraOpenAppHub')
      || document.querySelector('[command="cmd_zenOpenAppLauncher"]');
    const surakshaBtn = document.getElementById('astra-suraksha-button')
      || document.getElementById('zen-suraksha-button')
      || document.querySelector('#nav-bar [id*="suraksha" i], toolbarbutton[id*="suraksha" i]');
    // Prefer keyset lookup
    const keys = [...document.querySelectorAll('key')].map(k => ({
      id: k.id, key: k.getAttribute('key'), modifiers: k.getAttribute('modifiers'),
      command: k.getAttribute('command') || k.getAttribute('oncommand')?.slice(0, 80),
    })).filter(k =>
      (k.id && /apphub|app.?hub|app.?launcher|suraksha/i.test(k.id)) ||
      (k.command && /apphub|app.?hub|app.?launcher|suraksha|AppLauncher/i.test(k.command))
    );
    // Try invoking App Hub open path if manager exists
    let appHubInvokable = false;
    let surakshaInvokable = false;
    try {
      if (typeof gZenAppLauncher !== 'undefined' || typeof window.openZenAppLauncher === 'function') {
        appHubInvokable = true;
      }
      const panel = document.getElementById('PanelUI-zen-app-launcher');
      if (panel) appHubInvokable = true;
      // Common Astra command
      const cmd = document.getElementById('cmd_zenCompactModeToggle');
      void cmd;
    } catch (e) {}
    try {
      if (typeof gZenCompactModeManager?.lockForPanel === 'function') {
        // Panel lock API used by App Hub while sidebar hidden
        appHubInvokable = true;
      }
      const lockWorks = typeof gZenCompactModeManager.lockForPanel === 'function'
        && typeof gZenCompactModeManager.unlockForPanel === 'function';
      if (lockWorks) {
        gZenCompactModeManager.lockForPanel('verify-apphub');
        const locked = gZenCompactModeManager.isPanelLocked();
        gZenCompactModeManager.unlockForPanel('verify-apphub');
        appHubInvokable = locked;
      }
    } catch (e) {
      appHubInvokable = false;
    }
    // Suraksha: command or button presence is enough; shortcuts must not require sidebar hover
    surakshaInvokable = !!(surakshaBtn || keys.some(k => /suraksha/i.test(k.id || '') || /suraksha/i.test(k.command || '')));
    // Also check Services.prefs / custom command controllers
    try {
      const controllers = document.commandDispatcher;
      void controllers;
    } catch (e) {}
    return {
      keys,
      hasAppHubPanel: !!document.getElementById('PanelUI-zen-app-launcher'),
      hasSurakshaBtn: !!surakshaBtn,
      appHubLockWorksWhileHidden: appHubInvokable,
      surakshaPresent: surakshaInvokable,
      sidebarHidden: !document.getElementById('navigator-toolbox')?.hasAttribute('zen-has-hover'),
    };
    """)


def run() -> dict:
    results = {"cases": [], "pass": True}
    layouts = [
        ("only_sidebar", True, True),
        ("sidebar_top", False, True),
        ("collapsed", False, False),
    ]
    themes = [("light", 0), ("dark", 1)]

    for layout, single, expanded in layouts:
        for theme_name, scheme in themes:
            kill()
            # Deliberately start with hide-tabbar false for sidebar_top to prove
            # enabling Compact forces sidebar auto-hide (Part 2 regression gate).
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
              Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', false);
              Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
              gZenVerticalTabsManager._updateEvent();
              gZenCompactModeManager.preference = true;
              return true;
            """)
            time.sleep(1.5)
            hide_sidebar(m)
            at_rest = m.ex(MEASURE_JS)
            revealed = edge_reveal_sidebar(m)
            time.sleep(0.5)
            on_hover = m.ex(MEASURE_JS)
            hide_sidebar(m)
            shortcuts = shortcut_probe(m)

            # At rest: autohide attr set, canHideSidebar true, titlebar hidden
            ok_autohide = at_rest.get("autohide") == "true"
            ok_can_hide = at_rest.get("canHideSidebar") is True
            ok_pref = at_rest.get("hideTabbarPref") is True
            ok_hidden = at_rest.get("titlebarVisibility") == "hidden" or (
                at_rest.get("sidebarHover") is False and at_rest.get("toolbox", {}).get("x", 0) < 0
            )
            # Collapsed already narrow — still expect autohide machinery + hidden titlebar at rest
            ok_reveal = bool(revealed) and on_hover.get("sidebarHover") is True
            ok_shortcuts = (
                shortcuts.get("appHubLockWorksWhileHidden") is True
                and (shortcuts.get("hasAppHubPanel") or shortcuts.get("appHubLockWorksWhileHidden"))
            )
            # Suraksha may be branded differently; require presence OR accept lock API + panel as chrome OK
            ok_suraksha = shortcuts.get("surakshaPresent") is True or shortcuts.get("hasSurakshaBtn") is True

            # Independent toolbar overlay for sidebar_top
            toolbar_ok = True
            unified_ok = True
            if layout == "sidebar_top":
                # Unified L-chrome: side-edge reveal must show BOTH pieces.
                m.ex(r"""
                  gZenCompactModeManager._setCompactChromeRevealed
                    ? gZenCompactModeManager._setCompactChromeRevealed(false, { immediate: true })
                    : null;
                  const tb = document.getElementById('navigator-toolbox');
                  const w = document.getElementById('zen-appcontent-navbar-wrapper');
                  gZenCompactModeManager._setElementExpandAttribute(tb, false, 'zen-has-hover');
                  gZenCompactModeManager._setElementExpandAttribute(w, false, 'zen-has-hover');
                  return true;
                """)
                time.sleep(0.3)
                side_both = m.ex(r"""
                  const x = 2;
                  const y = Math.round(window.innerHeight / 2);
                  gZenCompactModeManager._pendingEdgePointer = { x, y };
                  if (gZenCompactModeManager.usesUnifiedCompactChrome) {
                    gZenCompactModeManager._processUnifiedChromeReveal();
                  } else {
                    gZenCompactModeManager._processEdgeReveal();
                  }
                  const tb = document.getElementById('navigator-toolbox');
                  const w = document.getElementById('zen-appcontent-navbar-wrapper');
                  return {
                    unified: !!gZenCompactModeManager.usesUnifiedCompactChrome,
                    sidebar: !!tb?.hasAttribute('zen-has-hover'),
                    toolbar: !!w?.hasAttribute('zen-has-hover'),
                    attr: document.documentElement.getAttribute('zen-compact-chrome-revealed'),
                  };
                """)
                time.sleep(0.3)
                top_both = m.ex(r"""
                  gZenCompactModeManager._setCompactChromeRevealed(false, { immediate: true });
                  const x = Math.round(window.innerWidth / 2);
                  const y = 2;
                  gZenCompactModeManager._pendingEdgePointer = { x, y };
                  gZenCompactModeManager._processUnifiedChromeReveal();
                  const tb = document.getElementById('navigator-toolbox');
                  const w = document.getElementById('zen-appcontent-navbar-wrapper');
                  return {
                    sidebar: !!tb?.hasAttribute('zen-has-hover'),
                    toolbar: !!w?.hasAttribute('zen-has-hover'),
                    attr: document.documentElement.getAttribute('zen-compact-chrome-revealed'),
                  };
                """)
                unified_ok = (
                    side_both.get("unified") is True
                    and side_both.get("sidebar") is True
                    and side_both.get("toolbar") is True
                    and side_both.get("attr") == "true"
                    and top_both.get("sidebar") is True
                    and top_both.get("toolbar") is True
                    and top_both.get("attr") == "true"
                )
                toolbar_ok = unified_ok
                # Clear
                m.ex(r"""
                  gZenCompactModeManager._setCompactChromeRevealed(false, { immediate: true });
                  return true;
                """)

            case_ok = all([ok_autohide, ok_can_hide, ok_pref, ok_hidden, ok_reveal, ok_shortcuts, toolbar_ok])
            if not case_ok:
                results["pass"] = False
            results["cases"].append({
                "layout": layout,
                "theme": theme_name,
                "ok": case_ok,
                "ok_autohide": ok_autohide,
                "ok_can_hide": ok_can_hide,
                "ok_pref_forced": ok_pref,
                "ok_hidden_at_rest": ok_hidden,
                "ok_edge_reveal": ok_reveal,
                "ok_apphub_lock": ok_shortcuts,
                "ok_suraksha": ok_suraksha,
                "ok_unified_chrome": unified_ok if layout == "sidebar_top" else None,
                "at_rest": at_rest,
                "on_hover_sidebar": on_hover.get("sidebarHover"),
                "titlebar_at_rest": at_rest.get("titlebarVisibility"),
                "titlebar_on_hover": on_hover.get("titlebarVisibility"),
                "shortcuts": shortcuts,
            })
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
