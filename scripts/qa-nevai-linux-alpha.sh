#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

find_dist_bin() {
  find "$ROOT/engine" -path '*/dist/bin/application.ini' -type f 2>/dev/null \
    | sort \
    | tail -n 1 \
    | xargs -r dirname
}

DIST_BIN="${1:-}"
if [ -z "$DIST_BIN" ]; then
  DIST_BIN="$(find_dist_bin)"
fi

[ -n "$DIST_BIN" ] || fail "Could not find Linux dist/bin output. Run Linux build discovery first."
[ -d "$DIST_BIN" ] || fail "Missing dist/bin directory: $DIST_BIN"
[ -f "$DIST_BIN/application.ini" ] || fail "Missing application.ini in $DIST_BIN"

echo "== Nevai Linux alpha QA =="
echo "dist/bin: $DIST_BIN"

echo
echo "== application.ini identity =="
grep -E '^(Vendor|Name|RemotingName|Profile|EnableProfileMigrator)=' "$DIST_BIN/application.ini" || true

grep -q '^Vendor=Nevai$' "$DIST_BIN/application.ini" || fail "application.ini Vendor is not Nevai"
grep -q '^Name=Nevai$' "$DIST_BIN/application.ini" || fail "application.ini Name is not Nevai"
grep -q '^Profile=nevai$' "$DIST_BIN/application.ini" || fail "application.ini Profile is not nevai"

if grep -q '^\[AppUpdate\]' "$DIST_BIN/application.ini"; then
  fail "application.ini contains active AppUpdate section"
fi

if grep -R "updates\.zen-browser\.app" "$DIST_BIN" >/dev/null 2>&1; then
  fail "Found Zen update host in Linux dist/bin"
fi

echo
echo "== executable identity =="
if [ -x "$DIST_BIN/nevai" ]; then
  echo "OK executable: $DIST_BIN/nevai"
else
  echo "Available executable candidates:"
  find "$DIST_BIN" -maxdepth 1 -type f -perm -111 -print | sort || true
  fail "Expected executable is missing or not executable: $DIST_BIN/nevai"
fi

echo
echo "== actor files =="
ACTORS="$DIST_BIN/browser/actors"
[ -d "$ACTORS" ] || fail "Missing browser actors directory: $ACTORS"

for actor in \
  ZenBoostsChild.sys.mjs \
  ZenBoostsParent.sys.mjs \
  ZenGlanceChild.sys.mjs \
  ZenGlanceParent.sys.mjs
do
  [ -f "$ACTORS/$actor" ] || fail "Missing actor: $ACTORS/$actor"
  echo "OK actor: $ACTORS/$actor"
done

echo
echo "== optional runtime launch =="
if [ "${NEVAI_LINUX_QA_LAUNCH:-0}" = "1" ]; then
  LOG="${NEVAI_LINUX_QA_LOG:-/tmp/nevai-linux-alpha-start.log}"
  rm -f "$LOG"

  if command -v xvfb-run >/dev/null 2>&1; then
    timeout 45s xvfb-run -a "$DIST_BIN/nevai" --headless > "$LOG" 2>&1 || true
  else
    timeout 45s "$DIST_BIN/nevai" --headless > "$LOG" 2>&1 || true
  fi

  if grep -E 'Failed to load resource:///actors|ZenBoostsChild|ZenGlanceChild|updates\.zen-browser\.app|AppUpdater' "$LOG"; then
    fail "Runtime blocker found in $LOG"
  fi

  echo "Runtime blocker grep clean: $LOG"
else
  echo "Skipped. Set NEVAI_LINUX_QA_LAUNCH=1 to attempt a headless launch."
fi

echo
echo "Linux alpha QA static checks passed."
