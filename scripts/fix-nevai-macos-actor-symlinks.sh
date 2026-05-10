#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/engine/obj-aarch64-apple-darwin/dist/Nevai.app"
ACTORS="$APP/Contents/Resources/browser/actors"

if [ ! -d "$ACTORS" ]; then
  echo "Missing actors directory:"
  echo "  $ACTORS"
  echo "Run the build first."
  exit 1
fi

copy_actor() {
  local src="$1"
  local dst="$2"

  if [ ! -f "$src" ]; then
    echo "Missing source actor:"
    echo "  $src"
    exit 1
  fi

  # Important: remove the destination first.
  # If dst is a symlink, plain cp may overwrite the symlink target instead of
  # replacing the symlink inside Nevai.app.
  rm -f "$dst"
  cp "$src" "$dst"
  chmod 0644 "$dst"
}

echo "Replacing Nevai.app actor symlinks with real files..."

copy_actor \
  "$ROOT/engine/zen/boosts/actors/ZenBoostsChild.sys.mjs" \
  "$ACTORS/ZenBoostsChild.sys.mjs"

copy_actor \
  "$ROOT/engine/zen/boosts/actors/ZenBoostsParent.sys.mjs" \
  "$ACTORS/ZenBoostsParent.sys.mjs"

copy_actor \
  "$ROOT/engine/zen/glance/actors/ZenGlanceChild.sys.mjs" \
  "$ACTORS/ZenGlanceChild.sys.mjs"

copy_actor \
  "$ROOT/engine/zen/glance/actors/ZenGlanceParent.sys.mjs" \
  "$ACTORS/ZenGlanceParent.sys.mjs"

echo
echo "Verification:"
for f in "$ACTORS"/ZenBoosts*.sys.mjs "$ACTORS"/ZenGlance*.sys.mjs; do
  [ -e "$f" ] || continue
  if [ -L "$f" ]; then
    echo "BAD SYMLINK: $f -> $(readlink "$f")"
    exit 1
  else
    echo "OK REAL FILE: $f"
  fi
done

echo
echo "Done. Actor files are now real files inside Nevai.app."
