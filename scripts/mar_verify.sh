#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Pre-release verification for MAR artifacts.
#
# Run this AFTER `scripts/mar_sign.sh -s` and BEFORE publishing a release.
# It confirms that every MAR we are about to ship is present, non-empty,
# signed with the cert whose public half lives at build/signing/public_key.der,
# and that the accompanying update.xml manifest reflects the signed file's
# current sha512 / size. Exits non-zero on the first verification failure so
# CI halts before we overwrite a good release with a broken one.

set -euo pipefail

CERT_PATH_DIR="build/signing"
PUBLIC_KEY_DER="$CERT_PATH_DIR/public_key.der"
VERIFY_NSS_DIR="$CERT_PATH_DIR/nss_verify"
LINUX_EXTRACT_DIR="$CERT_PATH_DIR/extracted_linux"
LINUX_ARCHIVE="zen.linux-x86_64.tar.xz/zen.linux-x86_64.tar.xz"

FAILURES=0

fail() {
  echo "  [FAIL] $*" >&2
  FAILURES=$((FAILURES + 1))
}

ok() {
  echo "  [ OK ] $*"
}

cleanup_verify_db() {
  rm -rf "$VERIFY_NSS_DIR"
  rm -rf "$LINUX_EXTRACT_DIR"
}
trap cleanup_verify_db EXIT

if [ -z "${SIGNMAR:-}" ]; then
  echo "Error: SIGNMAR environment variable is not set." >&2
  exit 1
fi
if [ ! -f "$SIGNMAR" ]; then
  echo "Error: signmar not found at $SIGNMAR." >&2
  exit 1
fi
chmod +x "$SIGNMAR"

if [ ! -f "$PUBLIC_KEY_DER" ]; then
  echo "Error: $PUBLIC_KEY_DER not found. Run 'mar_sign.sh -g' first." >&2
  exit 1
fi

EXPECTED_MAR_CHANNEL="${RELEASE_BRANCH:-}"
if [ -z "$EXPECTED_MAR_CHANNEL" ]; then
  echo "Error: RELEASE_BRANCH environment variable is not set (expected 'release' or 'twilight')." >&2
  exit 1
fi

# Build a throwaway NSS database that trusts only the signing cert, so
# signmar -v can verify signatures without the private key being present.
setup_verify_db() {
  rm -rf "$VERIFY_NSS_DIR"
  mkdir -p "$VERIFY_NSS_DIR"
  local pass="$VERIFY_NSS_DIR/password.txt"
  : > "$pass"
  certutil -N -d "$VERIFY_NSS_DIR" -f "$pass"
  certutil -A -d "$VERIFY_NSS_DIR" -n "mar_sig" -t "CT,C,C" -i "$PUBLIC_KEY_DER"
}

# Each entry: "<mar_path>|<manifest_dir>|<platform_label>"
declare -a pairs=(
  "linux.mar/linux.mar|linux_update_manifest_x86_64|linux-x86_64"
  "linux-aarch64.mar/linux-aarch64.mar|linux_update_manifest_aarch64|linux-aarch64"
  "macos.mar/macos.mar|macos_update_manifest|macos"
)

if [ -d ".github/workflows/object/windows-x64-signed-x86_64" ]; then
  pairs+=(
    ".github/workflows/object/windows-x64-signed-x86_64/windows.mar|.github/workflows/object/windows-x64-signed-x86_64/update_manifest|windows-x86_64"
    ".github/workflows/object/windows-x64-signed-arm64/windows-arm64.mar|.github/workflows/object/windows-x64-signed-arm64/update_manifest|windows-arm64"
  )
else
  pairs+=(
    "windows.mar/windows.mar|windows_update_manifest_x86_64|windows-x86_64"
    "windows-arm64.mar/windows-arm64.mar|windows_update_manifest_arm64|windows-arm64"
  )
fi

hash_file() {
  if command -v sha512sum >/dev/null 2>&1; then
    sha512sum "$1" | awk '{print $1}'
  else
    shasum -a 512 "$1" | awk '{print $1}'
  fi
}

size_file() {
  wc -c < "$1" | tr -d ' '
}

verify_signature() {
  local mar="$1"
  if "$SIGNMAR" -d "$VERIFY_NSS_DIR" -n "mar_sig" -v "$mar" >/dev/null 2>&1; then
    ok "Signature valid: $mar"
  else
    fail "Signature INVALID (or missing) for $mar"
  fi
}

# Cache signmar -T output per MAR so we only pay for it once per file.
mar_info() {
  local mar="$1"
  "$SIGNMAR" -T "$mar" 2>&1
}

verify_signature_count() {
  local mar="$1"
  local info count
  info=$(mar_info "$mar")
  # signmar -T prints one "Signature block found with 1 signature" line per signature block.
  count=$(echo "$info" | grep -cE '^[[:space:]]*Signature block found with [0-9]+ signature' || true)
  if [ "$count" != "1" ]; then
    fail "$mar has $count signatures, expected exactly 1"
  else
    ok "$mar has exactly 1 signature"
  fi
}

verify_mar_channel() {
  local mar="$1"
  local info channel
  info=$(mar_info "$mar")
  # Accept either "MAR channel name:" or "MAR channel ID:" — the label
  # has drifted between Mozilla releases.
  channel=$(echo "$info" \
    | grep -iE 'MAR channel (name|id)[[:space:]]*:' \
    | head -1 \
    | sed -E 's/.*MAR channel (name|id)[[:space:]]*:[[:space:]]*//I' \
    | tr -d '[:space:]')
  if [ -z "$channel" ]; then
    fail "$mar: could not read MAR channel from product info block"
    return
  fi
  if [ "$channel" != "$EXPECTED_MAR_CHANNEL" ]; then
    fail "$mar: MAR channel is '$channel', expected '$EXPECTED_MAR_CHANNEL' (RELEASE_BRANCH)"
  else
    ok "$mar: MAR channel = $channel"
  fi
}

verify_update_settings() {
  echo ""
  echo "Checking update-settings.ini in $LINUX_ARCHIVE..."
  if [ ! -f "$LINUX_ARCHIVE" ]; then
    fail "Linux build archive not found at $LINUX_ARCHIVE"
    return
  fi

  rm -rf "$LINUX_EXTRACT_DIR"
  mkdir -p "$LINUX_EXTRACT_DIR"
  if ! tar -xf "$LINUX_ARCHIVE" -C "$LINUX_EXTRACT_DIR"; then
    fail "Failed to extract $LINUX_ARCHIVE"
    return
  fi

  local ini
  ini=$(find "$LINUX_EXTRACT_DIR" -type f -name "update-settings.ini" | head -1)
  if [ -z "$ini" ]; then
    fail "update-settings.ini not found inside $LINUX_ARCHIVE"
    return
  fi

  local accepted
  accepted=$(grep -oP '^ACCEPTED_MAR_CHANNEL_IDS[[:space:]]*=[[:space:]]*\K.*' "$ini" \
    | head -1 | tr -d '\r')
  if [ -z "$accepted" ]; then
    fail "ACCEPTED_MAR_CHANNEL_IDS not set in $ini"
    return
  fi

  # ACCEPTED_MAR_CHANNEL_IDS is a comma-separated list; membership is what
  # the updater enforces, so we check membership rather than strict equality.
  local found=0 entry
  IFS=',' read -ra entries <<< "$accepted"
  for entry in "${entries[@]}"; do
    entry=$(echo "$entry" | tr -d '[:space:]')
    if [ "$entry" = "$EXPECTED_MAR_CHANNEL" ]; then
      found=1
      break
    fi
  done

  if [ "$found" = "1" ]; then
    ok "update-settings.ini accepts MAR channel '$EXPECTED_MAR_CHANNEL' (ACCEPTED_MAR_CHANNEL_IDS=$accepted)"
  else
    fail "update-settings.ini ACCEPTED_MAR_CHANNEL_IDS='$accepted' does not include '$EXPECTED_MAR_CHANNEL'"
  fi
}

verify_manifest() {
  local mar="$1" manifest_dir="$2" label="$3"

  if [ ! -d "$manifest_dir" ]; then
    fail "$label: manifest directory $manifest_dir not found"
    return
  fi

  local xmls
  xmls=$(find "$manifest_dir" -type f -name "update.xml")
  if [ -z "$xmls" ]; then
    fail "$label: no update.xml files found under $manifest_dir"
    return
  fi

  local actual_hash actual_size
  actual_hash=$(hash_file "$mar")
  actual_size=$(size_file "$mar")

  while IFS= read -r xml; do
    local xhash xsize xurl
    xhash=$(grep -oP 'hashValue="\K[^"]+' "$xml" | head -1 || true)
    xsize=$(grep -oP 'size="\K[^"]+' "$xml" | head -1 || true)
    xurl=$(grep -oP 'URL="\K[^"]+' "$xml" | head -1 || true)
    if [ -z "$xhash" ] || [ -z "$xsize" ]; then
      fail "$label: $xml is missing hashValue or size"
      continue
    fi
    if [ -z "$xurl" ]; then
      fail "$label: $xml is missing URL attribute"
      continue
    fi
    if ! grep -q 'hashFunction="sha512"' "$xml"; then
      fail "$label: $xml hashFunction is not sha512"
      continue
    fi
    if [ "$xhash" != "$actual_hash" ]; then
      fail "$label: hashValue mismatch in $xml"
      echo "         manifest: $xhash" >&2
      echo "         actual:   $actual_hash" >&2
      continue
    fi
    if [ "$xsize" != "$actual_size" ]; then
      fail "$label: size mismatch in $xml (manifest=$xsize, actual=$actual_size)"
      continue
    fi
    ok "$label: $(basename "$xml") matches $mar (size=$actual_size)"
  done <<< "$xmls"
}

setup_verify_db
verify_update_settings

for entry in "${pairs[@]}"; do
  IFS='|' read -r mar manifest label <<< "$entry"
  echo ""
  echo "Verifying $label: $mar"

  if [ ! -f "$mar" ]; then
    fail "$label: MAR file $mar not found"
    continue
  fi
  if [ ! -s "$mar" ]; then
    fail "$label: MAR file $mar is empty"
    continue
  fi

  verify_signature "$mar"
  verify_signature_count "$mar"
  verify_mar_channel "$mar"
  verify_manifest "$mar" "$manifest" "$label"
done

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "Pre-release verification FAILED with $FAILURES issue(s)." >&2
  exit 1
fi
echo "Pre-release verification passed."
