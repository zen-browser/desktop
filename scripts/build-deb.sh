#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Build a Debian package from a Zen Linux archive.

Usage:
  scripts/build-deb.sh --archive <zen.linux-ARCH.tar.xz> --arch <x86_64|aarch64> --version <version> [--brand <release|twilight>] [--out-dir <dir>]
EOF
}

ARCHIVE=""
ARCH=""
VERSION=""
BRAND="release"
OUT_DIR="dist"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive)
      ARCHIVE="$2"
      shift 2
      ;;
    --arch)
      ARCH="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --brand)
      BRAND="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$ARCHIVE" || -z "$ARCH" || -z "$VERSION" ]]; then
  usage
  exit 1
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
fi

case "$ARCH" in
  x86_64)
    DEB_ARCH="amd64"
    ;;
  aarch64)
    DEB_ARCH="arm64"
    ;;
  *)
    echo "Unsupported arch: $ARCH" >&2
    exit 1
    ;;
esac

case "$BRAND" in
  release)
    PKG_NAME="zen-browser"
    APP_NAME="Zen Browser"
    BIN_NAME="zen"
    DESKTOP_ID="zen"
    WM_CLASS="zen"
    ;;
  twilight)
    PKG_NAME="zen-twilight"
    APP_NAME="Zen Twilight"
    BIN_NAME="zen-twilight"
    DESKTOP_ID="zen-twilight"
    WM_CLASS="zen-twilight"
    ;;
  *)
    echo "Unsupported brand: $BRAND" >&2
    exit 1
    ;;
esac

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

STAGE_ROOT="$WORKDIR/stage"
SRC_ROOT="$WORKDIR/src"
OPT_DIR="$STAGE_ROOT/opt/$PKG_NAME"
DEBIAN_DIR="$STAGE_ROOT/DEBIAN"

mkdir -p "$SRC_ROOT" "$OPT_DIR" "$DEBIAN_DIR"
tar -xf "$ARCHIVE" -C "$SRC_ROOT"

if [[ ! -d "$SRC_ROOT/zen" ]]; then
  echo "Expected top-level 'zen' directory in archive." >&2
  exit 1
fi

cp -a "$SRC_ROOT/zen/." "$OPT_DIR/"

mkdir -p "$STAGE_ROOT/usr/bin"
ln -s "/opt/$PKG_NAME/zen" "$STAGE_ROOT/usr/bin/$BIN_NAME"

mkdir -p "$STAGE_ROOT/usr/share/applications"
cat > "$STAGE_ROOT/usr/share/applications/$DESKTOP_ID.desktop" <<EOF
[Desktop Entry]
Name=$APP_NAME
Comment=Experience tranquillity while browsing the web without people tracking you!
Exec=$BIN_NAME %u
Icon=$DESKTOP_ID
Type=Application
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;application/x-xpinstall;application/pdf;application/json;
StartupWMClass=$WM_CLASS
Categories=Network;WebBrowser;
StartupNotify=true
Terminal=false
X-MultipleArgs=false
Keywords=Internet;WWW;Browser;Web;Explorer;
Actions=new-window;new-blank-window;new-private-window;profilemanager;

[Desktop Action new-window]
Name=Open a New Window
Exec=$BIN_NAME %u

[Desktop Action new-blank-window]
Name=Open a New Blank Window
Exec=$BIN_NAME --blank-window %u

[Desktop Action new-private-window]
Name=Open a New Private Window
Exec=$BIN_NAME --private-window %u

[Desktop Action profilemanager]
Name=Open the Profile Manager
Exec=$BIN_NAME --ProfileManager %u
EOF

for size in 16 22 24 32 48 64 128 256 512; do
  mkdir -p "$STAGE_ROOT/usr/share/icons/hicolor/${size}x${size}/apps"
  cp "configs/branding/$BRAND/logo${size}.png" "$STAGE_ROOT/usr/share/icons/hicolor/${size}x${size}/apps/$DESKTOP_ID.png"
done

cat > "$DEBIAN_DIR/control" <<EOF
Package: $PKG_NAME
Version: $VERSION
Section: web
Priority: optional
Architecture: $DEB_ARCH
Maintainer: Zen OSS Team <support@zen-browser.app>
Depends: libasound2, libdbus-1-3, libgtk-3-0
Recommends: libcanberra0
Description: $APP_NAME
 Zen is a Firefox-based browser focused on productivity and privacy.
EOF

cat > "$DEBIAN_DIR/postinst" <<'EOF'
#!/usr/bin/env bash
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q /usr/share/icons/hicolor || true
fi
EOF

cat > "$DEBIAN_DIR/postrm" <<'EOF'
#!/usr/bin/env bash
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q /usr/share/icons/hicolor || true
fi
EOF

chmod 755 "$DEBIAN_DIR/postinst" "$DEBIAN_DIR/postrm"

mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/${PKG_NAME}_${VERSION}_${DEB_ARCH}.deb"
dpkg-deb --build --root-owner-group "$STAGE_ROOT" "$OUT_FILE"

echo "Created $OUT_FILE"