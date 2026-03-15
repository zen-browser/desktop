#!/usr/bin/env bash
# Build an .rpm package from the pre-built Linux tar.xz artifact.
# Usage: ./scripts/package-linux-rpm.sh <version> <arch> <tarball>
#   arch: x86_64 | aarch64

set -euo pipefail

VERSION="$1"
ARCH="$2"     # x86_64 | aarch64
TARBALL="$3"  # path to zen.linux-<arch>.tar.xz

RPMROOT="$(mktemp -d)/rpmbuild"
mkdir -p "${RPMROOT}"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}

echo ">>> Extracting browser binaries"
mkdir -p "${RPMROOT}/SOURCES/zen"
tar -xf "$TARBALL" -C "${RPMROOT}/SOURCES/zen" --strip-components=1

echo ">>> Copying desktop entry and icon"
sed "s/\$VERSION/${VERSION}/g" build/AppDir/zen.desktop \
  > "${RPMROOT}/SOURCES/zen-browser.desktop"

ICON_SRC=$(find "${RPMROOT}/SOURCES/zen" -name "*.png" -path "*/icons/*128*" | head -1)
if [ -n "$ICON_SRC" ]; then
  cp "$ICON_SRC" "${RPMROOT}/SOURCES/zen.png"
fi

echo ">>> Building .rpm"
mkdir -p dist
rpmbuild -bb build/linux/rpm/zen-browser.spec \
  --define "_topdir ${RPMROOT}" \
  --define "_version ${VERSION}" \
  --define "_target_cpu ${ARCH}"

find "${RPMROOT}/RPMS" -name "*.rpm" -exec cp {} dist/ \;

echo ">>> Done: $(ls dist/*.rpm)"
