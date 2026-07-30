#!/usr/bin/env bash
# Create a Windows complete MAR + AUS update.xml.
# Surfer's package step fails on GitHub Windows runners because:
#  1) windowsPathToUnix strips the drive letter (D:\a\... -> /a/...)
#  2) it looks for obj*/dist/astra instead of the packaged app tree
#
# After mach package, obj*/dist/bin exists but does NOT contain precomplete
# (that file is written into the staged package that becomes the win64 zip /
# installer). Prefer unpacking the distribution zip as the MAR source.
set -euo pipefail

ARCH="${1:?arch}"
VERSION="${2:?version}"
CHANNEL="${3:?channel}"
REPO="${4:?repo}"
FF_VERSION="${5:?ff-version}"

OBJ="engine/obj-${ARCH}-pc-windows-msvc"
MAR_SRC="dist/mar-source"

find_zip() {
  # Mozilla names aarch64 packages win64-aarch64 (see package-name.mk), not win64.
  # Prefer the arch-specific zip when present so we never fall back to dist/bin
  # (full build tree >> packaged tree, and blows Windows/MSYS ARG_MAX in mar.exe).
  local candidates=()
  if [[ "${ARCH}" == "aarch64" ]]; then
    while IFS= read -r f; do candidates+=("$f"); done < <(
      find dist "${OBJ}/dist" -maxdepth 1 -type f \( -name '*.win64-aarch64.zip' -o -name '*.win64.zip' \) \
        ! -name '*xpt*' ! -name '*tests*' ! -name '*crashreporter*' ! -name '*langpack*' \
        2>/dev/null | sort
    )
  else
    while IFS= read -r f; do candidates+=("$f"); done < <(
      find dist "${OBJ}/dist" -maxdepth 1 -type f -name '*.win64.zip' \
        ! -name '*xpt*' ! -name '*tests*' ! -name '*crashreporter*' ! -name '*langpack*' \
        ! -name '*aarch64*' \
        2>/dev/null | sort
    )
  fi
  if ((${#candidates[@]} > 0)); then
    printf '%s\n' "${candidates[0]}"
  fi
}

generate_precomplete_if_needed() {
  local app_dir="$1"
  if [[ -f "${app_dir}/precomplete" ]]; then
    return 0
  fi
  local script=""
  for candidate in \
    "engine/config/createprecomplete.py" \
    "${OBJ}/../config/createprecomplete.py"
  do
    if [[ -f "${candidate}" ]]; then
      script="$(cd "$(dirname "${candidate}")" && pwd)/$(basename "${candidate}")"
      break
    fi
  done
  if [[ -z "${script}" ]]; then
    echo "::error::precomplete missing under ${app_dir} and createprecomplete.py not found"
    ls -la "${app_dir}" || true
    exit 1
  fi
  echo "Generating precomplete in ${app_dir} via ${script}"
  (
    cd "${app_dir}"
    python "${script}"
  )
  test -f "${app_dir}/precomplete"
}

prepare_mar_source() {
  rm -rf "${MAR_SRC}"
  mkdir -p "${MAR_SRC}"

  local zip
  zip="$(find_zip)"
  if [[ -n "${zip}" ]]; then
    echo "Unpacking MAR source from ${zip}"
    7z x "${zip}" -o"${MAR_SRC}" -y >/dev/null
  elif [[ -d "${OBJ}/dist/bin" ]]; then
    echo "No packaged win64/win64-aarch64 zip; copying MAR source from ${OBJ}/dist/bin"
    echo "::warning::Using dist/bin fallback - this tree is much larger than the packaged zip and can exceed mar.exe argv limits"
    cp -a "${OBJ}/dist/bin/." "${MAR_SRC}/"
  else
    echo "::error::No win64/win64-aarch64 zip and no dist/bin available for MAR packaging"
    exit 1
  fi

  # Packaged zips nest content under a single top-level folder (e.g. astra/).
  if [[ ! -f "${MAR_SRC}/astra.exe" && ! -f "${MAR_SRC}/firefox.exe" ]]; then
    local nested nested_dir
    nested="$(find "${MAR_SRC}" -maxdepth 2 -type f \( -name 'astra.exe' -o -name 'firefox.exe' \) | head -1 || true)"
    if [[ -n "${nested}" ]]; then
      nested_dir="$(dirname "${nested}")"
      echo "Flattening nested app dir ${nested_dir}"
      shopt -s dotglob nullglob
      mv "${nested_dir}"/* "${MAR_SRC}/"
      shopt -u dotglob nullglob
      rmdir "${nested_dir}" 2>/dev/null || true
    fi
  fi

  if [[ ! -f "${MAR_SRC}/astra.exe" && ! -f "${MAR_SRC}/firefox.exe" ]]; then
    echo "::error::No astra.exe/firefox.exe under ${MAR_SRC}"
    ls -la "${MAR_SRC}" || true
    exit 1
  fi

  generate_precomplete_if_needed "${MAR_SRC}"

  # platform.ini is required for BuildID in update.xml; copy from obj if zip omitted it.
  if [[ ! -f "${MAR_SRC}/platform.ini" && -f "${OBJ}/dist/bin/platform.ini" ]]; then
    cp "${OBJ}/dist/bin/platform.ini" "${MAR_SRC}/platform.ini"
  fi
}

prepare_mar_source
APP_DIR="${MAR_SRC}"

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

# Diagnose ARG_MAX risk: make_full_update.sh historically did
#   targetfiles="$targetfiles \"$f\""; eval "$mar_command $targetfiles"
# which passes every member path as an argv element to mar.exe (no @filelist).
ARG_BYTES="$(
  python -c '
import os, sys
root = sys.argv[1]
total = 0
n = 0
for dirpath, _, filenames in os.walk(root):
    for name in filenames:
        if name in ("update.manifest", "updatev2.manifest", "updatev3.manifest"):
            continue
        rel = os.path.relpath(os.path.join(dirpath, name), root).replace("\\", "/")
        total += len(rel) + 3  # quoted path + space, as make_full_update.sh builds
        n += 1
print(f"{n} {total}")
' "${APP_DIR}"
)"
ARG_FILE_COUNT="${ARG_BYTES%% *}"
ARG_LEN="${ARG_BYTES##* }"
echo "MAR source argv estimate: ${ARG_FILE_COUNT} members / ${ARG_LEN} bytes"
# Windows CreateProcess cmdline limit is 32767; MSYS often fails earlier.
if [[ "${ARG_LEN}" -gt 28000 ]]; then
  echo "::warning::Estimated mar.exe argv (~${ARG_LEN} bytes) is near/over Windows limits; using file-list MAR creator"
fi

echo "Creating MAR from ${APP_DIR}"
echo "  MAR=${MAR}"
echo "  OUT=${OUT_UNIX}"

MAKE_FULL_UPDATE="engine/tools/update-packaging/make_full_update.sh"
if [[ ! -f "${MAKE_FULL_UPDATE}" ]]; then
  echo "::error::${MAKE_FULL_UPDATE} not found"
  exit 1
fi

# mar.exe has no response-file input. Patch the eval-based argv construction to
# write a file list and invoke scripts/mar_create_from_filelist.py instead.
ROOT_UNIX="$(to_msys "$(pwd)")"
python scripts/patch_make_full_update_arg_max.py "${MAKE_FULL_UPDATE}" "${ROOT_UNIX}"

bash "${MAKE_FULL_UPDATE}" "${OUT_UNIX}" "${APP_UNIX}"

test -s "${OUT_MAR}"
echo "Created $(du -h "${OUT_MAR}" | awk '{print $1}') MAR at ${OUT_MAR}"

# Ensure generate script can find platform.ini BuildID.
if [[ ! -f "${OBJ}/dist/bin/platform.ini" && -f "${APP_DIR}/platform.ini" ]]; then
  mkdir -p "${OBJ}/dist/bin"
  cp "${APP_DIR}/platform.ini" "${OBJ}/dist/bin/platform.ini"
fi

node scripts/generate_windows_update_xml.mjs \
  --mar "${OUT_MAR}" \
  --version "${VERSION}" \
  --channel "${CHANNEL}" \
  --arch "${ARCH}" \
  --repo "${REPO}" \
  --obj-dir "${OBJ}" \
  --mar-source "${APP_DIR}" \
  --ff-version "${FF_VERSION}" \
  --out dist/update

echo "Windows MAR + update manifests ready"
find dist/update -type f -name update.xml -print
