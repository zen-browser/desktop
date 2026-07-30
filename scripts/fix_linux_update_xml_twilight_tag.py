#!/usr/bin/env python3
"""Rewrite Surfer twilight AUS URLs to match GitHub release tag twilight-1.

Surfer's generateBrowserUpdateFiles uses download tag `twilight`, but the
Astra Release job publishes twilight assets under tag `twilight-1`. Windows
XML already uses twilight-1 via generate_windows_update_xml.mjs.
"""

from __future__ import annotations

import pathlib
import sys


OLD = "/releases/download/twilight/"
NEW = "/releases/download/twilight-1/"


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(f"usage: {sys.argv[0]} UPDATE_ROOT_DIR", file=sys.stderr)
        return 2
    root = pathlib.Path(argv[0])
    if not root.is_dir():
        print(f"missing update root: {root}", file=sys.stderr)
        return 1
    changed = 0
    for path in root.rglob("update.xml"):
        text = path.read_text(encoding="utf-8")
        if OLD not in text:
            continue
        path.write_text(text.replace(OLD, NEW), encoding="utf-8", newline="\n")
        changed += 1
        print(f"fixed twilight tag in {path}")
    print(f"twilight tag fix: {changed} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
