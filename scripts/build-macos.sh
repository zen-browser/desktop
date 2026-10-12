#!/usr/bin/env bash
# Build a Peppermint disk image you can install on macOS.
#
# The image contains Peppermint.app and a shortcut to the Applications
# folder. Open the image and drag Peppermint into Applications.
#
#   ./scripts/build-macos.sh
#   ./scripts/build-macos.sh --package-only
#
# --package-only skips the compile and packages the build already on disk.
# A release-optimized build (much slower, and it reclobbers the object
# directory) is:
#   ZEN_RELEASE=1 ./scripts/build-macos.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PACKAGE_ONLY=0
if [[ "${1:-}" == "--package-only" ]]; then
  PACKAGE_ONLY=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--package-only]" >&2
  exit 1
fi

log() {
  printf '\n==> %s\n' "$*"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

# Local release builds have no PGO profile. Any non-empty value skips it.
if [[ -n "${ZEN_RELEASE:-}" && -z "${ZEN_GA_DISABLE_PGO:-}" ]]; then
  export ZEN_GA_DISABLE_PGO=1
  log "PGO profile data is not available locally, so this release build skips PGO"
fi

if [[ "$PACKAGE_ONLY" -eq 0 ]]; then
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
  if [[ "${free_gb:-0}" -lt 40 ]]; then
    echo "Warning: only ${free_gb}GB free on this disk. A packaged build needs about 40GB." >&2
  fi

  log "Checking Node dependencies"
  if [[ ! -x node_modules/.bin/surfer ]]; then
    npm ci
  fi

  if [[ ! -f mozconfig ]]; then
    log "Writing a local mozconfig"
    cat > mozconfig <<'EOF'
# Created by scripts/build-macos.sh for a local build.
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

  ulimit -n 4096
  log "Building Peppermint ($jobs jobs). The first build can take a few hours."
  npm run build -- --jobs "$jobs"
fi

obj_roots=("$ROOT/engine")
if [[ -f "$ROOT/mozconfig" ]]; then
  obj="$(sed -n 's/^mk_add_options MOZ_OBJDIR=//p' "$ROOT/mozconfig" | tail -1 | tr -d '"')"
  if [[ -n "$obj" ]]; then
    obj_roots+=("$obj")
  fi
fi

# The packaged bundle lives in dist/peppermint (older builds used dist/zen).
# Other Peppermint.app copies are the unpackaged build output, and their
# parent folder is not a disk-image stage.
find_app() {
  local root candidate
  for root in "${obj_roots[@]}"; do
    [[ -d "$root" ]] || continue
    while IFS= read -r candidate; do
      parent="$(basename "$(dirname "$candidate")")"
      if [[ -d "$candidate" && ( "$parent" == "peppermint" || "$parent" == "zen" ) ]]; then
        printf '%s\n' "$candidate"
        return 0
      fi
    done < <(find "$root" -maxdepth 6 -type d -name 'Peppermint.app' \( -path '*/dist/peppermint/Peppermint.app' -o -path '*/dist/zen/Peppermint.app' \) 2>/dev/null)
  done
  return 1
}

log "Packaging the disk image"
(
  cd engine
  ./mach package
)

app=""
if app="$(find_app)"; then
  log "Ad-hoc signing $app so macOS will launch the installed copy"
  if ! codesign --force --deep --sign - "$app"; then
    echo "Warning: ad-hoc signing failed. The disk image is still usable; Gatekeeper may ask you to approve the app." >&2
    app=""
  fi
fi

mkdir -p "$ROOT/dist"
output="$ROOT/dist/Peppermint.dmg"
rm -f "$output"

if [[ -n "$app" ]]; then
  stage="$(cd "$(dirname "$app")" && pwd)"
  log "Creating $output"
  (
    cd engine
    ./mach python -m mozbuild.action.make_dmg \
      --volume-name "Peppermint" \
      "$stage" \
      "$output"
  )
else
  dmg=""
  for root in "${obj_roots[@]}"; do
    [[ -d "$root" ]] || continue
    while IFS= read -r found; do
      if [[ -z "$dmg" || "$found" -nt "$dmg" ]]; then
        dmg="$found"
      fi
    done < <(find "$root" -maxdepth 6 -type f -name '*.dmg' -path '*/dist/*.dmg' 2>/dev/null)
    if [[ -n "$dmg" ]]; then
      break
    fi
  done
  if [[ -z "$dmg" ]]; then
    echo "Packaging finished, but no Peppermint.app or .dmg was found." >&2
    exit 1
  fi
  log "Copying $dmg"
  cp "$dmg" "$output"
fi

log "Disk image ready: $output"
echo "Open it and drag Peppermint into the Applications folder."
