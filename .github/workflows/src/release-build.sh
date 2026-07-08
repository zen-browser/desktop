#!/usr/bin/env bash

set -xe

if command -v apt-get &> /dev/null; then
  sudo apt-get install python3-launchpadlib
  sudo apt-get update
  sudo apt-get install -y xvfb libnvidia-egl-wayland1 mesa-utils libgl1-mesa-dri
fi

if ! test "$ZEN_CROSS_COMPILING" && test "$(uname -s)" = "Linux"; then
  if test -d "$HOME/.mozbuild/clang/bin"; then
      export CC="$HOME/.mozbuild/clang/bin/clang"
      export CXX="$HOME/.mozbuild/clang/bin/clang++"
  else
      export CC=clang
      export CXX=clang++
  fi
fi

mkdir -p ~/.zen-keys
if test "$ZEN_SAFEBROWSING_API_KEY"; then
  echo "$ZEN_SAFEBROWSING_API_KEY" > ~/.zen-keys/safebrowsing.dat
fi

if test "$ZEN_MOZILLA_API_KEY"; then
  echo "$ZEN_MOZILLA_API_KEY" > ~/.zen-keys/mozilla.dat
fi

if test "$ZEN_GOOGLE_LOCATION_SERVICE_API_KEY"; then
  echo "$ZEN_GOOGLE_LOCATION_SERVICE_API_KEY" > ~/.zen-keys/google_location_service.dat
fi

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
