#!/bin/bash

# make sure we are on root
if [ ! -f "package.json" ]; then
  echo "Please run this script from the root of the project"
  exit 1
fi

rm -rf engine/browser/base/zen-components/tests/

pnpm run import
pnpm run build:ui
cd ./engine
./mach mochitest browser/base/zen-components/tests
cd ..
