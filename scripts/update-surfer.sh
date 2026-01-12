#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# make sure we are on root
if [ ! -f "package.json" ]; then
  echo "Please run this script from the root of the project"
  exit 1
fi

npm update @zen-browser/surfer
npm i @zen-browser/surfer@latest -D
