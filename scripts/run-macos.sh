#!/usr/bin/env bash
# Run Peppermint on macOS.
#
# Installs missing build tools, downloads the Firefox engine on a fresh
# checkout, builds once, then launches the browser. Later runs skip the
# build when an app is already present. Builds on an external MOZ_OBJDIR are
# ad-hoc re-signed before launch (needed after build / build:ui).
#
#   ./scripts/run-macos.sh
#   ./scripts/run-macos.sh --rebuild

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REBUILD=0
if [[ "${1:-}" == "--rebuild" ]]; then
  REBUILD=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--rebuild]" >&2
  exit 1
fi

log() {
  printf '\n==> %s\n' "$*"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

if ! xcode-select -p >/dev/null 2>&1 || ! xcodebuild -version >/dev/null 2>&1; then
  echo "Full Xcode is required. Install it from the App Store, then run:" >&2
  echo "  sudo xcode-select --switch /Applications/Xcode.app" >&2
  echo "  sudo xcodebuild -license" >&2
  exit 1
fi

if ! need_cmd brew; then
  log "Installing Homebrew"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

log "Checking Homebrew packages"
for pkg in git gnu-tar watchman yasm terminal-notifier sccache python@3.11 node@22; do
  if ! brew list --formula "$pkg" >/dev/null 2>&1; then
    brew install "$pkg"
  fi
done

export PATH="$(brew --prefix python@3.11)/libexec/bin:$(brew --prefix node@22)/bin:$PATH"

if ! need_cmd rustup; then
  log "Installing Rust"
  curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
fi
if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
fi
rustup toolchain install stable >/dev/null
rustup default stable >/dev/null

install_cbindgen=0
if ! need_cmd cbindgen; then
  install_cbindgen=1
else
  cbindgen_version="$(cbindgen --version | awk '{print $NF}')"
  if ! python3 - "$cbindgen_version" <<'PY'
import sys
parts = [int(piece) for piece in sys.argv[1].split(".")[:3]]
while len(parts) < 3:
    parts.append(0)
sys.exit(0 if tuple(parts) >= (0, 29, 4) else 1)
PY
  then
    install_cbindgen=1
  fi
fi
if [[ "$install_cbindgen" -eq 1 ]]; then
  log "Installing cbindgen"
  cargo install cbindgen --version 0.29.4 --locked
fi

free_gb="$(df -g "$ROOT" | awk 'NR==2 {print $4}')"
if [[ "${free_gb:-0}" -lt 30 ]]; then
  echo "Warning: only ${free_gb}GB free on this disk. A first build needs about 30GB." >&2
fi

log "Checking Node dependencies"
if [[ ! -x node_modules/.bin/surfer ]]; then
  npm ci
fi

find_browser() {
  local root candidate
  local roots=("$ROOT/engine")
  if [[ -f "$ROOT/mozconfig" ]]; then
    local obj
    obj="$(sed -n 's/^mk_add_options MOZ_OBJDIR=//p' "$ROOT/mozconfig" | tail -1 | tr -d '"')"
    if [[ -n "$obj" ]]; then
      roots+=("$obj")
    fi
  fi
    for root in "${roots[@]}"; do
    [[ -d "$root" ]] || continue
    local name
    for name in peppermint zen; do
      while IFS= read -r candidate; do
        if [[ -n "$candidate" && -x "$candidate" ]]; then
          printf '%s\n' "$candidate"
          return 0
        fi
      done < <(find "$root" -maxdepth 6 -type f -name "$name" -path "*/MacOS/$name" 2>/dev/null)
    done
  done
  return 1
}

# True when path lives on a different device than the boot volume (e.g. /Volumes/...).
path_on_external_disk() {
  local target="$1"
  [[ -e "$target" ]] || return 1
  local target_dev root_dev
  target_dev="$(stat -f %d "$target")"
  root_dev="$(stat -f %d /)"
  [[ "$target_dev" != "$root_dev" ]]
}

# ExFAT volumes often accumulate AppleDouble "._*" files that break ad-hoc codesign.
strip_appledouble_metadata() {
  local dir="$1"
  find "$dir" -name '._*' -delete 2>/dev/null || true
}

# UI-only builds refresh dist/bin first; keep the .app MacOS copy in sync before launch.
sync_macos_from_dist_bin() {
  local zen_bin="$1"
  local macos_dir dist_bin f
  macos_dir="$(dirname "$zen_bin")"
  dist_bin="$(cd "$macos_dir/../../.." && pwd)/bin"
  [[ -d "$dist_bin" ]] || return 0
  for f in XUL zen libmozglue.dylib libnss3.dylib libmozavutil.dylib libmozavcodec.dylib liblgpllibs.dylib; do
    if [[ ! -f "$dist_bin/$f" ]]; then
      continue
    fi
    if [[ "$f" == "XUL" ]] && [[ -L "$dist_bin/$f" || -L "$macos_dir/$f" ]]; then
      continue
    fi
    cp -f "$dist_bin/$f" "$macos_dir/$f" 2>/dev/null || true
  done
}

# Interrupted "mach build" can leave a truncated XUL; dlopen fails with rebase opcode errors.
xul_binary_is_loadable() {
  local xul="$1"
  local dist_bin="${2:-}"
  [[ -e "$xul" ]] || return 1
  if [[ -L "$xul" ]]; then
    xul="$(readlink -f "$xul" 2>/dev/null || readlink "$xul")"
  fi
  DYLD_LIBRARY_PATH="$dist_bin" python3 - "$xul" "$dist_bin" <<'PY'
import ctypes
import os
import sys

os.environ.setdefault("DYLD_LIBRARY_PATH", sys.argv[2])
try:
    ctypes.CDLL(sys.argv[1])
except OSError:
    sys.exit(1)
sys.exit(0)
PY
}

ensure_exfat_xul_on_apfs() {
  local objdir="$1"
  local dist_xul dist_bin xul_path
  [[ -n "$objdir" ]] || return 0
  exfat_build_volume "$objdir" || return 0
  dist_xul="$objdir/dist/bin/XUL"
  dist_bin="$objdir/dist/bin"
  xul_path="$dist_xul"
  if [[ -L "$dist_xul" ]]; then
    xul_path="$(readlink -f "$dist_xul" 2>/dev/null || readlink "$dist_xul")"
  fi
  if xul_binary_is_loadable "$xul_path" "$dist_bin"; then
    return 0
  fi
  log "ExFAT build volume: linking XUL on APFS (object dir stays on external disk)"
  "$ROOT/scripts/link-xul-apfs.sh"
}

exfat_build_volume() {
  local path="$1"
  [[ -e "$path" ]] || return 1
  [[ "$(diskutil info -plist "$path" 2>/dev/null | plutil -extract FilesystemName raw - 2>/dev/null)" == "ExFAT" ]]
}

# Link temp files on the boot volume; keep MOZ_OBJDIR on the external disk.
exfat_safe_build_env() {
  export TMPDIR="${TMPDIR:-$HOME/.mozbuild/tmp}"
  export COPYFILE_DISABLE=1
  mkdir -p "$TMPDIR"
}

rebuild_native_binaries() {
  local jobs="$1"
  local objdir="${2:-}"
  if pgrep -f "[/]mach build" >/dev/null 2>&1; then
    echo "A mach build is already running. Wait for it to finish, then run this script again." >&2
    exit 1
  fi
  if [[ -n "$objdir" ]] && exfat_build_volume "$objdir"; then
    jobs=1
    log "ExFAT object directory detected; linking with a single job (safer on external volumes)"
  fi
  log "Native libraries look corrupt (often after an interrupted build); rebuilding binaries"
  exfat_safe_build_env
  (
    cd engine
    ./mach build binaries -j"$jobs"
  )
  npm run build:ui
}

prepare_macos_app_for_launch() {
  local zen_bin="$1"
  local macos_dir="$2"
  local xul="$macos_dir/XUL"
  local dist_bin objdir=""
  dist_bin="$(cd "$macos_dir/../../.." && pwd)/bin"
  if [[ -f "$ROOT/mozconfig" ]]; then
    objdir="$(sed -n 's/^mk_add_options MOZ_OBJDIR=//p' "$ROOT/mozconfig" | tail -1 | tr -d '"')"
  fi

  ensure_exfat_xul_on_apfs "$objdir"
  sync_macos_from_dist_bin "$zen_bin"
  strip_appledouble_metadata "$macos_dir"
  # Test artifacts sometimes land in MacOS and break ad-hoc codesign on zen.
  [[ -d "$macos_dir/gtest" ]] && rm -rf "$macos_dir/gtest"

  if ! xul_binary_is_loadable "$xul" "$dist_bin"; then
    local mem_bytes cpus jobs
    mem_bytes="$(sysctl -n hw.memsize)"
    cpus="$(sysctl -n hw.ncpu)"
    jobs=$(( mem_bytes / 1024 / 1024 / 1024 / 4 ))
    if [[ "$jobs" -lt 2 ]]; then
      jobs=2
    fi
    if [[ "$jobs" -gt "$cpus" ]]; then
      jobs="$cpus"
    fi
    rebuild_native_binaries "$jobs" "$objdir"
    ensure_exfat_xul_on_apfs "$objdir"
    sync_macos_from_dist_bin "$zen_bin"
    strip_appledouble_metadata "$macos_dir"
    if ! xul_binary_is_loadable "$xul" "$dist_bin"; then
      echo "XUL still cannot be loaded after rebuilding binaries." >&2
      echo "Try: ./scripts/link-xul-apfs.sh && npm run build:ui" >&2
      exit 1
    fi
  fi

  if path_on_external_disk "$macos_dir"; then
    log "External build volume detected; re-signing dev binaries before launch"
    local binary signed=0 failed=0 sign_target
    for binary in XUL libmozglue.dylib zen; do
      sign_target="$macos_dir/$binary"
      if [[ ! -e "$sign_target" ]]; then
        continue
      fi
      if [[ -L "$sign_target" ]]; then
        sign_target="$(readlink -f "$sign_target" 2>/dev/null || readlink "$sign_target")"
      fi
      if codesign -f -s - "$sign_target"; then
        signed=$((signed + 1))
      else
        echo "Warning: could not re-sign $binary" >&2
        failed=$((failed + 1))
      fi
    done
    if [[ "$signed" -eq 0 ]]; then
      echo "Warning: no binaries were re-signed; the app may crash on launch." >&2
    elif [[ "$failed" -gt 0 ]]; then
      echo "Warning: some binaries failed to re-sign ($failed)." >&2
    fi
  fi
}

if [[ "$REBUILD" -eq 0 ]] && browser="$(find_browser)"; then
  macos_dir="$(dirname "$browser")"
  prepare_macos_app_for_launch "$browser" "$macos_dir"
  log "Launching $browser"
  exec npm start
fi

if [[ ! -f mozconfig ]]; then
  log "Writing a local mozconfig"
  cat > mozconfig <<'EOF'
# Created by scripts/run-macos.sh for a local development build.
ac_add_options --without-wasm-sandboxed-libraries
ac_add_options --disable-debug-symbols
EOF
fi

if [[ ! -f engine/mach ]]; then
  log "Downloading the Firefox engine"
  npm run download
fi

if [[ ! -f engine/browser/branding/release/locales/en-US/brand.ftl ]] || ! grep -q 'Peppermint' engine/browser/branding/release/locales/en-US/brand.ftl; then
  log "Importing Peppermint patches"
  npm run import
fi

python3 - <<'PY'
from pathlib import Path

linker = Path("engine/build/moz.configure/toolchain.configure")
text = linker.read_text()
old = '''            if retcode == 1 and "Logging ld64 options" in stderr:
                kind = "ld64"
'''
new = '''            if retcode == 1 and (
                "Logging ld64 options" in stderr
                or (
                    target.kernel == "Darwin"
                    and "unknown options: --version" in stderr
                )
            ):
                kind = "ld64"
'''
if "unknown options: --version" not in text and old in text:
    linker.write_text(text.replace(old, new, 1))
    print("Patched Xcode 27 linker detection")

vendor = Path("engine/browser/moz.configure")
vendor_text = vendor.read_text()
updated = vendor_text.replace(
    'imply_option("MOZ_APP_VENDOR", "Mozilla")',
    'imply_option("MOZ_APP_VENDOR", "MintFlow Technologies")',
)
if updated != vendor_text:
    vendor.write_text(updated)
    print("Set the application vendor to MintFlow Technologies")
PY

log "Selecting the Peppermint release brand"
npm run surfer -- set brand release

log "Bootstrapping the Firefox build environment"
(
  cd engine
  ./mach --no-interactive bootstrap --application-choice browser
)

log "Copying English language packs"
python3 ./scripts/update_en_US_packs.py

mem_bytes="$(sysctl -n hw.memsize)"
cpus="$(sysctl -n hw.ncpu)"
jobs=$(( mem_bytes / 1024 / 1024 / 1024 / 4 ))
if [[ "$jobs" -lt 2 ]]; then
  jobs=2
fi
if [[ "$jobs" -gt "$cpus" ]]; then
  jobs="$cpus"
fi

log "Building Peppermint ($jobs jobs). The first build can take a few hours."
npm run build -- --jobs "$jobs"

if browser="$(find_browser)"; then
  resign_macos_app_if_needed "$browser"
fi
log "Launching Peppermint"
exec npm start
