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
  openssl req -new -x509 \
      -key private_key.pem \
      -out cert.pem \
      -subj "/CN=MAR Signing"

  # 3. Export public key as SPKI DER (for embedding in updater)
  openssl rsa -in private_key.pem -pubout -outform DER -out public_key.der

  cd ..
  mkdir -p "$CERT_PATH_DIR"
  mv temp/private_key.pem "$CERT_PATH_DIR"/private_key.pem
  mv temp/cert.pem        "$CERT_PATH_DIR"/cert.pem
  mv temp/public_key.der  "$CERT_PATH_DIR"/public_key.der

  mkdir -p "$CERT_PATH_DIR/env"
  base64 -w 0 "$CERT_PATH_DIR"/cert.pem > "$CERT_PATH_DIR"/env/ZEN_SIGNING_CERT_PEM_BASE64
  base64 -w 0 "$CERT_PATH_DIR"/private_key.pem > "$CERT_PATH_DIR"/env/ZEN_SIGNING_PRIVATE_KEY_PEM_BASE64

  # Verify public key
  openssl rsa -in "$CERT_PATH_DIR"/public_key.der \
      -pubin -inform DER -text -noout

  rm -rf temp
}

import_cert() {
  if [ ! -f "$CERT_PATH_DIR/public_key.der" ]; then
    echo "Error: public_key.der not found. Run with -g first." >&2
    exit 1
  fi
  echo "Importing certificate into $UPDATER_CERT_DIR/release_primary.der"
  cp "$CERT_PATH_DIR/public_key.der" "$UPDATER_CERT_DIR/release_primary.der"
  echo "Importing certificate into $UPDATER_CERT_DIR/release_secondary.der"
  cp "$CERT_PATH_DIR/public_key.der" "$UPDATER_CERT_DIR/release_secondary.der"
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
      -name  "mar_cert" \
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

sign_mar() {
  local mar_file="$1"

  if [ -z "$mar_file" ]; then
    echo "Error: .mar file path is required. Usage: $0 -s <mar_file>" >&2
    exit 1
  fi

  if [ ! -f "$mar_file" ]; then
    echo "Error: .mar file not found at $mar_file" >&2
    exit 1
  fi

  if [ ! -f "$SIGNMAR" ]; then
    echo "Error: signmar not found at $SIGNMAR. Build the engine first." >&2
    exit 1
  fi

  chmod +x "$SIGNMAR"

  create_nss_config_dir

  echo ""
  echo "Signing $mar_file..."
  # mar [-C workingDir] -d NSSConfigDir -n certname -s archive.mar out_signed_archive.mar
  "$SIGNMAR" -d "$NSS_CONFIG_DIR" -n "mar_cert" -s "$mar_file" "$mar_file".signed
  echo "Signed $mar_file. Verifying signature..."
  "$SIGNMAR" -d "$NSS_CONFIG_DIR" -n "mar_cert" -v "$mar_file".signed
  mv "$mar_file".signed "$mar_file"
  echo "Successfully signed $mar_file"

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
    sign_mar "$2"
    ;;
  *)
    echo "Usage: $0 [-g] [-i] [-s <mar_file>]" >&2
    echo "  -g              Generate MAR signing certificates" >&2
    echo "  -i              Import the certificate into the updater (release_primary.der)" >&2
    echo "  -s <mar_file>   Sign the given .mar file in-place" >&2
    exit 1
    ;;
esac
