#!/usr/bin/env python3
"""In-place update of browser/omni.ja App Hub modules for local Marionette QA."""

from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

ROOT = Path(r"c:\ZenFork\astradesktop\.tmp-tb-diag\astra-run")
OMNI = ROOT / "browser" / "omni.ja"
BACKUP = Path(r"c:\ZenFork\astradesktop\.tmp-tb-diag\browser-omni.ja.bak-apphub-dnd")
TMP = Path(r"c:\ZenFork\astradesktop\.tmp-tb-diag\browser-omni-apphub-dnd.ja")
SRC = Path(r"c:\ZenFork\astradesktop\src")
LOCALE = Path(r"c:\ZenFork\astradesktop\locales\en-US\browser\browser\zen-app-hub.ftl")
INSTALLED = Path(r"C:\Program Files\Astra Browser\browser\omni.ja")

REPLACEMENTS = {
    "chrome/browser/content/browser/zen-components/AstraAppHubState.mjs": SRC
    / "zen/common/modules/AstraAppHubState.mjs",
    "chrome/browser/content/browser/zen-components/AstraAppHubManager.mjs": SRC
    / "zen/common/modules/AstraAppHubManager.mjs",
    "chrome/browser/content/browser/zen-components/AstraAppHubIcons.mjs": SRC
    / "zen/common/modules/AstraAppHubIcons.mjs",
    "chrome/browser/content/browser/zen-components/AstraAppHubCatalog.mjs": SRC
    / "zen/common/app-hub/AstraAppHubCatalog.mjs",
    "chrome/browser/content/browser/zen-styles/astra-app-hub.css": SRC
    / "zen/common/styles/astra-app-hub.css",
}


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    if not (ROOT / "astra.exe").exists():
        raise SystemExit(f"missing astra-run tree at {ROOT}")

    shutil.copy2(INSTALLED, OMNI)
    print("synced from", INSTALLED)

    if not BACKUP.exists():
        shutil.copy2(OMNI, BACKUP)
        print("backup", BACKUP)

    if TMP.exists():
        TMP.unlink()

    # Locale FTL may live under localization paths that vary by build.
    ftl_candidates = [
        "localization/en-US/browser/zen-app-hub.ftl",
        "chrome/en-US/locale/browser/zen-app-hub.ftl",
    ]

    replace_names = set(REPLACEMENTS)
    with zipfile.ZipFile(OMNI, "r") as zin:
        names = set(zin.namelist())
        for rel in list(replace_names):
            if rel not in names:
                hits = [n for n in names if Path(n).name == Path(rel).name]
                if hits:
                    print("remap", rel, "->", hits[0])
                    REPLACEMENTS[hits[0]] = REPLACEMENTS.pop(rel)
                    replace_names.discard(rel)
                    replace_names.add(hits[0])
                else:
                    raise SystemExit(f"missing {rel}; hits={hits[:20]}")
        ftl_in_omni = None
        for cand in ftl_candidates:
            if cand in names:
                ftl_in_omni = cand
                break
        if not ftl_in_omni:
            hits = [n for n in names if n.endswith("zen-app-hub.ftl")]
            ftl_in_omni = hits[0] if hits else None
        if ftl_in_omni and LOCALE.exists():
            REPLACEMENTS[ftl_in_omni] = LOCALE
            replace_names.add(ftl_in_omni)
            print("ftl target", ftl_in_omni)

    with zipfile.ZipFile(OMNI, "r") as zin, zipfile.ZipFile(
        TMP, "w", compression=zipfile.ZIP_STORED
    ) as zout:
        for item in zin.infolist():
            if item.filename in replace_names:
                data = REPLACEMENTS[item.filename].read_bytes()
                info = zipfile.ZipInfo(item.filename)
                info.compress_type = zipfile.ZIP_STORED
                info.external_attr = item.external_attr
                zout.writestr(info, data)
                print("replaced", item.filename, "bytes", len(data))
            else:
                zout.writestr(item, zin.read(item.filename))

    shutil.copy2(TMP, OMNI)
    print("wrote", OMNI, "size", OMNI.stat().st_size)


if __name__ == "__main__":
    main()
