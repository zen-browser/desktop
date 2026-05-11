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

search_files() {
  local pattern="$1"
  shift

  if command -v rg >/dev/null 2>&1; then
    rg -n "$pattern" "$@"
  else
    grep -RInE "$pattern" "$@"
  fi
}

echo "== Nevai product readiness smoke =="

echo "== Roadmap and stage plans =="
for file in \
  product/ROADMAP.md \
  product/STAGE2_PAUSE_NOTE.md \
  product/STAGE3_DESKTOP_PACKAGING_PLAN.md \
  product/STAGE4_SIGNING_AND_RELEASE_TRUST_PLAN.md \
  product/STAGE5_UPDATE_INFRASTRUCTURE_PLAN.md \
  product/STAGE6_PUBLIC_ALPHA_READINESS_PLAN.md \
  product/STAGE7_MOBILE_SPLIT_PLAN.md \
  product/STAGE8_PRODUCT_ECOSYSTEM_PLAN.md \
  product/MOBILE_SHARED_REQUIREMENTS.md \
  product/RELEASE_GATES.md
do
  require_file "$file"
  echo "OK file: $file"
done

echo "== Public alpha templates =="
for file in \
  product/public-alpha/README-alpha-template.md \
  product/public-alpha/RELEASE_NOTES_TEMPLATE.md \
  product/public-alpha/KNOWN_ISSUES_TEMPLATE.md \
  product/public-alpha/PRIVACY_POLICY_DRAFT.md \
  product/public-alpha/LICENSE_ATTRIBUTION_CHECKLIST.md \
  product/public-alpha/SUPPORT_WORKFLOW.md \
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

echo "== GitHub support surface =="
require_file SECURITY.md
require_file .github/ISSUE_TEMPLATE/bug_report.yml
require_file .github/ISSUE_TEMPLATE/alpha_test_report.yml
require_file .github/ISSUE_TEMPLATE/config.yml

if search_files "zen-browser/desktop|https?://zen-browser\\.app|About Zen|Zen Browser Text|Zen Logo" \
  SECURITY.md .github/ISSUE_TEMPLATE product/public-alpha product/ROADMAP.md \
  >/tmp/nevai-product-readiness-zen-hits.txt
then
  cat /tmp/nevai-product-readiness-zen-hits.txt
  fail "Found stale public-support Zen references"
fi
echo "OK no stale Zen public-support references"

echo "== Public release honesty =="
if search_files "Stage 2 status: complete|Stage 2: complete|cross-platform alpha: ready|stable release: ready|public stable: ready" \
  product/ROADMAP.md product/STAGE2_STATUS.md product/STAGE2_PAUSE_NOTE.md product/STAGE6_PUBLIC_ALPHA_READINESS_PLAN.md \
  >/tmp/nevai-product-readiness-claim-hits.txt
then
  cat /tmp/nevai-product-readiness-claim-hits.txt
  fail "Found over-broad public release claim"
fi
echo "OK no over-broad readiness claim"

echo "== Product readiness smoke passed =="
