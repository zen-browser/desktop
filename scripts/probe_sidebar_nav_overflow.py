#!/usr/bin/env python3
"""Marionette: diagnose Only Sidebar icon-strip overlap / space allocation."""

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
PORT = 2847
OUT = ROOT / ".tmp-content-scheme" / "sidebar-nav-overflow-after.json"

MEASURE_JS = r"""
function rectInfo(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    id: el.id || el.getAttribute?.('id') || el.localName,
    tag: el.localName,
    parent: el.parentElement?.id || null,
    x: Math.round(r.x * 10) / 10,
    y: Math.round(r.y * 10) / 10,
    w: Math.round(r.width * 10) / 10,
    h: Math.round(r.height * 10) / 10,
    right: Math.round((r.x + r.width) * 10) / 10,
    visibility: cs.visibility,
    display: cs.display,
    opacity: cs.opacity,
    overflowed: el.getAttribute('overflowedItem') === 'true'
      || el.parentElement?.id === 'widget-overflow-list',
    overflows: el.getAttribute('overflows'),
    hidden: el.hidden === true || el.getAttribute('hidden') === 'true',
    visibleBox: r.width > 1 && r.height > 1
      && cs.visibility !== 'hidden' && cs.display !== 'none',
  };
}

function overlaps(a, b) {
  if (!a?.visibleBox || !b?.visibleBox) return false;
  const ax2 = a.x + a.w, ay2 = a.y + a.h;
  const bx2 = b.x + b.w, by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  return ix > 2 && iy > 2;
}

const ids = [
  'zen-toggle-compact-mode',
  'zen-app-launcher-button',
  'astra-suraksha-button',
  'back-button',
  'forward-button',
  'stop-reload-button',
  'reload-button',
  'nav-bar-overflow-button',
  'PanelUI-button',
  'unified-extensions-button',
  'zen-sidebar-top-buttons',
  'zen-sidebar-top-buttons-customization-target',
  'navigator-toolbox',
];

const items = {};
for (const id of ids) {
  items[id] = rectInfo(document.getElementById(id));
}

const target = document.getElementById('zen-sidebar-top-buttons-customization-target');
const children = [];
if (target) {
  for (const child of target.children) {
    children.push(rectInfo(child));
  }
}

const strip = document.getElementById('zen-sidebar-top-buttons');
const stripKids = [];
if (strip) {
  for (const child of strip.children) {
    stripKids.push(rectInfo(child));
  }
}

const competing = [
  items['zen-toggle-compact-mode'],
  items['zen-app-launcher-button'],
  items['astra-suraksha-button'],
  items['back-button'],
  items['forward-button'],
  items['stop-reload-button'],
  items['nav-bar-overflow-button'],
].filter(Boolean);

const overlapPairs = [];
for (let i = 0; i < competing.length; i++) {
  for (let j = i + 1; j < competing.length; j++) {
    if (overlaps(competing[i], competing[j])) {
      overlapPairs.push([competing[i].id, competing[j].id]);
    }
  }
}

const visibleInStrip = competing.filter(c =>
  c.visibleBox && !c.overflowed && (
    c.parent === 'zen-sidebar-top-buttons-customization-target'
    || c.parent === 'zen-sidebar-top-buttons'
    || document.getElementById(c.id)?.closest('#zen-sidebar-top-buttons')
  )
);

const totalVisibleWidth = visibleInStrip.reduce((s, c) => s + (c.w || 0), 0);
const stripW = items['zen-sidebar-top-buttons']?.w || 0;
const toolboxW = items['navigator-toolbox']?.w || 0;

return {
  layout: {
    single: document.documentElement.getAttribute('zen-single-toolbar'),
    expanded: document.documentElement.getAttribute('zen-sidebar-expanded'),
    compact: document.documentElement.getAttribute('zen-compact-mode'),
    scheme: Services.prefs.getIntPref('zen.view.window.scheme'),
    singlePref: Services.prefs.getBoolPref('zen.view.use-single-toolbar'),
    sidebarExpandedPref: Services.prefs.getBoolPref('zen.view.sidebar-expanded'),
  },
  widths: {
    stripW, toolboxW, totalVisibleWidth,
    freeSlack: Math.round((stripW - totalVisibleWidth) * 10) / 10,
  },
  items,
  children,
  stripKids,
  overlapPairs,
  overflowButtonVisible: !!(items['nav-bar-overflow-button']?.visibleBox
    && !items['nav-bar-overflow-button']?.hidden),
  summary: {
    compactVisible: !!(items['zen-toggle-compact-mode']?.visibleBox
      && !items['zen-toggle-compact-mode']?.overflowed),
    appHubVisible: !!(items['zen-app-launcher-button']?.visibleBox
      && !items['zen-app-launcher-button']?.overflowed),
    surakshaVisible: !!(items['astra-suraksha-button']?.visibleBox
      && !items['astra-suraksha-button']?.overflowed),
    backVisible: !!(items['back-button']?.visibleBox
      && !items['back-button']?.overflowed),
    forwardVisible: !!(items['forward-button']?.visibleBox
      && !items['forward-button']?.overflowed),
    reloadVisible: !!(items['stop-reload-button']?.visibleBox
      && !items['stop-reload-button']?.overflowed),
    overflowVisible: !!(items['nav-bar-overflow-button']?.visibleBox),
    hasOverlap: overlapPairs.length > 0,
  },
};
"""


class M:
    def __init__(self, port: int):
        self.port = port
        last_err = None
        for _ in range(30):
            try:
                self.sock = socket.create_connection(("127.0.0.1", port), timeout=5)
                self._read()
                self._id = 0
                return
            except Exception as e:
                last_err = e
                time.sleep(0.5)
        raise RuntimeError(f"marionette connect failed: {last_err}")

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

    def ex(self, script, timeout=90, args=None):
        r = self.req(
            "WebDriver:ExecuteScript",
            {
                "script": script,
                "args": args or [],
                "sandbox": "chrome",
                "newSandbox": True,
            },
            timeout=timeout,
        )
        return r.get("value", r)

    def close(self):
        try:
            self.req("WebDriver:DeleteSession", {})
        except Exception:
            pass
        self.sock.close()


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
    d = Path(tempfile.mkdtemp(prefix="astra-sidebar-nav-"))
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


BASE_PREFS = {
    "marionette.enabled": True,
    "marionette.port": PORT,
    "browser.shell.checkDefaultBrowser": False,
    "browser.startup.homepage_override.mstone": "ignore",
    "startup.homepage_welcome_url": "",
    "startup.homepage_welcome_url.additional": "",
    "browser.aboutwelcome.enabled": False,
    "toolkit.telemetry.reportingpolicy.firstRun": False,
    "datareporting.policy.dataSubmissionEnabled": False,
    "zen.welcome-screen.seen": True,
    "astra.apphub.enabled": True,
    "astra.suraksha.enabled": True,
}


LAYOUTS = {
    "only_sidebar": {
        "zen.view.use-single-toolbar": True,
        "zen.view.sidebar-expanded": True,
        "zen.view.compact.hide-tabbar": False,
        "zen.tabs.vertical": True,
    },
    "sidebar_top": {
        "zen.view.use-single-toolbar": False,
        "zen.view.sidebar-expanded": True,
        "zen.view.compact.hide-tabbar": False,
        "zen.tabs.vertical": True,
    },
    "collapsed": {
        "zen.view.use-single-toolbar": False,
        "zen.view.sidebar-expanded": False,
        "zen.view.compact.hide-tabbar": False,
        "zen.tabs.vertical": True,
    },
}


SHORTCUT_JS = r"""
const cmd = arguments[0];
const el = document.getElementById(cmd);
if (!el) return { ok: false, reason: 'missing-cmd' };
el.doCommand();
return new Promise(resolve => {
  setTimeout(() => {
    if (cmd === 'cmd_zenOpenAppLauncher') {
      const panel = document.getElementById('PanelUI-zen-app-launcher');
      const open = !!(panel && (
        panel.getAttribute('panelopen') === 'true'
        || panel.state === 'open'
        || panel.hasAttribute('open')
      ));
      if (open && panel.hidePopup) panel.hidePopup();
      resolve({ ok: open, open });
      return;
    }
    if (cmd === 'cmd_astraOpenSurakshaCenter') {
      const popup = document.getElementById('protections-popup');
      const open = !!(popup && (
        popup.getAttribute('panelopen') === 'true'
        || popup.state === 'open'
        || popup.hasAttribute('open')
      ));
      if (open && popup.hidePopup) popup.hidePopup();
      resolve({ ok: open, open });
      return;
    }
    resolve({ ok: false, reason: 'unknown' });
  }, 500);
});
"""


def run_case(label: str, layout: str, scheme: int) -> dict:
    prefs = {**BASE_PREFS, **LAYOUTS[layout], "zen.view.window.scheme": scheme}
    profile = write_profile(prefs)
    kill()
    launch(profile, PORT)
    if not wait_port(PORT, 90):
        shutil.rmtree(profile, ignore_errors=True)
        return {"label": label, "error": "port-timeout"}
    time.sleep(1.5)
    m = M(PORT)
    try:
        m.start()
        time.sleep(2)
        # Settle overflow after chrome layout
        m.ex(
            """
            if (gZenUIManager?.settleToolbarOverflow) {
              return gZenUIManager.settleToolbarOverflow();
            }
            window.dispatchEvent(new Event('resize'));
            """
        )
        time.sleep(1)
        measure = m.ex(MEASURE_JS)
        # Also try narrower and wider toolbox widths for Only Sidebar
        width_scans = []
        if layout == "only_sidebar":
            for w in (140, 160, 186, 220, 280):
                m.ex(
                    f"""
                    const tb = document.getElementById('navigator-toolbox');
                    tb.style.width = '{w}px';
                    tb.setAttribute('width', '{w}px');
                    window.dispatchEvent(new Event('resize'));
                    if (gZenUIManager?.settleToolbarOverflow) {{
                      return gZenUIManager.settleToolbarOverflow();
                    }}
                    """
                )
                time.sleep(0.6)
                width_scans.append({"setWidth": w, **m.ex(MEASURE_JS)})
        shortcuts = {
            "appHub": m.ex(SHORTCUT_JS, args=["cmd_zenOpenAppLauncher"]),
            "suraksha": m.ex(SHORTCUT_JS, args=["cmd_astraOpenSurakshaCenter"]),
        }
        return {
            "label": label,
            "layout": layout,
            "scheme": scheme,
            "measure": measure,
            "width_scans": width_scans,
            "shortcuts": shortcuts,
        }
    except Exception as e:
        return {"label": label, "layout": layout, "scheme": scheme, "error": str(e)}
    finally:
        try:
            m.close()
        except Exception:
            pass
        kill()
        shutil.rmtree(profile, ignore_errors=True)


def main():
    if not EXE.exists():
        raise SystemExit(f"missing exe: {EXE}")
    results = {"phase": "after", "cases": []}
    # Only Sidebar light+dark; also sample other layouts for no-regression
    plan = [
        ("only_sidebar_light", "only_sidebar", 0),
        ("only_sidebar_dark", "only_sidebar", 1),
        ("sidebar_top_light", "sidebar_top", 0),
        ("sidebar_top_dark", "sidebar_top", 1),
        ("collapsed_light", "collapsed", 0),
        ("collapsed_dark", "collapsed", 1),
    ]
    for label, layout, scheme in plan:
        print("running", label, flush=True)
        results["cases"].append(run_case(label, layout, scheme))
        # Print quick summary
        c = results["cases"][-1]
        if "error" in c:
            print("  ERROR", c["error"])
        else:
            s = c["measure"]["summary"]
            w = c["measure"]["widths"]
            print(
                f"  overlap={s['hasOverlap']} pairs={c['measure']['overlapPairs']}"
                f" hub={s['appHubVisible']} sur={s['surakshaVisible']}"
                f" back={s['backVisible']} fwd={s['forwardVisible']}"
                f" reload={s['reloadVisible']} >>={s['overflowVisible']}"
                f" strip={w['stripW']} used={w['totalVisibleWidth']}"
            )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
