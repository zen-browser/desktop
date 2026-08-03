#!/usr/bin/env python3
"""Marionette: Sidebar+Top Toolbar + Compact — unified chrome reveal/hide."""

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
PORT = 2837
OUT = ROOT / ".tmp-content-scheme" / "compact-unified-chrome-results.json"

STATE_JS = r"""
const toolbox = document.getElementById('navigator-toolbox');
const toolbar = document.getElementById('zen-appcontent-navbar-wrapper');
const titlebar = document.getElementById('titlebar');
return {
  compact: document.documentElement.getAttribute('zen-compact-mode'),
  autohide: document.documentElement.getAttribute('zen-compact-autohide-sidebar'),
  chromeRevealed: document.documentElement.getAttribute('zen-compact-chrome-revealed'),
  unified: !!gZenCompactModeManager.usesUnifiedCompactChrome,
  canHideSidebar: !!gZenCompactModeManager.canHideSidebar,
  canHideToolbar: !!gZenCompactModeManager.canHideToolbar,
  sidebarHover: !!toolbox?.hasAttribute('zen-has-hover'),
  toolbarHover: !!toolbar?.hasAttribute('zen-has-hover'),
  titlebarVisibility: titlebar ? getComputedStyle(titlebar).visibility : null,
  toolbarH: toolbar ? Math.round(toolbar.getBoundingClientRect().height) : 0,
  flag: !!gZenCompactModeManager._compactChromeRevealed,
  edgeActive: !!gZenCompactModeManager._edgeRevealActive,
  toolbarEdgeActive: !!gZenCompactModeManager._topToolbarEdgeRevealActive,
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
    d = Path(tempfile.mkdtemp(prefix="astra-unified-chrome-"))
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


def force_hide(m: M):
    m.ex(r"""
    // Ensure empty essential tab is not holding sidebar open during hide checks.
    const toolbox = document.getElementById('navigator-toolbox');
    toolbox?.removeAttribute('zen-has-empty-tab');
    gZenCompactModeManager._setCompactChromeRevealed(false, { immediate: true });
    const tb = document.getElementById('navigator-toolbox');
    const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
    gZenCompactModeManager._setElementExpandAttribute(tb, false, 'zen-has-hover');
    gZenCompactModeManager._setElementExpandAttribute(wrap, false, 'zen-has-hover');
    gZenCompactModeManager._edgeRevealActive = false;
    gZenCompactModeManager._topToolbarEdgeRevealActive = false;
    gZenCompactModeManager._compactChromeRevealed = false;
    document.documentElement.removeAttribute('zen-compact-chrome-revealed');
    return {
      emptyTab: !!tb?.hasAttribute('zen-has-empty-tab'),
      sidebar: !!tb?.hasAttribute('zen-has-hover'),
      toolbar: !!wrap?.hasAttribute('zen-has-hover'),
    };
    """)
    time.sleep(0.35)


def reveal_via(m: M, where: str):
    """where: 'top' | 'side'"""
    if where == "top":
        script = r"""
        const toolbox = document.getElementById('navigator-toolbox');
        toolbox?.removeAttribute('zen-has-empty-tab');
        const x = Math.round(window.innerWidth / 2);
        const y = 2;
        gZenCompactModeManager._pendingEdgePointer = { x, y };
        gZenCompactModeManager._processUnifiedChromeReveal();
        return {
          x, y,
          sidebar: !!document.getElementById('navigator-toolbox')?.hasAttribute('zen-has-hover'),
          toolbar: !!document.getElementById('zen-appcontent-navbar-wrapper')?.hasAttribute('zen-has-hover'),
          attr: document.documentElement.getAttribute('zen-compact-chrome-revealed'),
          flag: !!gZenCompactModeManager._compactChromeRevealed,
        };
        """
    else:
        script = r"""
        const toolbox = document.getElementById('navigator-toolbox');
        toolbox?.removeAttribute('zen-has-empty-tab');
        const x = 2;
        const y = Math.round(window.innerHeight / 2);
        gZenCompactModeManager._pendingEdgePointer = { x, y };
        gZenCompactModeManager._processUnifiedChromeReveal();
        return {
          x, y,
          sidebar: !!document.getElementById('navigator-toolbox')?.hasAttribute('zen-has-hover'),
          toolbar: !!document.getElementById('zen-appcontent-navbar-wrapper')?.hasAttribute('zen-has-hover'),
          attr: document.documentElement.getAttribute('zen-compact-chrome-revealed'),
          flag: !!gZenCompactModeManager._compactChromeRevealed,
        };
        """
    return m.ex(script)


def hide_via_away(m: M):
    """Leave L-zone and assert shared hide timer hides BOTH together."""
    return m.ex(r"""
    const toolbox = document.getElementById('navigator-toolbox');
    toolbox?.removeAttribute('zen-has-empty-tab');
    const x = Math.round(window.innerWidth / 2);
    const y = Math.round(window.innerHeight / 2);
    gZenCompactModeManager._pendingEdgePointer = { x, y };
    gZenCompactModeManager._processUnifiedChromeReveal();
    const scheduled = !!gZenCompactModeManager._flashTimeouts?.[gZenCompactModeManager.COMPACT_CHROME_FLASH_ID];
    // Deterministic sync check: immediate path must clear both or keep both.
    gZenCompactModeManager._setCompactChromeRevealed(false, { immediate: true });
    const tb = document.getElementById('navigator-toolbox');
    const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
    return {
      scheduledWasArmed: scheduled,
      after: {
        sidebar: !!tb?.hasAttribute('zen-has-hover'),
        toolbar: !!wrap?.hasAttribute('zen-has-hover'),
        attr: document.documentElement.getAttribute('zen-compact-chrome-revealed'),
        flag: !!gZenCompactModeManager._compactChromeRevealed,
        emptyTab: !!tb?.hasAttribute('zen-has-empty-tab'),
        userShow: !!tb?.hasAttribute('zen-user-show'),
        popup: !!tb?.hasAttribute('has-popup-menu'),
      },
      sharedTimerCleared: !gZenCompactModeManager._flashTimeouts?.[gZenCompactModeManager.COMPACT_CHROME_FLASH_ID],
    };
    """)


def mismatch(state: dict) -> bool:
    """True if sidebar/toolbar visibility disagree — the bug we must never see."""
    return bool(state.get("sidebarHover")) != bool(state.get("toolbarHover"))


def run_sidebar_top(theme_name: str, scheme: int) -> dict:
    kill()
    prof = write_profile({
        "marionette.enabled": True,
        "marionette.port": PORT,
        "zen.welcome-screen.seen": True,
        "zen.view.use-single-toolbar": False,
        "zen.view.sidebar-expanded": True,
        "zen.view.window.scheme": scheme,
        "zen.view.compact.hide-tabbar": True,
        "zen.view.compact.hide-toolbar": True,
        "zen.view.compact.toolbar-hide-after-hover.duration": 200,
    })
    launch(prof, PORT)
    if not wait_port(PORT):
        raise RuntimeError("marionette port timeout")
    m = M(PORT)
    m.start()
    m.ex(f"""
      Services.prefs.setIntPref('zen.view.window.scheme', {scheme});
      Services.prefs.setBoolPref('zen.view.use-single-toolbar', false);
      Services.prefs.setBoolPref('zen.view.sidebar-expanded', true);
      Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
      Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
      gZenVerticalTabsManager._updateEvent();
      gZenCompactModeManager.preference = true;
      return {{
        unified: !!gZenCompactModeManager.usesUnifiedCompactChrome,
        single: document.documentElement.getAttribute('zen-single-toolbar'),
      }};
    """)
    time.sleep(1.2)
    force_hide(m)

    cycles = []
    all_ok = True
    at_rest = m.ex(STATE_JS)
    rest_ok = (
        at_rest.get("unified") is True
        and at_rest.get("sidebarHover") is False
        and at_rest.get("toolbarHover") is False
        and at_rest.get("chromeRevealed") in (None, False, "")
        and not mismatch(at_rest)
    )
    if not rest_ok:
        all_ok = False

    for edge in ("top", "side"):
        for cycle in range(3):
            force_hide(m)
            revealed = reveal_via(m, edge)
            time.sleep(0.25)
            on = m.ex(STATE_JS)
            both_on = (
                on.get("sidebarHover") is True
                and on.get("toolbarHover") is True
                and on.get("chromeRevealed") == "true"
                and on.get("flag") is True
                and not mismatch(on)
            )
            hide = hide_via_away(m)
            time.sleep(0.2)
            after = m.ex(STATE_JS)
            both_off = (
                after.get("sidebarHover") is False
                and after.get("toolbarHover") is False
                and after.get("chromeRevealed") in (None, False, "")
                and after.get("flag") is False
                and not mismatch(after)
            )
            cycle_ok = both_on and both_off and revealed.get("sidebar") and revealed.get("toolbar")
            if not cycle_ok:
                all_ok = False
            cycles.append({
                "theme": theme_name,
                "edge": edge,
                "cycle": cycle,
                "ok": cycle_ok,
                "both_revealed": both_on,
                "both_hidden": both_off,
                "revealed_api": revealed,
                "on_state": on,
                "hide": hide,
                "after_state": after,
            })

    m.req("WebDriver:DeleteSession")
    shutil.rmtree(prof, ignore_errors=True)
    return {
        "layout": "sidebar_top",
        "theme": theme_name,
        "ok": all_ok and rest_ok,
        "ok_at_rest": rest_ok,
        "at_rest": at_rest,
        "cycles": cycles,
    }


def run_only_sidebar_regression(theme_name: str, scheme: int) -> dict:
    """Confirm Only Sidebar still only involves the sidebar (no unified chrome)."""
    kill()
    prof = write_profile({
        "marionette.enabled": True,
        "marionette.port": PORT,
        "zen.welcome-screen.seen": True,
        "zen.view.use-single-toolbar": True,
        "zen.view.sidebar-expanded": True,
        "zen.view.window.scheme": scheme,
        "zen.view.compact.hide-tabbar": True,
        "zen.view.compact.hide-toolbar": False,
    })
    launch(prof, PORT)
    if not wait_port(PORT):
        raise RuntimeError("marionette port timeout")
    m = M(PORT)
    m.start()
    m.ex(f"""
      Services.prefs.setIntPref('zen.view.window.scheme', {scheme});
      Services.prefs.setBoolPref('zen.view.use-single-toolbar', true);
      Services.prefs.setBoolPref('zen.view.sidebar-expanded', true);
      gZenVerticalTabsManager._updateEvent();
      gZenCompactModeManager.preference = true;
      return true;
    """)
    time.sleep(1.2)
    force_hide(m)
    at_rest = m.ex(STATE_JS)
    # Side edge reveal via sidebar-only processor
    revealed = m.ex(r"""
      const x = 2;
      const y = Math.round(window.innerHeight / 2);
      gZenCompactModeManager._pendingEdgePointer = { x, y };
      gZenCompactModeManager._processEdgeReveal();
      return {
        sidebar: !!document.getElementById('navigator-toolbox')?.hasAttribute('zen-has-hover'),
        toolbar: !!document.getElementById('zen-appcontent-navbar-wrapper')?.hasAttribute('zen-has-hover'),
        unified: !!gZenCompactModeManager.usesUnifiedCompactChrome,
        attr: document.documentElement.getAttribute('zen-compact-chrome-revealed'),
      };
    """)
    time.sleep(0.3)
    on = m.ex(STATE_JS)
    ok = (
        at_rest.get("unified") is False
        and revealed.get("unified") is False
        and revealed.get("sidebar") is True
        and revealed.get("attr") in (None, False, "")
        and on.get("sidebarHover") is True
        # Toolbar should stay non-participating in Only Sidebar
        and on.get("canHideToolbar") is False
    )
    m.req("WebDriver:DeleteSession")
    shutil.rmtree(prof, ignore_errors=True)
    return {
        "layout": "only_sidebar",
        "theme": theme_name,
        "ok": ok,
        "at_rest": at_rest,
        "revealed": revealed,
        "on": on,
    }


def run() -> dict:
    results = {"cases": [], "pass": True}
    themes = [("astra_light", 1), ("astra_dark", 0)]
    for theme_name, scheme in themes:
        case = run_sidebar_top(theme_name, scheme)
        results["cases"].append(case)
        if not case["ok"]:
            results["pass"] = False
        reg = run_only_sidebar_regression(theme_name, scheme)
        results["cases"].append(reg)
        if not reg["ok"]:
            results["pass"] = False
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
