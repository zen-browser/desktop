#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path"
  else
    fail "Missing sha256sum or shasum"
  fi
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

"$ROOT/scripts/qa-nevai-linux-alpha.sh" "$DIST_BIN"

OUT="${NEVAI_LINUX_ALPHA_OUT:-$ROOT/../builds-local/linux}"
ARCHIVE="$OUT/Nevai-linux-alpha-dev.tar.gz"
SHA="$OUT/Nevai-linux-alpha-dev.SHA256.txt"
README="$OUT/README-alpha.txt"

mkdir -p "$OUT"
rm -f "$ARCHIVE" "$SHA"

echo "== Packaging Nevai Linux unsigned alpha =="
echo "Input: $DIST_BIN"

tar -C "$(dirname "$DIST_BIN")" -czf "$ARCHIVE" "$(basename "$DIST_BIN")"
sha256_file "$ARCHIVE" | tee "$SHA"

cat > "$README" <<EOF
Nevai Browser Linux local unsigned alpha

Status:
- Local development alpha build
- Unsigned
- Not for public production distribution

Artifact:
- Nevai-linux-alpha-dev.tar.gz

SHA-256:
$(cut -d' ' -f1 "$SHA")

Known limitations:
- Automatic updater is disabled for alpha.
- This artifact is intended for local/manual testing only.
- Linux package-manager formats are out of scope for Stage 2.
EOF

echo
echo "Output:"
ls -lh "$OUT"
