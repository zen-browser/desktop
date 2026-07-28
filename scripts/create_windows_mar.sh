#!/usr/bin/env bash
# Create a Windows complete MAR + AUS update.xml using dist/bin (not dist/astra).
# Surfer's package step fails on GitHub Windows runners because:
#  1) windowsPathToUnix strips the drive letter (D:\a\... -> /a/...)
#  2) it looks for obj*/dist/astra instead of obj*/dist/bin
set -euo pipefail

ARCH="${1:?arch}"
VERSION="${2:?version}"
CHANNEL="${3:?channel}"
REPO="${4:?repo}"
FF_VERSION="${5:?ff-version}"

OBJ="engine/obj-${ARCH}-pc-windows-msvc"
APP_DIR="${OBJ}/dist/bin"

if [[ ! -d "${APP_DIR}" ]]; then
  echo "dist/bin missing; attempting to unpack distribution zip"
  ZIP="$(find dist "${OBJ}/dist" -maxdepth 1 -type f -name '*.win64.zip' ! -name '*xpt*' ! -name '*tests*' ! -name '*crashreporter*' 2>/dev/null | head -1 || true)"
  if [[ -z "${ZIP}" ]]; then
    echo "::error::No dist/bin and no win64.zip available for MAR packaging"
    exit 1
  fi
  mkdir -p "${APP_DIR}"
  7z x "${ZIP}" -o"${APP_DIR}" -y >/dev/null
fi

if [[ ! -f "${APP_DIR}/astra.exe" && ! -f "${APP_DIR}/firefox.exe" ]]; then
  # Some zips nest content under a single top-level folder.
  NESTED="$(find "${APP_DIR}" -maxdepth 2 -type f \( -name 'astra.exe' -o -name 'firefox.exe' \) | head -1 || true)"
  if [[ -n "${NESTED}" ]]; then
    APP_DIR="$(dirname "${NESTED}")"
  fi
fi

if [[ ! -f "${APP_DIR}/astra.exe" && ! -f "${APP_DIR}/firefox.exe" ]]; then
  echo "::error::No astra.exe/firefox.exe under ${APP_DIR}"
  ls -la "${APP_DIR}" || true
  exit 1
fi

if [[ ! -f "${APP_DIR}/precomplete" ]]; then
  echo "::error::precomplete missing under ${APP_DIR} (required for make_full_update.sh)"
  exit 1
fi

MAR_EXE="${OBJ}/dist/host/bin/mar.exe"
if [[ ! -f "${MAR_EXE}" ]]; then
  MAR_EXE="build/windows/mar.exe"
fi
if [[ ! -f "${MAR_EXE}" ]]; then
  echo "::error::mar.exe not found"
  exit 1
fi

mkdir -p dist
OUT_MAR="$(pwd)/dist/output.mar"
rm -f "${OUT_MAR}"

to_msys() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$p"
    return
  fi
  python -c 'import sys; p=sys.argv[1].replace("\\","/"); print("/"+p[0].lower()+p[2:] if len(p)>=2 and p[1]==":" else p)' "$p"
}

APP_UNIX="$(to_msys "$(cd "${APP_DIR}" && pwd)")"
OUT_UNIX="$(to_msys "${OUT_MAR}")"
MAR_UNIX="$(to_msys "$(cd "$(dirname "${MAR_EXE}")" && pwd)/$(basename "${MAR_EXE}")")"

export MAR="${MAR_UNIX}"
# Match the Package step channel IDs embedded into the Windows build.
export MOZ_PRODUCT_VERSION="${VERSION}"
export MAR_CHANNEL_ID="${MAR_CHANNEL_ID:-firefox-mozilla-central}"
export ACCEPTED_MAR_CHANNEL_IDS="${ACCEPTED_MAR_CHANNEL_IDS:-firefox-mozilla-central}"

echo "Creating MAR from ${APP_DIR}"
echo "  MAR=${MAR}"
echo "  OUT=${OUT_UNIX}"
bash engine/tools/update-packaging/make_full_update.sh "${OUT_UNIX}" "${APP_UNIX}"

test -s "${OUT_MAR}"
echo "Created $(du -h "${OUT_MAR}" | awk '{print $1}') MAR at ${OUT_MAR}"

node scripts/generate_windows_update_xml.mjs \
  --mar "${OUT_MAR}" \
  --version "${VERSION}" \
  --channel "${CHANNEL}" \
  --arch "${ARCH}" \
  --repo "${REPO}" \
  --obj-dir "${OBJ}" \
  --ff-version "${FF_VERSION}" \
  --out dist/update

echo "Windows MAR + update manifests ready"
find dist/update -type f -name update.xml -print
