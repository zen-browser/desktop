#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

scope="docs"
for arg in "$@"; do
  case "$arg" in
    --scope=*) scope="${arg#--scope=}" ;;
    --help)
      echo "Usage: $0 [--scope=docs|macos|desktop]"
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_file() {
  local path="$1"
  [ -f "$path" ] || fail "Missing required file: $path"
}

require_artifact() {
  local path="$1"
  require_file "$path"
  [ -s "$path" ] || fail "Artifact is empty: $path"
}

echo "== Nevai alpha release gate =="
echo "Scope: $scope"

./scripts/check-nevai-product-readiness.sh

echo "== Required release planning files =="
for file in \
  product/RELEASE_GATES.md \
  product/public-alpha/ALPHA_RELEASE_CHECKLIST.md \
  product/public-alpha/DOWNLOAD_PAGE_REQUIREMENTS.md \
  product/public-alpha/EXTERNAL_SERVICES_INVENTORY.md \
  product/public-alpha/TELEMETRY_AND_CRASH_REPORTING_DECISION.md \
  product/public-alpha/CHECKSUMS_TEMPLATE.txt \
  product/public-alpha/SUPPORT_RESPONSE_TEMPLATES.md
do
  require_file "$file"
  echo "OK file: $file"
done

case "$scope" in
  docs)
    echo "Docs-only release gate passed. No artifacts checked."
    ;;
  macos)
    echo "== macOS artifact gate =="
    require_artifact ../builds-local/macos/Nevai-macos-alpha-dev.zip
    require_artifact ../builds-local/macos/Nevai-macos-alpha-dev.SHA256.txt
    require_file ../builds-local/macos/README-alpha.txt
    echo "macOS alpha artifact gate passed."
    ;;
  desktop)
    echo "== desktop artifact gate =="
    require_artifact ../builds-local/macos/Nevai-macos-alpha-dev.zip
    require_artifact ../builds-local/macos/Nevai-macos-alpha-dev.SHA256.txt
    require_file ../builds-local/macos/README-alpha.txt
    require_artifact ../builds-local/linux/Nevai-linux-alpha-dev.tar.gz
    require_artifact ../builds-local/linux/Nevai-linux-alpha-dev.SHA256.txt
    require_file ../builds-local/linux/README-alpha.txt
    require_artifact ../builds-local/windows/Nevai-windows-alpha-dev.zip
    require_artifact ../builds-local/windows/Nevai-windows-alpha-dev.SHA256.txt
    require_file ../builds-local/windows/README-alpha.txt
    echo "Desktop cross-platform artifact gate passed."
    ;;
  *)
    fail "Unknown scope: $scope"
    ;;
esac

echo "== Nevai alpha release gate passed =="
