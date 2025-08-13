#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

IGNORE_FILES=(
  "shared.nsh"
  "ignorePrefs.json"
)

# Recursively find all .patch files in the current directory and its subdirectories
find src -type f -name "*.patch" | while read -r patch_file; do
  # Replace all - with . and remove the .patch extension
  new_file="${patch_file%/*}/$(basename "$patch_file" | sed 's/-/./' | sed 's/\.patch$//').patch"
  new_file="${new_file%.patch}"
  new_file="${new_file#src/}"

  if [[ $new_file == *-mjs ]]; then
    new_file="${new_file/-mjs/.mjs}"
  fi
  if [[ $new_file == *-ftl ]]; then
    new_file="${new_file/-ftl/.ftl}"
  fi

  new_file_base=$(basename "$new_file")
  if [[ ! " ${IGNORE_FILES[@]} " =~ " ${new_file_base} " ]]; then
    npm run export ${new_file}
  fi
done

for job in $(jobs -p); do
  echo $job
  wait $job || let "FAIL+=1"
done

echo "All patches have been exported successfully."
