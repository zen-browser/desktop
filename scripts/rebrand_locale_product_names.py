#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""Rebrand leftover Firefox/Zen product names in Astra locale files."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "locales"

BRANDING_TERMS = """\
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Override Firefox-hardcoded product names that refer to this browser.

-firefoxlabs-brand-name = { -brand-short-name } Labs
-firefoxview-brand-name = { -brand-short-name } View
-firefox-home-brand-name = { -brand-short-name } Home
"""

# Message IDs whose value names this browser (not Firefox-the-other-app).
PRODUCT_IDS = (
    "zen-toggle-sidebar-shortcut",
    "zen-welcome-finished",
    "zen-webpanel-introduction-title",
    "zen-webpanel-introduction-description",
    "zen-theme-marketplace-header",
    "pane-zen-marketplace-title",
    "zen-urlbar-title",
    "zenCKSOption-group-zen-other",
    "zen-window-sync-migration-dialog-message",
    "extension-firefox-compact-galaxy-name",
    "extension-firefox-compact-dream-name",
    "zen-quit-app-shortcut",
    "zen-space-routing-rulepanel-placeholder",
)

SKIP_FIREFOX_IDS = {
    # Lists Firefox as another browser to import from.
    "zen-import-chrome-sub",
}

FIREFOX_WORD = re.compile(r"Firefox-|Firefox|Firefoks[a-z]*")
ZEN_WORD = re.compile(
    r"(?:„Zen“|\"Zen\"|'Zen'|‘Zen’|«Zen»|"
    r"(?<![A-Za-z])Zen(?: Browser|-vafrinn|u|-i|in|i)?(?![A-Za-z])|"
    r"ذن|젠)"
)
TOOLTIP_ZEN = re.compile(r"^(\s*\.tooltiptext\s*=\s*)(.*)$")


def rebrand_zen(value: str) -> str:
    def _sub(match: re.Match[str]) -> str:
        token = match.group(0)
        if token in {"ذن"}:
            return "آسترا"
        if token in {"젠"}:
            return "Astra"
        if token.startswith("„"):
            return "„Astra“"
        if token.startswith("«"):
            return "«Astra»"
        if token[0] in "'\"‘":
            return f"{token[0]}Astra{token[-1]}"
        if "Browser" in token:
            return "Astra Browser"
        return "Astra"

    return ZEN_WORD.sub(_sub, value)


def rebrand_firefox_this_browser(value: str) -> str:
    value = value.replace("Firefox-", "Astra-")
    value = re.sub(r"Firefoks[a-z]*", "Astra", value)
    return value.replace("Firefox", "Astra")


def transform_line(line: str, current_id: str | None) -> str:
    stripped = line.lstrip()
    if stripped.startswith("#") or stripped.startswith("##"):
        return line
    if current_id in SKIP_FIREFOX_IDS:
        return line
    if current_id in PRODUCT_IDS:
        if current_id == "zen-toggle-sidebar-shortcut":
            line = rebrand_firefox_this_browser(line)
        line = rebrand_zen(line)
        return line
    tooltip = TOOLTIP_ZEN.match(line.rstrip("\r\n"))
    if tooltip and "Zen" in tooltip.group(2):
        nl = "\n" if line.endswith("\n") else ""
        return tooltip.group(1) + rebrand_zen(tooltip.group(2)) + nl
    return line


def current_message_id(line: str) -> str | None:
    if line.startswith(" ") or line.startswith("\t") or line.startswith("."):
        return None
    if "=" not in line or line.startswith("#"):
        return None
    key = line.split("=", 1)[0].strip()
    if re.fullmatch(r"[A-Za-z0-9_-]+", key):
        return key
    return None


def sweep_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    lines = original.splitlines(keepends=True)
    current = None
    out: list[str] = []
    changed = False
    for line in lines:
        maybe = current_message_id(line)
        if maybe:
            current = maybe
        new = transform_line(line, current)
        if new != line:
            changed = True
        out.append(new)
    if changed:
        path.write_text("".join(out), encoding="utf-8")
    return changed


def write_branding_overlays() -> int:
    count = 0
    for loc_dir in sorted(ROOT.iterdir()):
        if not loc_dir.is_dir():
            continue
        dest_dir = loc_dir / "browser" / "browser"
        if not dest_dir.is_dir():
            continue
        dest = dest_dir / "zen-branding.ftl"
        if loc_dir.name == "en-US":
            continue
        text = BRANDING_TERMS
        if loc_dir.name == "en-GB":
            text += (
                "\n# Urlbar quick action: \"labs\" / \"experiment\"\n"
                "quickactions-labs = Open { -brand-short-name } Labs\n"
            )
        dest.write_text(text, encoding="utf-8")
        count += 1
    return count


def main() -> None:
    overlays = write_branding_overlays()
    changed = 0
    for path in sorted(ROOT.rglob("*.ftl")):
        if path.name == "zen-branding.ftl":
            continue
        if sweep_file(path):
            changed += 1
            print("updated", path.relative_to(ROOT.parent))
    print(f"branding overlays: {overlays}")
    print(f"swept files: {changed}")


if __name__ == "__main__":
    main()
