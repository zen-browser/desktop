#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

check_only=false
if [[ "${1:-}" == "--check" ]]; then
  check_only=true
elif [[ $# -ne 0 ]]; then
  echo "Usage: npm run install:macos [-- --check]" >&2
  exit 2
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer only supports macOS." >&2
  exit 1
fi

app="/Applications/Zen.app"
resources="$app/Contents/Resources"
profile_root="$HOME/Library/Application Support/zen"
profiles_dir="$profile_root/Profiles"
sine_config="$resources/config.js"
sine_prefs="$resources/defaults/pref/config-prefs.js"

version="$(node -p "require('./surfer.json').brands.release.release.displayVersion")"
dmg="$repo_root/engine/obj-aarch64-apple-darwin/dist/zen-${version}.en-US.mac.dmg"
test -f "$dmg"

sine_profile_present=false
if [[ -d "$profiles_dir" ]]; then
  shopt -s nullglob
  for profile in "$profiles_dir"/*; do
    if [[ -f "$profile/chrome/JS/sine.sys.mjs" ]]; then
      sine_profile_present=true
      break
    fi
  done
  shopt -u nullglob
fi

if [[ -e "$sine_config" || -e "$sine_prefs" ]]; then
  if [[ ! -f "$sine_config" || ! -f "$sine_prefs" ]]; then
    echo "The installed Zen app contains an incomplete Sine bootloader." >&2
    echo "Restore both config.js and defaults/pref/config-prefs.js before installing." >&2
    exit 1
  fi
elif $sine_profile_present; then
  echo "Sine is installed in a Zen profile, but its app bootloader is missing." >&2
  echo "Restore the Sine bootloader before replacing Zen." >&2
  exit 1
fi

if $check_only; then
  echo "Local Zen package is ready to install."
  if $sine_profile_present; then
    echo "Sine profile and bootloader detected; both loader files will be preserved."
  fi
  exit 0
fi

if pgrep -f '^/Applications/Zen\.app/Contents/MacOS/zen$' >/dev/null; then
  echo "Zen is still running; quit it before installing." >&2
  exit 1
fi

timestamp="$(date +%Y-%m-%d-%H%M%S)"
profile_backup="$HOME/Desktop/zen-backup-$timestamp"
previous="$app.backup-$timestamp"
staged="$app.new"
mount_dir="$(mktemp -d /tmp/zen-dmg.XXXXXX)"
mounted=false

cleanup() {
  if $mounted; then
    hdiutil detach "$mount_dir" >/dev/null 2>&1 || true
  fi
  rmdir "$mount_dir" 2>/dev/null || true
}
trap cleanup EXIT

test ! -e "$profile_backup"
test ! -e "$previous"
test ! -e "$staged"

hdiutil attach -nobrowse -readonly -mountpoint "$mount_dir" "$dmg" >/dev/null
mounted=true
test -d "$mount_dir/Zen.app"
unzip -p \
  "$mount_dir/Zen.app/Contents/Resources/browser/omni.ja" \
  "localization/en-US/browser/preferences/zen-preferences.ftl" \
  >/dev/null
ditto "$mount_dir/Zen.app" "$staged"

if [[ -f "$sine_config" ]]; then
  mkdir -p "$staged/Contents/Resources/defaults/pref"
  ditto "$sine_config" "$staged/Contents/Resources/config.js"
  ditto "$sine_prefs" "$staged/Contents/Resources/defaults/pref/config-prefs.js"
  cmp -s "$sine_config" "$staged/Contents/Resources/config.js"
  cmp -s \
    "$sine_prefs" \
    "$staged/Contents/Resources/defaults/pref/config-prefs.js"
fi

installed_sha="$(awk -F= '$1 == "SourceStamp" { print $2; exit }' \
  "$staged/Contents/Resources/application.ini")"
source_sha="$(git rev-parse HEAD)"
if [[ "$installed_sha" != "$source_sha" ]]; then
  echo "Packaged build is stale." >&2
  echo "Expected SourceStamp $source_sha but found $installed_sha." >&2
  exit 1
fi

test -d "$profile_root"
ditto "$profile_root" "$profile_backup"

if [[ -e "$app" ]]; then
  mv "$app" "$previous"
fi
if ! mv "$staged" "$app"; then
  if [[ -e "$previous" && ! -e "$app" ]]; then
    mv "$previous" "$app"
  fi
  exit 1
fi

cleanup
trap - EXIT

printf 'profile_backup=%s\nprevious_app=%s\n' "$profile_backup" "$previous"
open "$app"
