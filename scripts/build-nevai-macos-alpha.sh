#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Nevai macOS alpha build =="

echo "== Applying generated About dialog branding patch =="
./scripts/apply-nevai-about-dialog-branding.sh

echo "== Syncing en-US locale packs =="
python3 ./scripts/update_en_US_packs.py

echo "== Patching updater Preferences UI for alpha =="
./scripts/patch-nevai-disable-updater-preferences-ui.sh

echo "== Building =="
npm run surfer -- build --skip-patch-check

echo "== Fixing macOS actor packaging symlinks =="
./scripts/fix-nevai-macos-actor-symlinks.sh

echo "== Build complete =="
APP="$ROOT/engine/obj-aarch64-apple-darwin/dist/Nevai.app"

if [ ! -d "$APP" ]; then
  echo "ERROR: Missing app bundle:"
  echo "  $APP"
  exit 1
fi

echo "App:"
echo "  $APP"
