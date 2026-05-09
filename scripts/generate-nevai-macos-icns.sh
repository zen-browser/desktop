#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/product/brand/assets/source/nevai-logo.svg"
OUT="$ROOT/product/brand/assets/generated/macos"
ICONSET="$OUT/firefox.iconset"

mkdir -p "$ICONSET"

magick -background none "$SRC" -resize 16x16 "$ICONSET/icon_16x16.png"
magick -background none "$SRC" -resize 32x32 "$ICONSET/icon_16x16@2x.png"
magick -background none "$SRC" -resize 32x32 "$ICONSET/icon_32x32.png"
magick -background none "$SRC" -resize 64x64 "$ICONSET/icon_32x32@2x.png"
magick -background none "$SRC" -resize 128x128 "$ICONSET/icon_128x128.png"
magick -background none "$SRC" -resize 256x256 "$ICONSET/icon_128x128@2x.png"
magick -background none "$SRC" -resize 256x256 "$ICONSET/icon_256x256.png"
magick -background none "$SRC" -resize 512x512 "$ICONSET/icon_256x256@2x.png"
magick -background none "$SRC" -resize 512x512 "$ICONSET/icon_512x512.png"
magick -background none "$SRC" -resize 1024x1024 "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o "$OUT/firefox.icns"

echo "Generated: $OUT/firefox.icns"
