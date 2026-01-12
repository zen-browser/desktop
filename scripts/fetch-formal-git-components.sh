#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

set -e

COMPONENT_ROOT=$(pwd)/src/zen

EXTRA_COMPONENTS=(
  "scripts"
  "workflows"
  "windows"
  "flatpak"
  "configs"
)

echo "" > .formal-git/components

# iterate top directories and adding the base name to .formal-git/components
for dir in $(find $COMPONENT_ROOT -maxdepth 1 -type d | grep -v '\.git' | grep -v 'node_modules' | grep -v 'engine'); do
  if [ "$dir" != "$COMPONENT_ROOT" ]; then
    echo "$(basename $dir)" >> .formal-git/components
  fi
done

# iterate over the extra components and adding them to .formal-git/components
for extra in "${EXTRA_COMPONENTS[@]}"; do
  echo "$extra" >> .formal-git/components
done

# remove all empty lines
sed -i '/^$/d' .formal-git/components
