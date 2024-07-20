set -ex

export ZEN_RELEASE=1

if command -v apt-get &> /dev/null
then
  sudo apt-get update
  sudo apt-get install -y xvfb
fi

# Check if xfvb is installed
if ! command -v Xvfb &> /dev/null
then
  ulimit -n 4096
  Xvfb :2 -screen 0 1024x768x24 &
  export LLVM_PROFDATA=$HOME/.mozbuild/clang/bin/llvm-profdata
  export DISPLAY=:2
  pnpm build
else
  echo "Xvfb could not be found, running without it"
  echo "ASSUMING YOU ARE RUNNING THIS ON MACOS"
  set -v
  pnpm build
fi
