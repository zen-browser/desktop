#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Install a user-local desktop launcher and icon for an unpacked Zen build.

Usage:
  scripts/install-linux-desktop-entry.sh --zen-dir <path-to-unpacked-zen-folder> [--brand <release|twilight>]
EOF
}

ZEN_DIR=""
BRAND="release"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --zen-dir)
      ZEN_DIR="$2"
      shift 2
      ;;
    --brand)
      BRAND="$2"
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

if [[ -z "$ZEN_DIR" ]]; then
  usage
  exit 1
fi

ZEN_DIR="$(readlink -f "$ZEN_DIR")"
ZEN_BIN="$ZEN_DIR/zen"
if [[ ! -x "$ZEN_BIN" ]]; then
  echo "Could not find executable at: $ZEN_BIN" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$BRAND" in
  release)
    APP_NAME="Zen Browser"
    DESKTOP_ID="zen"
    WM_CLASS="zen"
    ;;
  twilight)
    APP_NAME="Zen Twilight"
    DESKTOP_ID="zen-twilight"
    WM_CLASS="zen-twilight"
    ;;
  *)
    echo "Unsupported brand: $BRAND" >&2
    exit 1
    ;;
esac

ICON_CANDIDATES=(
  "$ZEN_DIR/browser/chrome/icons/default/default128.png"
  "$SCRIPT_DIR/../configs/branding/$BRAND/logo128.png"
)

ICON_SRC=""
for candidate in "${ICON_CANDIDATES[@]}"; do
  if [[ -f "$candidate" ]]; then
    ICON_SRC="$candidate"
    break
  fi
done

if [[ -z "$ICON_SRC" ]]; then
  echo "Could not find an icon source. Checked:" >&2
  printf '  - %s\n' "${ICON_CANDIDATES[@]}" >&2
  exit 1
fi

APP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"
DESKTOP_FILE="$APP_DIR/$DESKTOP_ID.desktop"
ICON_TARGET="$ICON_DIR/$DESKTOP_ID.png"

mkdir -p "$APP_DIR" "$ICON_DIR"
cp "$ICON_SRC" "$ICON_TARGET"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=$APP_NAME
Comment=Experience tranquillity while browsing the web without people tracking you!
Exec=$ZEN_BIN %u
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
Exec=$ZEN_BIN %u

[Desktop Action new-blank-window]
Name=Open a New Blank Window
Exec=$ZEN_BIN --blank-window %u

[Desktop Action new-private-window]
Name=Open a New Private Window
Exec=$ZEN_BIN --private-window %u

[Desktop Action profilemanager]
Name=Open the Profile Manager
Exec=$ZEN_BIN --ProfileManager %u
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR" || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q "$HOME/.local/share/icons/hicolor" || true
fi

echo "Installed desktop entry: $DESKTOP_FILE"
echo "Installed icon: $ICON_TARGET"
echo "Search for '$APP_NAME' in your app launcher and pin it to the taskbar."