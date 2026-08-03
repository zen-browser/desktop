#!/usr/bin/env python3
"""Marionette: Compact Mode toolbar overlay contrast on light/dark sites + themes."""

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
PORT = 2834
OUT = ROOT / ".tmp-content-scheme" / "compact-overlay-contrast-results.json"

# Measure wrapper backdrop (not .zen-toolbar-background — that lives under #titlebar).
CONTRAST_JS = r"""
function parseColor(str) {
  if (!str || str === 'transparent' || str === 'none') return null;
  let m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
  m = str.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)/);
  if (m) return { r: Math.round(+m[1]*255), g: Math.round(+m[2]*255), b: Math.round(+m[3]*255), a: m[4] !== undefined ? +m[4] : 1 };
  return null;
}
function relLum({r,g,b}) {
  const f = (c) => { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastRatio(c1, c2) {
  if (!c1 || !c2) return null;
  const L1 = relLum(c1), L2 = relLum(c2);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
function compositeOver(fg, bg) {
  if (!fg) return bg;
  if (!bg) return { r: fg.r, g: fg.g, b: fg.b, a: 1 };
  const a = fg.a == null ? 1 : fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}
const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
const btn = wrap?.querySelector('#nav-bar toolbarbutton, toolbarbutton');
const icon = btn?.querySelector('.toolbarbutton-icon, image') || btn;
const wrapCs = wrap ? getComputedStyle(wrap) : null;
const btnCs = btn ? getComputedStyle(btn) : null;
const iconCs = icon ? getComputedStyle(icon) : null;
const overlayBg = parseColor(wrapCs?.backgroundColor || '');
const iconColor = parseColor(iconCs?.fill || '') || parseColor(iconCs?.color || '') || parseColor(btnCs?.color || '');
const pageApprox = { r: arguments[0], g: arguments[1], b: arguments[2], a: 1 };
const effectiveOverlay = compositeOver(overlayBg, pageApprox);
return {
  scheme: Services.prefs.getIntPref('zen.view.window.scheme'),
  colorScheme: getComputedStyle(document.documentElement).colorScheme,
  hasHover: !!wrap?.hasAttribute('zen-has-hover'),
  transparentMode: document.documentElement.getAttribute('astra-transparent-effective-mode'),
  overlayBg,
  iconColor,
  effectiveOverlay,
  iconOnOverlay: contrastRatio(iconColor, effectiveOverlay),
  overlayOnPage: contrastRatio(effectiveOverlay, pageApprox),
  border: wrapCs?.borderBottom,
  shadow: wrapCs?.boxShadow,
  wrapH: wrap ? Math.round(wrap.getBoundingClientRect().height) : 0,
  wrapW: wrap ? Math.round(wrap.getBoundingClientRect().width) : 0,
  btnVisible: !!(btn && btn.getBoundingClientRect().height > 2 && parseFloat(btnCs.opacity) > 0.05),
  btnColor: btnCs?.color,
  iconFill: iconCs?.fill,
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

    def ex_args(self, script, args, timeout=90):
        r = self.req(
            "WebDriver:ExecuteScript",
            {"script": script, "args": args, "sandbox": "chrome", "newSandbox": True},
            timeout=timeout,
        )
        return r.get("value", r)

    def navigate(self, url: str):
        self.ex(
            f"""
            const uri = Services.io.newURI({json.dumps(url)});
            gBrowser.loadURI(uri, {{ triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }});
            return true;
            """
        )
        time.sleep(4.0)


def kill():
    subprocess.run(
        ["powershell", "-NoProfile", "-Command",
         "Get-Process astra,plugin-container,firefox -ErrorAction SilentlyContinue | Stop-Process -Force"],
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
    d = Path(tempfile.mkdtemp(prefix="astra-contrast-"))
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


def reveal_toolbar(m: M):
    m.ex(r"""
    const wrap = document.getElementById('zen-appcontent-navbar-wrapper');
    gZenCompactModeManager._setElementExpandAttribute(wrap, true, 'zen-has-hover');
    return { hover: wrap?.hasAttribute('zen-has-hover'), h: wrap?.getBoundingClientRect().height };
    """)
    time.sleep(0.7)


def run() -> dict:
    results = {"cases": [], "pass": True, "min_icon_contrast": None, "min_overlay_on_page": None}
    # zen.view.window.scheme: 0=dark, 1=light
    sites = [
        ("wikipedia_light", "https://en.wikipedia.org/wiki/Main_Page", (255, 255, 255)),
        ("about_blank_white", "about:blank", (255, 255, 255)),
        ("youtube_dark", "https://www.youtube.com/", (15, 15, 15)),
        ("bbc_light", "https://www.bbc.com/news", (255, 255, 255)),
    ]
    themes = [("astra_light", 1), ("astra_dark", 0)]

    for theme_name, scheme in themes:
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
          Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
          Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
          gZenVerticalTabsManager._updateEvent();
          gZenCompactModeManager.preference = true;
          return true;
        """)
        time.sleep(1.2)

        for site_name, url, page_rgb in sites:
            m.navigate(url)
            reveal_toolbar(m)
            measured = m.ex_args(CONTRAST_JS, list(page_rgb))
            icon_c = measured.get("iconOnOverlay")
            page_c = measured.get("overlayOnPage")
            overlay_bg = measured.get("overlayBg")
            # Require a real painted backdrop (not fully transparent).
            has_bg = isinstance(overlay_bg, dict) and overlay_bg.get("a", 0) >= 0.85
            ok_icon = isinstance(icon_c, (int, float)) and icon_c >= 3.0
            # Page separation: either measurable luminance contrast OR a visible
            # border/shadow (needed when theme tint matches page luminance).
            border = measured.get("border") or ""
            shadow = measured.get("shadow") or ""
            has_edge = (
                ("1px" in border or "2px" in border)
                and "rgba(0, 0, 0, 0)" not in border
            ) or (shadow not in ("", "none") and "0px 0px 0px" not in shadow)
            ok_page = (isinstance(page_c, (int, float)) and page_c >= 1.15) or has_edge
            ok_visible = bool(measured.get("btnVisible")) and measured.get("wrapH", 0) > 20
            case_ok = has_bg and ok_icon and ok_page and ok_visible
            if not case_ok:
                results["pass"] = False
            if isinstance(icon_c, (int, float)):
                cur = results["min_icon_contrast"]
                results["min_icon_contrast"] = icon_c if cur is None else min(cur, icon_c)
            if isinstance(page_c, (int, float)):
                cur = results["min_overlay_on_page"]
                results["min_overlay_on_page"] = page_c if cur is None else min(cur, page_c)
            results["cases"].append({
                "theme": theme_name,
                "site": site_name,
                "ok": case_ok,
                "has_opaque_bg": has_bg,
                "ok_icon": ok_icon,
                "ok_page_sep": ok_page,
                "has_edge_sep": has_edge,
                "ok_visible": ok_visible,
                "iconOnOverlay": icon_c,
                "overlayOnPage": page_c,
                "overlayBg": overlay_bg,
                "effectiveOverlay": measured.get("effectiveOverlay"),
                "iconColor": measured.get("iconColor"),
                "colorScheme": measured.get("colorScheme"),
                "scheme": measured.get("scheme"),
                "border": measured.get("border"),
                "shadow": measured.get("shadow"),
                "wrapH": measured.get("wrapH"),
                "transparentMode": measured.get("transparentMode"),
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
