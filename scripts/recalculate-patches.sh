#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

set -e

# FIrst check if importing the patches succeeds
npm run import

IGNORE_FILES=(
  "shared.nsh"
  "ignorePrefs.json"
  "moz.configure"
)

# Recursively find all .patch files in the current directory and its subdirectories
find src -type f -name "*.patch" | while read -r patch_file; do
  # Get the file from the inside of the file as indicated by the patch
  target_file=$(grep -m 1 -E '^\+\+\+ b/' "$patch_file" | sed 's/^\+\+\+ b\///')
  if [[ -z "$target_file" ]]; then
    echo "No target file found in patch: $patch_file"
    continue
  fi

  new_file_base=$(basename "$target_file")
  if [[ ! " ${IGNORE_FILES[@]} " =~ " ${new_file_base} " ]]; then
    npm run export ${target_file}
  fi
done

for job in $(jobs -p); do
  echo $job
  wait $job || let "FAIL+=1"
done

echo "All patches have been exported successfully."
