#!/usr/bin/env bash
# Build a .deb package from the pre-built Linux tar.xz artifact.
# Usage: ./scripts/package-linux-deb.sh <version> <arch> <tarball>
#   arch: amd64 | arm64

set -euo pipefail

VERSION="$1"
ARCH="$2"      # amd64 | arm64
TARBALL="$3"   # path to zen.linux-<arch>.tar.xz

DEB_ARCH="$ARCH"
PKGDIR="$(mktemp -d)/zen-browser_${VERSION}_${DEB_ARCH}"
INSTDIR="${PKGDIR}/usr/lib/zen"

echo ">>> Preparing package directory"
cp -a build/linux/deb/. "$PKGDIR/"

echo ">>> Extracting browser binaries"
mkdir -p "$INSTDIR"
tar -xf "$TARBALL" -C "$INSTDIR" --strip-components=1

echo ">>> Installing desktop entry and icons"
mkdir -p "${PKGDIR}/usr/share/applications"
mkdir -p "${PKGDIR}/usr/share/icons/hicolor/128x128/apps"

sed "s/\$VERSION/${VERSION}/g" build/AppDir/zen.desktop \
  > "${PKGDIR}/usr/share/applications/zen-browser.desktop"

# Icon: use the one bundled in the browser directory
ICON_SRC=$(find "$INSTDIR" -name "*.png" -path "*/icons/*128*" | head -1)
if [ -n "$ICON_SRC" ]; then
  cp "$ICON_SRC" "${PKGDIR}/usr/share/icons/hicolor/128x128/apps/zen.png"
fi

echo ">>> Creating /usr/bin symlink"
mkdir -p "${PKGDIR}/usr/bin"
ln -sf /usr/lib/zen/zen "${PKGDIR}/usr/bin/zen"

echo ">>> Creating native-messaging-hosts directory"
mkdir -p "${PKGDIR}/usr/lib/zen/native-messaging-hosts"

echo ">>> Filling in control file"
INSTALLED_SIZE=$(du -sk "$INSTDIR" | cut -f1)
sed -i \
  -e "s/VERSION/${VERSION}/" \
  -e "s/ARCH/${DEB_ARCH}/" \
  -e "s/INSTALLED_SIZE/${INSTALLED_SIZE}/" \
  "${PKGDIR}/DEBIAN/control"

chmod 755 "${PKGDIR}/DEBIAN/postinst" "${PKGDIR}/DEBIAN/prerm"

echo ">>> Building .deb"
mkdir -p dist
dpkg-deb --build --root-owner-group "$PKGDIR" \
  "dist/zen-browser_${VERSION}_${DEB_ARCH}.deb"

echo ">>> Done: dist/zen-browser_${VERSION}_${DEB_ARCH}.deb"
