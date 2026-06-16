#!/usr/bin/env bash

set -xe

if command -v apt-get &> /dev/null; then
  sudo apt-get install python3-launchpadlib
  sudo apt-get update
  sudo apt-get install -y xvfb libnvidia-egl-wayland1 mesa-utils libgl1-mesa-dri
fi

LLVM_VERSION=$(cat .llvm-version)
if test -d "$HOME/.mozbuild/clang-$LLVM_VERSION/bin"; then
    export CC="$HOME/.mozbuild/clang-$LLVM_VERSION/bin/clang"
    export CXX="$HOME/.mozbuild/clang-$LLVM_VERSION/bin/clang++"
else
    export CC=clang-$LLVM_VERSION
    export CXX=clang-$LLVM_VERSION++
fi

mkdir -p ~/.zen-keys
echo "$ZEN_SAFEBROWSING_API_KEY" > ~/.zen-keys/safebrowsing.dat
echo "$ZEN_MOZILLA_API_KEY" > ~/.zen-keys/mozilla.dat
echo "$ZEN_GOOGLE_LOCATION_SERVICE_API_KEY" > ~/.zen-keys/google_location_service.dat

. $HOME/.cargo/env

bash ./scripts/mar_sign.sh -i

ulimit -n 4096

if command -v Xvfb &> /dev/null; then
  if ! test "$ZEN_CROSS_COMPILING"; then
    Xvfb :2 -nolisten tcp -noreset -screen 0 1024x768x24 &
    export LLVM_PROFDATA=$HOME/.mozbuild/clang/bin/llvm-profdata
    export DISPLAY=:2
  fi
  export ZEN_RELEASE=1
  npm run build
else
  echo "Xvfb could not be found, running without it"
  echo "ASSUMING YOU ARE RUNNING THIS ON MACOS"

  set -v
  export ZEN_RELEASE=1
  npm run build
fi

echo "Build complete, removing API keys"
rm -rf ~/.zen-keys
