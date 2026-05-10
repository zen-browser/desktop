#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

APP="${1:-engine/obj-aarch64-apple-darwin/dist/Nevai.app}"

# Convert relative app path to absolute path.
case "$APP" in
  /*) ;;
  *) APP="$REPO_ROOT/$APP" ;;
esac

ACTORS_DIR="$APP/Contents/Resources/browser/actors"

if [[ ! -d "$ACTORS_DIR" ]]; then
  echo "Missing actors directory: $ACTORS_DIR" >&2
  exit 1
fi

copy_actor() {
  src="$REPO_ROOT/$1"
  dest="$ACTORS_DIR/$2"

  if [[ ! -f "$src" ]]; then
    echo "Missing source actor file: $src" >&2
    exit 1
  fi

  rm -f "$dest"
  cp "$src" "$dest"
  chmod 0644 "$dest"

  if [[ -L "$dest" ]]; then
    echo "Still symlink after copy: $dest" >&2
    exit 1
  fi

  if [[ ! -f "$dest" ]]; then
    echo "Copy failed: $dest" >&2
    exit 1
  fi

  echo "Copied real file: $dest"
}

copy_actor "engine/zen/boosts/actors/ZenBoostsChild.sys.mjs" "ZenBoostsChild.sys.mjs"
copy_actor "engine/zen/boosts/actors/ZenBoostsParent.sys.mjs" "ZenBoostsParent.sys.mjs"
copy_actor "engine/zen/glance/actors/ZenGlanceChild.sys.mjs" "ZenGlanceChild.sys.mjs"
copy_actor "engine/zen/glance/actors/ZenGlanceParent.sys.mjs" "ZenGlanceParent.sys.mjs"

echo
echo "Final verification:"
ls -la \
  "$ACTORS_DIR/ZenBoostsChild.sys.mjs" \
  "$ACTORS_DIR/ZenBoostsParent.sys.mjs" \
  "$ACTORS_DIR/ZenGlanceChild.sys.mjs" \
  "$ACTORS_DIR/ZenGlanceParent.sys.mjs"

echo
echo "Symlink check should print nothing:"
find "$ACTORS_DIR" \
  \( -name "ZenBoostsChild.sys.mjs" \
  -o -name "ZenBoostsParent.sys.mjs" \
  -o -name "ZenGlanceChild.sys.mjs" \
  -o -name "ZenGlanceParent.sys.mjs" \) \
  -type l \
  -print

echo "Done."
