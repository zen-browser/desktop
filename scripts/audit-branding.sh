#!/usr/bin/env bash
set -e

ROOT="${1:-.}"

echo "Auditing branding in: $ROOT"
echo

rg -n \
  "Zen Browser|Zen|Firefox|Mozilla|zen-browser|app.zen_browser|org.mozilla|mozilla.org|firefox.com" \
  "$ROOT" \
  --glob '!**/.git/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/obj*/**' \
  --glob '!**/third_party/**' \
  --glob '!**/LICENSE*' \
  --glob '!**/NOTICE*' \
  --glob '!**/legal/**' \
  || true
