#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

set -euo pipefail

APPDIR=$(realpath "${1:?AppDir path is required}")
ARCH=${2:?Architecture is required}
if [[ $(uname -m) != "$ARCH" ]]; then
  echo "Dependency bundling must run on a native $ARCH host" >&2
  exit 1
fi

case "$ARCH" in
  x86_64) SHARUN_SHA256=f35d4f59f2e0b1a5ec12ef126d78197fd4fd14c6f99b4b16dee6a5ddad6baa93 ;;
  aarch64) SHARUN_SHA256=bf3b8cc04e3025ef9dcd2718ee4728ccc68c941dadeeac7fdf778fc2c99d8b31 ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

SYSLIBS="/usr/lib/$ARCH-linux-gnu"
cd "$APPDIR"

# Keep the AppImage update policy beside the relocated browser executable.
mkdir -p ./bin/distribution
cp -a ./distribution/. ./bin/distribution/
wget -q "https://github.com/VHSgunzo/sharun/releases/download/v0.8.1/sharun-$ARCH-aio" -O sharun-aio
printf '%s  sharun-aio\n' "$SHARUN_SHA256" | sha256sum -c -
chmod +x sharun-aio

# Optional driver/module directories vary by architecture. Do not pass unmatched
# patterns to lib4bin. Include dlopen dependencies as well as linked libraries.
shopt -s nullglob
./sharun-aio l -p -v -s -k \
  ./bin/zen ./bin/zen-bin ./bin/*test ./bin/pingsender ./bin/updater \
  ./bin/lib* \
  "$SYSLIBS"/lib*GL* "$SYSLIBS"/dri/* "$SYSLIBS"/libpci.so* \
  "$SYSLIBS"/libxcb-* "$SYSLIBS"/libXcursor.so* "$SYSLIBS"/libXinerama* \
  "$SYSLIBS"/libwayland* "$SYSLIBS"/libnss* "$SYSLIBS"/libsoftokn3.so \
  "$SYSLIBS"/libfreeblpriv3.so "$SYSLIBS"/libgtk* "$SYSLIBS"/libgdk* \
  "$SYSLIBS"/libcanberra* "$SYSLIBS"/gdk-pixbuf-*/*/loaders/* \
  "$SYSLIBS"/libcloudproviders* "$SYSLIBS"/gconv/* "$SYSLIBS"/pkcs11/* \
  "$SYSLIBS"/gvfs/* "$SYSLIBS"/libcanberra*/* "$SYSLIBS"/gio/modules/* \
  "$SYSLIBS"/pulseaudio/* "$SYSLIBS"/alsa-lib/* \
  "$SYSLIBS"/libavcodec.so* "$SYSLIBS"/libavutil.so*
rm sharun-aio
./sharun -g

# Firefox also looks beside its executable for dynamically loaded libraries.
# Keep Firefox's own libraries when a bundled system library has the same name.
for library in ./shared/lib/lib*; do
  destination="./bin/$(basename "$library")"
  if [[ ! -e "$destination" && ! -L "$destination" ]]; then
    ln -sr "$library" "$destination"
  fi
done

test -x ./bin/zen
test -x ./bin/gfxtest
test -d ./shared/bin
test -f ./shared/lib/libc.so.6
