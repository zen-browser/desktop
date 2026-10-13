# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import shutil
from pathlib import Path

from copy_language_pack import copy_browser_locales

SOURCE = Path("locales/en-US/browser")
OVERRIDES = Path("peppermint/locales/en-US/browser")
# Finished strings (Zen + Peppermint layer + rebranding) live in the engine.
ENGINE_PACK = Path("engine/browser/locales/en-US")


def objdir():
  mozconfig = Path("mozconfig")
  if not mozconfig.exists():
    return None
  for line in mozconfig.read_text(encoding="utf-8").splitlines():
    stripped = line.strip()
    if stripped.startswith("#") or "MOZ_OBJDIR=" not in stripped:
      continue
    return Path(stripped.split("=", 1)[1].strip().strip("'\""))
  return None


def sync_into(destination_root: Path):
  """Overlay Peppermint strings onto an already-built en-US localization tree."""
  if not destination_root.is_dir():
    return
  copied = 0
  names = set()
  for base in (SOURCE, OVERRIDES):
    for root, _, files in os.walk(base):
      for file in files:
        names.add((Path(root) / file).relative_to(base))
  for relative in sorted(names):
    finished = ENGINE_PACK / relative
    if not finished.is_file():
      continue
    target = destination_root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    # Built trees often link straight back to the engine copy.
    if not (target.exists() and os.path.samefile(finished, target)):
      shutil.copy2(finished, target)
    copied += 1
  print(f"Synced {copied} locale files to {destination_root}")


def sync_built_app():
  root = objdir()
  if root is None:
    return
  sync_into(root / "dist/bin/browser/localization/en-US")
  dist = root / "dist"
  if not dist.is_dir():
    return
  for app in dist.glob("*.app"):
    sync_into(app / "Contents/Resources/browser/localization/en-US")


if __name__ == "__main__":
  copy_browser_locales("en-US")
  sync_built_app()
