#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

set -e

CERT_PATH_DIR=build/signing
UPDATER_CERT_DIR="engine/toolkit/mozapps/update/updater"
NSS_CONFIG_DIR="$CERT_PATH_DIR/nss_config"

generate_certs() {
  mkdir temp
  cd temp

  # 1. Generate private key
  openssl genrsa -out private_key.pem 4096

  # 2. Generate self-signed certificate (required for PKCS#12 bundling)
  # RFC 5280 "no well-defined expiration" sentinel: 99991231235959Z
  openssl req -new -x509 \
      -key private_key.pem \
      -out cert.pem \
      -subj "/CN=MAR Signing" \
      -not_before 20000101000000Z \
      -not_after  99991231235959Z

  # 3. Export certificate as DER (for embedding in updater)
  openssl x509 -in cert.pem -outform DER -out public_key.der

  cd ..
  mkdir -p "$CERT_PATH_DIR"
  mv temp/private_key.pem "$CERT_PATH_DIR"/private_key.pem
  mv temp/cert.pem        "$CERT_PATH_DIR"/cert.pem
  mv temp/public_key.der  "$CERT_PATH_DIR"/public_key.der

  mkdir -p "$CERT_PATH_DIR/env"
  base64 -w 0 "$CERT_PATH_DIR"/cert.pem > "$CERT_PATH_DIR"/env/ZEN_SIGNING_CERT_PEM_BASE64
  base64 -w 0 "$CERT_PATH_DIR"/private_key.pem > "$CERT_PATH_DIR"/env/ZEN_SIGNING_PRIVATE_KEY_PEM_BASE64

  # Make sure no private keys or certs are left
  # in the public_key.der file, which is the only one that 
  # should be distributed and embedded in the updater
  openssl x509 -in "$CERT_PATH_DIR"/public_key.der -inform DER -noout -text > /dev/null

  rm -rf temp
}

import_cert() {
  if [ ! -f "$CERT_PATH_DIR/public_key.der" ]; then
    echo "Error: public_key.der not found. Run with -g first." >&2
    exit 1
  fi
  files=(
    "$UPDATER_CERT_DIR/release_primary.der"
    "$UPDATER_CERT_DIR/release_secondary.der"
    "$UPDATER_CERT_DIR/dep1.der"
    "$UPDATER_CERT_DIR/dep2.der"
    "$UPDATER_CERT_DIR/xpcshellCertificate.der"
  )
  for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
      echo "Error: $file not found. Make sure the updater certificates exist." >&2
      exit 1
    fi
    rm -f "$file"
    echo "Copying $CERT_PATH_DIR/public_key.der to $file"
    cp "$CERT_PATH_DIR/public_key.der" "$file"
  done
  echo "Done. Rebuild the updater to embed the new certificate."
}

create_nss_config_dir() {
  rm -rf "$NSS_CONFIG_DIR"
  mkdir "$NSS_CONFIG_DIR"

  if [ -z "$ZEN_MAR_SIGNING_PASSWORD" ]; then
    echo "Warning: ZEN_MAR_SIGNING_PASSWORD environment variable not set. Using empty password." >&2
    ZEN_MAR_SIGNING_PASSWORD=""
  fi

  password_file="$NSS_CONFIG_DIR/password.txt"
  echo "$ZEN_MAR_SIGNING_PASSWORD" > "$password_file"

  if [ "$ZEN_SIGNING_CERT_PEM_BASE64" ]; then
    echo "Decoding signing certificate from ZEN_SIGNING_CERT_PEM_BASE64 environment variable..."
    echo "$ZEN_SIGNING_CERT_PEM_BASE64" | base64 -d > "$CERT_PATH_DIR/cert.pem"
  fi

  if [ "$ZEN_SIGNING_PRIVATE_KEY_PEM_BASE64" ]; then
    echo "Decoding signing private key from ZEN_SIGNING_PRIVATE_KEY_PEM_BASE64 environment variable..."
    echo "$ZEN_SIGNING_PRIVATE_KEY_PEM_BASE64" | base64 -d > "$CERT_PATH_DIR/private_key.pem"
  fi

  echo "Generating NSS config directory at $NSS_CONFIG_DIR"
  certutil -N -d "$NSS_CONFIG_DIR" -f "$password_file"

  echo "Wrapping private key into PKCS#12..."
  echo "Wrapping key + cert into PKCS#12..."
  openssl pkcs12 -export \
      -inkey "$CERT_PATH_DIR/private_key.pem" \
      -in    "$CERT_PATH_DIR/cert.pem" \
      -name  "mar_sig" \
      -passout pass:"$ZEN_MAR_SIGNING_PASSWORD" \
      -out   "$CERT_PATH_DIR/private_key.p12"

  echo "Importing PKCS#12 into NSS database..."
  pk12util \
      -i "$CERT_PATH_DIR/private_key.p12" \
      -d "$NSS_CONFIG_DIR" \
      -W "$ZEN_MAR_SIGNING_PASSWORD" \
      -K "$ZEN_MAR_SIGNING_PASSWORD"
}

cleanup_certs() {
  rm -rf "$NSS_CONFIG_DIR"
  rm -rf "$CERT_PATH_DIR/env"

  rm -f "$CERT_PATH_DIR/private_key.p12"
  rm -f "$CERT_PATH_DIR/private_key.pem"
  rm -f "$CERT_PATH_DIR/cert.pem"
}

update_manifests() {
  mar_file=$(basename "$1")
  if [[ "$mar_file" == "linux.mar" ]]; then
    manifest="linux_update_manifest_x86_64"
  elif [[ "$mar_file" == "linux-aarch64.mar" ]]; then
    manifest="linux_update_manifest_aarch64"
  elif [[ "$mar_file" == "windows.mar" ]]; then
    manifest=".github/workflows/object/windows-x64-signed-x86_64/update_manifest"
    if [ ! -d "$manifest" ]; then
      manifest="windows_update_manifest_x86_64"
    fi
  elif [[ "$mar_file" == "windows-arm64.mar" ]]; then
    manifest=".github/workflows/object/windows-x64-signed-arm64/update_manifest"
    if [ ! -d "$manifest" ]; then
      manifest="windows_update_manifest_arm64"
    fi
  elif [[ "$mar_file" == "macos.mar" ]]; then
    manifest="macos_update_manifest"
  else
    echo "Unknown MAR file name format: $mar_file. Skipping manifest update." >&2
    exit 1
  fi
  # There can be any update.xml file, lets just recursively search for the one
  manifest_files=$(find "$manifest" -type f -name "update.xml")
  for manifest_file in $manifest_files; do
    # Example manifest:
    #  <update type="minor" displayVersion="..." appVersion="..." platformVersion="..." buildID="...">
    #      <patch type="complete" URL="..." hashFunction="sha512" hashValue="..." size="..."/>
    #    </update>
    #  </updates>
    # When signing the mar, hashValue and size will change, so we need to update the manifest with 
    # the new values. We can get the new values by running "mar -i signed_mar_file.mar"
    echo "Updating manifest $manifest_file with new hash and size for $mar_file"
    size=$(wc -c < "$1" | tr -d ' ')
    hashValue=$(sha512sum "$1" | awk '{print $1}')
    # Update the manifest with the new values. We can use sed to do this.
    # We need to find the line that contains the URL of the mar file, and update the hashValue and size attributes in the same <patch> element.
    old_hashValue=$(grep -oP 'hashValue="\K[^"]+' "$manifest_file")
    old_size=$(grep -oP 'size="\K[^"]+' "$manifest_file")
    if [ -z "$old_hashValue" ] || [ -z "$old_size" ]; then
      echo "Could not find old hashValue or size in manifest. Skipping manifest update." >&2
      exit 1
    fi
    echo "Old hashValue: $old_hashValue, Old size: $old_size"
    echo "New hashValue: $hashValue, New size: $size"
    sed -i.bak "s/hashValue=\"$old_hashValue\"/hashValue=\"$hashValue\"/g; s/size=\"$old_size\"/size=\"$size\"/g" "$manifest_file"
    rm "$manifest_file.bak"
    echo "Manifest updated with new hashValue and size for $mar_file"
  done
}

sign_mars() {
  if [ ! -f "$SIGNMAR" ]; then
    echo "Error: signmar not found at $SIGNMAR. Build the engine first." >&2
    exit 1
  fi

  chmod +x "$SIGNMAR"

  create_nss_config_dir

  folders=(
    linux.mar
    linux-aarch64.mar
    macos.mar
  )

  if [ -d ".github/workflows/object/windows-x64-signed-x86_64" ]; then
    folders+=(".github/workflows/object/windows-x64-signed-x86_64")
    folders+=(".github/workflows/object/windows-x64-signed-arm64")
  else
    folders+=("windows.mar")
    folders+=("windows-arm64.mar")
  fi
      
  # each folder will contain the .mar files for that platform, and the signature will be written in-place
  for folder in "${folders[@]}"; do
    if [ -d "$folder" ]; then
      for mar_file in "$folder"/*.mar; do
        if [ -f "$mar_file" ]; then
          echo ""
          echo "Signing $mar_file..."
          # mar [-C workingDir] -d NSSConfigDir -n certname -s archive.mar out_signed_archive.mar
          "$SIGNMAR" -d "$NSS_CONFIG_DIR" -n "mar_sig" -s "$mar_file" "$mar_file".signed
          echo "Signed $mar_file. Verifying signature..."
          "$SIGNMAR" -d "$NSS_CONFIG_DIR" -n "mar_sig" -v "$mar_file".signed
          mv "$mar_file".signed "$mar_file"
          echo "Successfully signed $mar_file"
          update_manifests "$mar_file"
        else
          echo "No .mar files found in $folder, skipping."
          exit 1
        fi
      done
    else
      echo "Directory $folder not found, skipping."
      exit 1
    fi
  done

  cleanup_certs
}

case "$1" in
  -g)
    generate_certs
    ;;
  -i)
    import_cert
    ;;
  -s)
    sign_mars
    ;;
  *)
    echo "Usage: $0 [-g] [-i] [-s]" >&2
    echo "  -g    Generate MAR signing certificates" >&2
    echo "  -i    Import the certificate into the updater (release_primary.der)" >&2
    echo "  -s    Sign *.mar files in the current directory in-place" >&2
    exit 1
    ;;
esac
