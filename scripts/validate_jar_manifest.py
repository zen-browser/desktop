#!/usr/bin/env python3
"""Fail fast when zen jar.inc.mn entries use wrong source paths.

CI resolves jar sources from engine/browser/base. Bare (styles/...) paths
break packaging with exit code 1 after a long compile.
"""

from __future__ import annotations

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent.parent

ASTRA_CSS = (
    "astra-tabs.css",
    "astra-sidebar.css",
    "astra-workspaces.css",
    "astra-compact.css",
    "astra-patches.css",
)

# Wrong: (styles/astra-tabs.css) — resolved under browser/base/styles/
BAD_ASTRA_SOURCE = re.compile(
    r"content/browser/zen-styles/astra-[\w-]+\.css\s+\(styles/"
)

# Each astra line should use the same prefix as other zen/common styles.
REQUIRED_PREFIX = "../../zen/common/styles/"


def fail(message: str) -> None:
    print(f"[validate-jar-manifest] ERROR: {message}")
    sys.exit(1)


def validate_common_jar_inc_mn() -> None:
    path = ROOT / "src" / "zen" / "common" / "jar.inc.mn"
    if not path.exists():
        fail(f"Missing {path}")

    text = path.read_text(encoding="utf-8")
    for line_no, line in enumerate(text.splitlines(), 1):
        if BAD_ASTRA_SOURCE.search(line):
            fail(
                f"{path}:{line_no}: use ({REQUIRED_PREFIX}<file>) not (styles/<file>)"
            )

    for name in ASTRA_CSS:
        styles_dir = ROOT / "src" / "zen" / "common" / "styles" / name
        if not styles_dir.is_file():
            fail(f"Missing stylesheet: {styles_dir}")

        needle = f"zen-styles/{name}"
        matching = [ln for ln in text.splitlines() if needle in ln]
        if not matching:
            fail(f"No jar.inc.mn entry for {name}")
        for entry in matching:
            if REQUIRED_PREFIX not in entry:
                fail(f"Entry for {name} must include {REQUIRED_PREFIX}: {entry.strip()}")


def main() -> None:
    validate_common_jar_inc_mn()
    print("[validate-jar-manifest] OK")


if __name__ == "__main__":
    main()
