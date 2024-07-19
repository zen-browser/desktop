
export ZEN_RELEASE=1
# Check if xfvb is installed
if ! command -v xvfb-run &> /dev/null
then
  echo "xvfb-run could not be found, running without it"
  pnpm build
else
  export LLVM_PROFDATA=$HOME/.mozbuild/clang/bin/llvm-profdata
  export DISPLAY=:2
  xvfb-run -s "-screen 0 1920x1080x24 -nolisten local" pnpm build
fi
