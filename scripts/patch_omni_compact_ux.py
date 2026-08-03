#!/usr/bin/env python3
"""Patch local astra-run omni.ja with compact/onboarding UX source changes."""

from __future__ import annotations

import shutil
import subprocess
import time
import zipfile
from pathlib import Path

ROOT = Path(r"c:\ZenFork\astradesktop")
RUN = ROOT / ".tmp-content-scheme" / "astra-run"
OMNI = RUN / "browser" / "omni.ja"
INSTALLED = Path(r"C:\Program Files\Astra Browser\browser\omni.ja")
SRC = ROOT / "src"
LOCALE = ROOT / "locales" / "en-US" / "browser" / "browser" / "zen-welcome.ftl"

REPLACEMENTS = {
    "chrome/browser/content/browser/zen-components/ZenCompactMode.mjs": SRC
    / "zen/compact-mode/ZenCompactMode.mjs",
    "chrome/browser/content/browser/zen-styles/astra-compact.css": SRC
    / "zen/common/styles/astra-compact.css",
    "chrome/browser/content/browser/zen-components/ZenWelcome.mjs": SRC
    / "zen/welcome/ZenWelcome.mjs",
    "chrome/browser/content/browser/zen-styles/zen-welcome.css": SRC
    / "zen/welcome/zen-welcome.css",
    "localization/en-US/browser/zen-welcome.ftl": LOCALE,
    "chrome/browser/content/browser/zen-components/ZenUIManager.mjs": SRC
    / "zen/common/modules/ZenUIManager.mjs",
    "modules/ZenCustomizableUI.sys.mjs": SRC
    / "zen/common/sys/ZenCustomizableUI.sys.mjs",
    "chrome/browser/content/browser/zen-styles/zen-single-components.css": SRC
    / "zen/common/styles/zen-single-components.css",
    "chrome/browser/content/browser/zen-styles/astra-sidebar.css": SRC
    / "zen/common/styles/astra-sidebar.css",
}


def kill_astra() -> None:
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


def patch_omni() -> None:
    RUN.mkdir(parents=True, exist_ok=True)
    if INSTALLED.exists():
        shutil.copy2(INSTALLED, OMNI)
        print("synced omni from", INSTALLED)
    elif not OMNI.exists():
        raise SystemExit(f"missing omni.ja at {OMNI}")

    tmp = OMNI.with_suffix(".ja.tmp")
    if tmp.exists():
        tmp.unlink()

    with zipfile.ZipFile(OMNI, "r") as zin:
        names = set(zin.namelist())

    resolved: dict[str, Path] = {}
    for rel, path in REPLACEMENTS.items():
        if rel in names:
            resolved[rel] = path
        else:
            hits = [n for n in names if Path(n).name == Path(rel).name]
            if hits:
                print("remap", rel, "->", hits[0])
                resolved[hits[0]] = path
            else:
                raise SystemExit(f"missing {rel}")

    with zipfile.ZipFile(OMNI, "r") as zin, zipfile.ZipFile(
        tmp, "w", compression=zipfile.ZIP_STORED
    ) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename in resolved:
                data = resolved[info.filename].read_bytes()
                print("patched", info.filename)
            new_info = zipfile.ZipInfo(
                filename=info.filename, date_time=info.date_time
            )
            new_info.compress_type = zipfile.ZIP_STORED
            new_info.external_attr = info.external_attr
            zout.writestr(new_info, data)

    tmp.replace(OMNI)
    print("wrote", OMNI)


def main() -> None:
    kill_astra()
    patch_omni()


if __name__ == "__main__":
    main()
