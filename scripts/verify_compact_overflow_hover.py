#!/usr/bin/env python3
"""Marionette: Compact Mode overflow pin + Settings/uBlock hover sizing."""

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
PORT = 2843
OUT = ROOT / ".tmp-content-scheme" / "compact-overflow-hover-results.json"

MEASURE_JS = r"""
function info(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const icon = el.querySelector?.('.toolbarbutton-icon, .toolbarbutton-badge-stack') || null;
  const iconCs = icon ? getComputedStyle(icon) : null;
  const ir = icon ? icon.getBoundingClientRect() : null;
  return {
    id: el.id || el.localName,
    parent: el.parentElement?.id,
    w: Math.round(r.width), h: Math.round(r.height),
    pad: cs.padding,
    elBr: cs.borderRadius,
    iconW: ir ? Math.round(ir.width) : null,
    iconH: ir ? Math.round(ir.height) : null,
    iconPad: iconCs?.padding || null,
    iconBr: iconCs?.borderRadius || null,
    innerPad: cs.getPropertyValue('--toolbarbutton-inner-padding').trim(),
    radius: cs.getPropertyValue('--toolbarbutton-border-radius').trim(),
    overflowed: el.getAttribute('overflowedItem') === 'true'
      || el.parentElement?.id === 'widget-overflow-list',
    inSidebar: !!el.closest('#zen-sidebar-top-buttons'),
    overflows: el.getAttribute('overflows'),
    visible: r.width > 2 && r.height > 2 && cs.visibility !== 'hidden',
  };
}

const compact = document.getElementById('zen-toggle-compact-mode');
const compactBtn = compact?.querySelector('toolbarbutton');
const settings = document.getElementById('PanelUI-menu-button');
const reload = document.getElementById('reload-button');
const ublockWrap = document.querySelector('toolbaritem[id$="-browser-action"]');
const ublockBtn = ublockWrap?.querySelector('toolbarbutton');
const unified = document.getElementById('unified-extensions-button');

// Toggle compact to prove click works (Only Sidebar)
let toggled = null;
if (arguments[0]) {
  const before = gZenCompactModeManager.preference;
  compactBtn?.click();
  toggled = { before, after: gZenCompactModeManager.preference, changed: before !== gZenCompactModeManager.preference };
  // Restore
  if (toggled.changed) compactBtn?.click();
}

const ref = info(reload) || info(compactBtn);
function matchesRef(m) {
  if (!m || !ref) return null;
  const radiusOk = (m.iconBr === '8px' || m.radius === '8px');
  const padOk = (m.innerPad === '6px' || m.iconPad === '6px');
  // Icon hover box should be ~28px like the reference (allow small slack)
  const sizeOk = m.iconW == null || (Math.abs(m.iconW - (ref.iconW || 28)) <= 2
    && Math.abs(m.iconH - (ref.iconH || 28)) <= 2);
  // Outer button should not be much wider than icon (Settings end-pad bug)
  const outerOk = !m.visible || m.w <= (m.iconW || 28) + 6;
  return { radiusOk, padOk, sizeOk, outerOk, ok: radiusOk && padOk && sizeOk && outerOk };
}

return {
  layout: {
    single: document.documentElement.getAttribute('zen-single-toolbar'),
    expanded: document.documentElement.getAttribute('zen-sidebar-expanded'),
    scheme: Services.prefs.getIntPref('zen.view.window.scheme'),
  },
  compact: {
    ...info(compact),
    btn: info(compactBtn),
    visibleDirectly: !!(compact && compact.closest('#zen-sidebar-top-buttons')
      && compact.getAttribute('overflowedItem') !== 'true'
      && compact.parentElement?.id !== 'widget-overflow-list'
      && compact.getBoundingClientRect().width > 2),
    pinned: compact?.getAttribute('overflows') === 'false',
    toggled,
  },
  settings: info(settings),
  settingsMatch: matchesRef(info(settings)),
  reload: info(reload),
  compactMatch: matchesRef(info(compactBtn)),
  ublockWrap: info(ublockWrap),
  ublockBtn: info(ublockBtn),
  // Wrapper-cascaded radius should make icon 8px without touching webext rules
  ublockMatch: ublockBtn && ublockBtn.getBoundingClientRect().width > 2
    ? matchesRef(info(ublockBtn)) : { ok: true, skipped: true },
  unified: info(unified),
  unifiedMatch: matchesRef(info(unified)),
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
                raise RuntimeError("closed")
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


def write_profile(prefs: dict) -> Path:
    d = Path(tempfile.mkdtemp(prefix="astra-overflow-hover-"))
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


def run_case(label: str, single: bool, expanded: bool, scheme: int) -> dict:
    kill()
    prof = write_profile({
        "marionette.enabled": True,
        "marionette.port": PORT,
        "zen.welcome-screen.seen": True,
        "zen.view.use-single-toolbar": single,
        "zen.view.sidebar-expanded": expanded,
        "zen.view.window.scheme": scheme,
        "zen.theme.hide-unified-extensions-button": False,
    })
    launch(prof, PORT)
    if not wait_port(PORT):
        raise RuntimeError("port timeout")
    m = M(PORT)
    m.start()
    m.ex(f"""
      Services.prefs.setBoolPref('zen.view.use-single-toolbar', {'true' if single else 'false'});
      Services.prefs.setBoolPref('zen.view.sidebar-expanded', {'true' if expanded else 'false'});
      Services.prefs.setIntPref('zen.view.window.scheme', {scheme});
      Services.prefs.setBoolPref('zen.theme.hide-unified-extensions-button', false);
      gZenVerticalTabsManager._updateEvent();
      if (gZenUIManager?.settleToolbarOverflow) {{
        return gZenUIManager.settleToolbarOverflow();
      }}
      window.dispatchEvent(new Event('resize'));
      return true;
    """)
    time.sleep(1.4)
    # clickTest only for Only Sidebar (primary regression)
    data = m.ex_args(MEASURE_JS, [bool(single)])
    data["label"] = label

    ok_compact = True
    if single:
        ok_compact = (
            data["compact"]["visibleDirectly"] is True
            and data["compact"]["pinned"] is True
            and data["compact"].get("toggled", {}).get("changed") is True
        )
    else:
        # Other layouts: compact should still be in sidebar strip, not overflow
        ok_compact = data["compact"]["visibleDirectly"] is True and data["compact"]["pinned"] is True

    ok_settings = bool(data.get("settingsMatch", {}).get("ok"))
    ok_compact_hover = bool(data.get("compactMatch", {}).get("ok"))
    ublock = data.get("ublockMatch") or {}
    ok_ublock = bool(ublock.get("ok")) or bool(ublock.get("skipped"))

    case_ok = ok_compact and ok_settings and ok_compact_hover and ok_ublock
    data["ok"] = case_ok
    data["ok_compact_placement"] = ok_compact
    data["ok_settings_hover"] = ok_settings
    data["ok_compact_hover"] = ok_compact_hover
    data["ok_ublock_hover"] = ok_ublock

    m.req("WebDriver:DeleteSession")
    shutil.rmtree(prof, ignore_errors=True)
    return data


def run() -> dict:
    results = {"cases": [], "pass": True}
    cases = [
        ("only_sidebar_light", True, True, 1),
        ("only_sidebar_dark", True, True, 0),
        ("sidebar_top_light", False, True, 1),
        ("sidebar_top_dark", False, True, 0),
        ("collapsed_light", False, False, 1),
        ("collapsed_dark", False, False, 0),
    ]
    for label, single, expanded, scheme in cases:
        case = run_case(label, single, expanded, scheme)
        results["cases"].append(case)
        if not case["ok"]:
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
