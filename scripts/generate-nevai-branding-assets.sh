#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/product/brand/assets/source/nevai-logo.svg"
GEN="$ROOT/product/brand/assets/generated"

if [ ! -f "$SRC" ]; then
  echo "Missing source logo: $SRC"
  exit 1
fi

mkdir -p "$GEN"

echo "Generating PNG sizes from: $SRC"

for size in 16 22 24 32 48 64 70 128 150 256 512 1024; do
  magick -background none "$SRC" \
    -resize "${size}x${size}" \
    -gravity center \
    -extent "${size}x${size}" \
    "$GEN/logo${size}.png"
done

cp "$GEN/logo256.png" "$GEN/logo.png"
cp "$GEN/logo1024.png" "$GEN/logo-mac.png"

cp "$GEN/logo128.png" "$GEN/about-logo.png"
cp "$GEN/logo256.png" "$GEN/about-logo@2x.png"

cp "$GEN/logo150.png" "$GEN/PrivateBrowsing_150.png"
cp "$GEN/logo70.png" "$GEN/PrivateBrowsing_70.png"

cp "$GEN/logo150.png" "$GEN/VisualElements_150.png"
cp "$GEN/logo70.png" "$GEN/VisualElements_70.png"

magick "$GEN/logo16.png" "$GEN/logo32.png" "$GEN/logo48.png" "$GEN/logo64.png" "$GEN/logo128.png" "$GEN/logo256.png" "$GEN/firefox.ico"

cp "$GEN/firefox.ico" "$GEN/firefox64.ico"
cp "$GEN/firefox.ico" "$GEN/document.ico"
cp "$GEN/firefox.ico" "$GEN/document_pdf.ico"
cp "$GEN/firefox.ico" "$GEN/pbmode.ico"

echo "Applying generated branding assets to release and twilight..."

for brand in release twilight; do
  DIR="$ROOT/configs/branding/$brand"
  CONTENT="$DIR/content"

  cp "$GEN/logo16.png" "$DIR/logo16.png"
  cp "$GEN/logo22.png" "$DIR/logo22.png"
  cp "$GEN/logo24.png" "$DIR/logo24.png"
  cp "$GEN/logo32.png" "$DIR/logo32.png"
  cp "$GEN/logo48.png" "$DIR/logo48.png"
  cp "$GEN/logo64.png" "$DIR/logo64.png"
  cp "$GEN/logo128.png" "$DIR/logo128.png"
  cp "$GEN/logo256.png" "$DIR/logo256.png"
  cp "$GEN/logo512.png" "$DIR/logo512.png"
  cp "$GEN/logo1024.png" "$DIR/logo1024.png"
  cp "$GEN/logo.png" "$DIR/logo.png"
  cp "$GEN/logo-mac.png" "$DIR/logo-mac.png"

  cp "$GEN/VisualElements_70.png" "$DIR/VisualElements_70.png"
  cp "$GEN/VisualElements_150.png" "$DIR/VisualElements_150.png"
  cp "$GEN/PrivateBrowsing_70.png" "$DIR/PrivateBrowsing_70.png"
  cp "$GEN/PrivateBrowsing_150.png" "$DIR/PrivateBrowsing_150.png"

  cp "$GEN/firefox.ico" "$DIR/firefox.ico"
  cp "$GEN/firefox64.ico" "$DIR/firefox64.ico"
  cp "$GEN/document.ico" "$DIR/document.ico"
  cp "$GEN/document_pdf.ico" "$DIR/document_pdf.ico"
  cp "$GEN/pbmode.ico" "$DIR/pbmode.ico"

  cp "$GEN/about-logo.png" "$CONTENT/about-logo.png"
  cp "$GEN/about-logo@2x.png" "$CONTENT/about-logo@2x.png"
  cp "$GEN/about-logo.png" "$CONTENT/about-logo-private.png"
  cp "$GEN/about-logo@2x.png" "$CONTENT/about-logo-private@2x.png"

  cp "$SRC" "$CONTENT/about-logo.svg"
  cp "$SRC" "$CONTENT/about-logo-private.svg"
done

echo "Done."
