#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="$ROOT/product/brand/assets/generated"
MACOS="$GEN/macos/firefox.icns"
UNOFFICIAL="$ROOT/engine/browser/branding/unofficial"
CONTENT="$UNOFFICIAL/content"

if [ ! -d "$UNOFFICIAL" ]; then
  echo "Missing unofficial branding folder: $UNOFFICIAL"
  echo "Run npm run init first."
  exit 1
fi

if [ ! -f "$GEN/logo1024.png" ]; then
  echo "Missing generated assets. Run:"
  echo "  ./scripts/generate-nevai-branding-assets.sh"
  exit 1
fi

if [ ! -f "$MACOS" ]; then
  echo "Missing macOS icns. Run:"
  echo "  ./scripts/generate-nevai-macos-icns.sh"
  exit 1
fi

echo "Applying Nevai assets to engine/browser/branding/unofficial for LOCAL PREVIEW ONLY..."

cp "$GEN/logo16.png" "$UNOFFICIAL/default16.png"
cp "$GEN/logo22.png" "$UNOFFICIAL/default22.png"
cp "$GEN/logo24.png" "$UNOFFICIAL/default24.png"
cp "$GEN/logo32.png" "$UNOFFICIAL/default32.png"
cp "$GEN/logo48.png" "$UNOFFICIAL/default48.png"
cp "$GEN/logo64.png" "$UNOFFICIAL/default64.png"
cp "$GEN/logo128.png" "$UNOFFICIAL/default128.png"
cp "$GEN/logo256.png" "$UNOFFICIAL/default256.png"
cp "$GEN/logo512.png" "$UNOFFICIAL/default512.png" 2>/dev/null || true

cp "$GEN/VisualElements_70.png" "$UNOFFICIAL/VisualElements_70.png"
cp "$GEN/VisualElements_150.png" "$UNOFFICIAL/VisualElements_150.png"
cp "$GEN/PrivateBrowsing_70.png" "$UNOFFICIAL/PrivateBrowsing_70.png"
cp "$GEN/PrivateBrowsing_150.png" "$UNOFFICIAL/PrivateBrowsing_150.png"

cp "$GEN/firefox.ico" "$UNOFFICIAL/firefox.ico"
cp "$GEN/firefox64.ico" "$UNOFFICIAL/firefox64.ico"
cp "$GEN/document.ico" "$UNOFFICIAL/document.ico"
cp "$GEN/document_pdf.ico" "$UNOFFICIAL/document_pdf.ico"
cp "$GEN/pbmode.ico" "$UNOFFICIAL/pbmode.ico"

cp "$MACOS" "$UNOFFICIAL/firefox.icns"
cp "$MACOS" "$UNOFFICIAL/document.icns"
cp "$MACOS" "$UNOFFICIAL/disk.icns"

cp "$GEN/about-logo.png" "$CONTENT/about-logo.png"
cp "$GEN/about-logo@2x.png" "$CONTENT/about-logo@2x.png"
cp "$GEN/about-logo.png" "$CONTENT/about-logo-private.png"
cp "$GEN/about-logo@2x.png" "$CONTENT/about-logo-private@2x.png"
cp "$ROOT/product/brand/assets/source/nevai-logo.svg" "$CONTENT/about-logo.svg"
cp "$ROOT/product/brand/assets/source/nevai-logo.svg" "$CONTENT/about-logo-private.svg"

echo "Done applying local unofficial preview assets."
