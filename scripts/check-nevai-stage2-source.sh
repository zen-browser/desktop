#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_file() {
  local path="$1"
  [ -f "$path" ] || fail "Missing required file: $path"
}

require_executable() {
  local path="$1"
  require_file "$path"
  [ -x "$path" ] || fail "Required script is not executable: $path"
}

echo "== Nevai Stage 2 source smoke =="

echo "== Required product docs =="
require_file product/STAGE1_MACOS_ALPHA.md
require_file product/STAGE2_DESKTOP_CROSS_PLATFORM_PLAN.md
require_file product/STAGE2_DESKTOP_QA_CHECKLIST.md
require_file product/STAGE2_ARTIFACT_REVIEW.md
require_file product/STAGE2_LINUX_DISCOVERY.md
require_file product/STAGE2_WINDOWS_DISCOVERY.md
require_file product/STAGE2_BUILD_RESULTS_TEMPLATE.md
require_file product/STAGE2_STATUS.md
require_file product/STAGE2_KNOWN_ISSUES.md
require_file product/STAGE3_DESKTOP_PACKAGING_PLAN.md
require_file .github/workflows/nevai-stage2-smoke.yml
require_file .github/workflows/nevai-linux-discovery.yml
require_file .github/workflows/nevai-windows-discovery.yml

echo "== Required Stage 1 macOS alpha scripts =="
require_executable scripts/apply-nevai-about-dialog-branding.sh
require_executable scripts/build-nevai-macos-alpha.sh
require_executable scripts/qa-nevai-macos-alpha.sh
require_executable scripts/package-nevai-macos-alpha.sh
require_executable scripts/patch-nevai-disable-updater-preferences-ui.sh
require_executable scripts/fix-nevai-macos-actor-symlinks.sh

echo "== Required Stage 2 check script =="
require_executable scripts/check-nevai-stage2-source.sh
require_executable scripts/qa-nevai-linux-alpha.sh
require_executable scripts/package-nevai-linux-alpha.sh

echo "== Shell syntax =="
for script in \
  scripts/apply-nevai-about-dialog-branding.sh \
  scripts/build-nevai-macos-alpha.sh \
  scripts/qa-nevai-macos-alpha.sh \
  scripts/package-nevai-macos-alpha.sh \
  scripts/patch-nevai-disable-updater-preferences-ui.sh \
  scripts/fix-nevai-macos-actor-symlinks.sh \
  scripts/check-nevai-stage2-source.sh \
  scripts/qa-nevai-linux-alpha.sh \
  scripts/package-nevai-linux-alpha.sh
do
  bash -n "$script"
  echo "OK syntax: $script"
done

echo "== Cross-platform branding assets =="
for asset in \
  product/brand/assets/source/nevai-logo.svg \
  configs/branding/release/logo.png \
  configs/branding/release/logo16.png \
  configs/branding/release/logo32.png \
  configs/branding/release/logo48.png \
  configs/branding/release/logo64.png \
  configs/branding/release/logo128.png \
  configs/branding/release/logo256.png \
  configs/branding/release/logo512.png \
  configs/branding/release/firefox.ico \
  configs/branding/release/VisualElements_70.png \
  configs/branding/release/VisualElements_150.png \
  configs/branding/twilight/logo.png \
  configs/branding/twilight/firefox.ico \
  configs/branding/twilight/VisualElements_70.png \
  configs/branding/twilight/VisualElements_150.png
do
  require_file "$asset"
  echo "OK asset: $asset"
done

echo "== JSON validation =="
command -v node >/dev/null 2>&1 || fail "node is required for JSON validation"
node -e "JSON.parse(require('fs').readFileSync('surfer.json', 'utf8')); console.log('OK JSON: surfer.json')"
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('OK JSON: package.json')"
node -e "JSON.parse(require('fs').readFileSync('package-lock.json', 'utf8')); console.log('OK JSON: package-lock.json')"

echo "== Alpha updater policy =="
node - <<'NODE'
const fs = require("fs");
const surfer = JSON.parse(fs.readFileSync("surfer.json", "utf8"));
if (surfer.updateHostname !== "updates.invalid") {
  throw new Error(`surfer.json updateHostname must be updates.invalid, got ${surfer.updateHostname}`);
}
console.log("OK updater host: updates.invalid");
NODE

if grep -R "updates\.zen-browser\.app" \
  surfer.json configs src/build src/browser/branding src/browser/moz-configure.patch src/toolkit \
  >/dev/null 2>&1
then
  fail "Found active Zen update host in Stage 2 source scope"
fi
echo "OK no active Zen update host in Stage 2 source scope"

echo "== Stage 1 tag visibility =="
if git rev-parse --verify --quiet stage1-macos-alpha-v0.1 >/dev/null; then
  echo "OK tag exists: stage1-macos-alpha-v0.1"
else
  echo "WARN: stage1-macos-alpha-v0.1 tag not present in this checkout"
fi

echo "== Tracked artifact guard =="
tracked_artifacts="$(
  git ls-files | grep -E '(^engine/obj-|^builds-local/|\.app/|\.dmg$|\.zip$|\.tar\.gz$|\.SHA256\.txt$)' || true
)"
if [ -n "$tracked_artifacts" ]; then
  echo "$tracked_artifacts"
  fail "Generated app/build artifacts must not be committed"
fi
echo "OK no generated app/build artifacts tracked"

echo "== Stage 2 source smoke passed =="
