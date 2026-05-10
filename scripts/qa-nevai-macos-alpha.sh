#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP="$ROOT/engine/obj-aarch64-apple-darwin/dist/Nevai.app"
LOG="/tmp/nevai-start.log"

if [ ! -d "$APP" ]; then
  echo "ERROR: Missing app bundle:"
  echo "  $APP"
  echo "Run ./scripts/build-nevai-macos-alpha.sh first."
  exit 1
fi

echo "== Nevai macOS alpha QA =="

echo "== App identity =="
plutil -p "$APP/Contents/Info.plist" | rg "CFBundleName|CFBundleIdentifier|CFBundleExecutable|Nightly|Zen|Nevai" || true

echo
echo "== application.ini identity =="
cat "$APP/Contents/Resources/application.ini" | rg "Vendor|Name|Profile|AppUpdate|Update" || true

echo
echo "== Actor files must be real files, not symlinks =="
ACTORS="$APP/Contents/Resources/browser/actors"
for f in "$ACTORS"/ZenBoosts*.sys.mjs "$ACTORS"/ZenGlance*.sys.mjs; do
  [ -e "$f" ] || {
    echo "ERROR: Missing actor file pattern in $ACTORS"
    exit 1
  }

  if [ -L "$f" ]; then
    echo "ERROR: actor is still a symlink:"
    echo "  $f -> $(readlink "$f")"
    exit 1
  fi

  echo "OK real file: $f"
done

echo
echo "== Launching app and capturing runtime log =="
pkill -f "Contents/MacOS/nevai" || true
rm -f "$LOG"

npm start 2>&1 | tee "$LOG" &
PID=$!

echo "Waiting for app startup..."
sleep 12

echo
echo "== Runtime blocker grep =="
BLOCKERS='Failed to load resource:///actors|ZenBoostsChild|ZenGlanceChild|updates.zen-browser.app|designed by Mozilla|AppUpdater|resource://gre/modules/AppUpdater.sys.mjs'

if rg "$BLOCKERS" "$LOG"; then
  echo
  echo "ERROR: Runtime blocker found."
  kill "$PID" 2>/dev/null || true
  exit 1
fi

echo "Runtime blocker grep clean."

echo
echo "== Manual QA still required =="
cat <<'EOF'
Open Nevai and confirm:
1. App launches as Nevai.
2. Dock icon is Nevai.
3. About dialog says Nevai.
4. About dialog contains Mozilla-independent wording.
5. Settings opens.
6. Privacy & Security opens.
7. General opens.
8. google.com opens.
9. youtube.com opens.
10. github.com opens.
11. Private window opens.
12. Download works.
13. Close/reopen preserves local profile.
EOF

echo
echo "QA script passed automated checks."
