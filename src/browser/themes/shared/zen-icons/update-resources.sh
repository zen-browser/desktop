#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# note: you need to be in the same directory as the script to run it

# a list of SVG files that we should ignore when exporting, because
# they render poorly when optimized, and we don't use them in many places
# so the cost of optimizing them is higher than the benefit of having optimized SVGs
do_not_optimize=(
  "security-broken.svg"
)

if [ $(basename $PWD) != "zen-icons" ]; then
  echo "You need to be in the zen-icons directory to run this script"
  exit 1
fi

echo "# This Source Code Form is subject to the terms of the Mozilla Public" > jar.inc.mn
echo "# License, v. 2.0. If a copy of the MPL was not distributed with this" >> jar.inc.mn
echo "# file, You can obtain one at http://mozilla.org/MPL/2.0/." >> jar.inc.mn
echo "" >> jar.inc.mn

add_header_to_file() {
  # add "#filter dumbComments emptyLines substitution" if it doesnt exist at the top of the file
  HEADER="#filter dumbComments emptyLines substitution"
  file="$1"
  if ! grep -qF "$HEADER" "$file"; then
    echo "$HEADER" | cat - "$file" > temp && mv temp "$file"
  fi
}

do_icons() {
  system=$1
  preprocessed_os=$2
  echo "#ifdef XP_$preprocessed_os" >> jar.inc.mn
  wait # wait for all background processes to finish
  for filename in $system/*.svg; do
    echo "Working on $filename"
    add_header_to_file $filename
    filename=$(basename $filename)
    echo "*  skin/classic/browser/zen-icons/$filename                      (../shared/zen-icons/$system/$filename) " >> jar.inc.mn
  done
  echo "#endif" >> jar.inc.mn
}

do_common_icons() {
  for filename in common/*.svg; do
    # remove the os/ prefix
    add_header_to_file $filename
    filename=$(basename $filename)
    echo "Working on $filename"
    echo "*  skin/classic/browser/zen-icons/$filename                      (../shared/zen-icons/common/$filename) " >> jar.inc.mn
  done
  for filename in common/selectable/*.svg; do
    # remove the os/ prefix
    add_header_to_file $filename
    filename=$(basename $filename)
    echo "Working on $filename"
    echo "*  skin/classic/browser/zen-icons/selectable/$filename          (../shared/zen-icons/common/selectable/$filename) " >> jar.inc.mn
  done
}

do_icons nucleo WIN    # TODO: use windows icons
do_icons nucleo MACOSX # TODO: use macos icons
do_icons nucleo LINUX

do_common_icons

echo "Working on icons.css"
echo "  skin/classic/browser/zen-icons/icons.css                      (../shared/zen-icons/icons.css) " >> jar.inc.mn

echo "Done!"
