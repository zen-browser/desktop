#!/bin/bash

set -xe

if command -v apt-get &> /dev/null; then
  sudo apt-get install python3-launchpadlib
  sudo apt-get update
  sudo apt-get install -y xvfb libnvidia-egl-wayland1 mesa-utils libgl1-mesa-dri
fi

. $HOME/.cargo/env

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

if test "$ZEN_GENERATE_PGO_DATA" = "1"; then
  cd engine
  export UPLOAD_PATH=../zen-macos-pgo-data
  export MOZ_FETCHES_DIR=/Users/runner/.mozbuild
  mkdir -p $UPLOAD_PATH

  export JARLOG_FILE="en-US.log"

  export LLVM_PROFDATA=$MOZ_FETCHES_DIR/clang/bin/llvm-profdata

  set -v

  ./mach python build/pgo/profileserver.py --binary obj-*-apple-darwin/dist/*.app/Contents/MacOS/zen

  mv merged.profdata $UPLOAD_PATH/
  mv $JARLOG_FILE $UPLOAD_PATH/
  cd ..
fi
