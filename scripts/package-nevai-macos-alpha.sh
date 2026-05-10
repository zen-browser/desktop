#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP="$ROOT/engine/obj-aarch64-apple-darwin/dist/Nevai.app"
OUT="$ROOT/../builds-local/macos"
ZIP="$OUT/Nevai-macos-alpha-dev.zip"
SHA="$OUT/Nevai-macos-alpha-dev.SHA256.txt"
README="$OUT/README-alpha.txt"

if [ ! -d "$APP" ]; then
  echo "ERROR: Missing app bundle:"
  echo "  $APP"
  echo "Run ./scripts/build-nevai-macos-alpha.sh first."
  exit 1
fi

mkdir -p "$OUT"

echo "== Packaging Nevai macOS unsigned alpha =="
rm -f "$ZIP" "$SHA"

ditto -c -k --keepParent "$APP" "$ZIP"

shasum -a 256 "$ZIP" | tee "$SHA"

cat > "$README" <<EOF
Nevai Browser macOS local unsigned alpha

Status:
- Local development alpha build
- Unsigned
- Not notarized
- Not for public production distribution

Artifact:
- Nevai-macos-alpha-dev.zip

SHA-256:
$(cut -d' ' -f1 "$SHA")

Known limitations:
- macOS may warn because the app is unsigned/not notarized.
- Automatic updater is disabled for alpha.
- This artifact is intended for local/manual testing only.
EOF

echo
echo "Output:"
ls -lh "$OUT"
