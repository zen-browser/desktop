#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent.parent

REQUIRED_ASSETS = (
    "wizWatermark.bmp",
    "wizHeader.bmp",
    "wizHeaderRTL.bmp",
)


def fail(message: str) -> None:
    print(f"[installer-branding-check] ERROR: {message}")
    sys.exit(1)


def read_text(rel_path: str) -> str:
    path = ROOT / rel_path
    if not path.exists():
        fail(f"Missing file: {rel_path}")
    return path.read_text(encoding="utf-8")


def ensure_assets() -> None:
    for channel in ("release", "twilight"):
        brand_dir = ROOT / "configs" / "branding" / channel
        for asset in REQUIRED_ASSETS:
            target = brand_dir / asset
            if not target.exists():
                fail(f"Missing required installer asset: {target}")


def ensure_sidebar_patch() -> None:
    rel = "src/browser/installer/windows/nsis/sidebar-branding.patch"
    content = read_text(rel)
    if "diff --git a/browser/installer/windows/nsis/installer.nsi b/browser/installer/windows/nsis/installer.nsi" not in content:
        fail(f"Unexpected patch target in {rel}")
    if '+  "Astra Browser"' not in content:
        fail(f'Astra branding line missing in {rel}')


def ensure_custom_properties_patch() -> None:
    rel = "src/browser/locales/en-US/installer/custom-properties.patch"
    content = read_text(rel)
    if "+UN_SURVEY_CHECKBOX_LABEL=Tell Astra Team why you uninstalled $BrandShortName" not in content:
        fail(f"Astra uninstall survey line missing in {rel}")


def ensure_no_legacy_keywords() -> None:
    # Check active (+) lines from installer patch files so we don't fail on removed (-) lines.
    files_to_check = (
        "src/browser/installer/windows/nsis/sidebar-branding.patch",
        "src/browser/locales/en-US/installer/custom-properties.patch",
    )
    banned = (
        "zen browser",
        "nightly",
    )

    for rel in files_to_check:
        content = read_text(rel)
        active_lines = []
        for line in content.splitlines():
            if line.startswith("+++ ") or line.startswith("--- "):
                continue
            if line.startswith("+"):
                active_lines.append(line[1:])
        active_blob = "\n".join(active_lines).lower()

        for word in banned:
            if re.search(rf"\b{re.escape(word)}\b", active_blob):
                fail(f'Found banned keyword "{word}" in active lines of {rel}')


def main() -> None:
    ensure_assets()
    ensure_sidebar_patch()
    ensure_custom_properties_patch()
    ensure_no_legacy_keywords()
    print("[installer-branding-check] OK")


if __name__ == "__main__":
    main()
