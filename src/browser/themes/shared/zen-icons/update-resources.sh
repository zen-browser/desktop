# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# note: you need to be in the same directory as the script to run it

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

merge_svg_paths() {
  # Remove all lines starting with "#" so we can use a valid svg file
  file="$1"
  echo "Merging paths in $file"
  temp_file=${file}.tmp.svg
  grep -v '^#' "$file" > $temp_file && mv $temp_file "$file"
  # migrate the svg attributes such as fill and fill-opacity, stroke, etc to the svg tag
  fill_attr=$(grep -o 'fill="[^"]*"' "$file" | head -n 1)
  fill_opacity_attr=$(grep -o 'fill-opacity="[^"]*"' "$file" | head -n 1)
  stroke_attr=$(grep -o 'stroke="[^"]*"' "$file" | head -n 1)
  stroke_width_attr=$(grep -o 'stroke-width="[^"]*"' "$file" | head -n 1)
  stroke_opacity_attr=$(grep -o 'stroke-opacity="[^"]*"' "$file" | head -n 1)
  # Use inkscape to merge all paths into one
  inkscape "$file" --actions="select-all;object-to-path;select-all;path-combine" --export-plain-svg --export-filename="${temp_file}"
  # optimize the svg
  npx svgo --multipass "${temp_file}" --config=../../../../../svgo.config.js
  # add the attributes to the svg tag
  sed -i '' "s/<svg /<svg $fill_attr $fill_opacity_attr $stroke_attr $stroke_width_attr $stroke_opacity_attr /" "${temp_file}"
  # Run it one more time
  npx svgo --multipass "${temp_file}" --config=../../../../../svgo.config.js
  mv ${temp_file} "$file"
  echo "# This Source Code Form is subject to the terms of the Mozilla Public" > $temp_file
  echo "# License, v. 2.0. If a copy of the MPL was not distributed with this" >> $temp_file
  echo "# file, You can obtain one at http://mozilla.org/MPL/2.0/." >> $temp_file
  cat "$file" >> $temp_file
  mv "$temp_file" "$file"
}

do_icons() {
  system=$1
  preprocessed_os=$2
  echo "#ifdef XP_$preprocessed_os" >> jar.inc.mn
  for filename in $system/*.svg; do
    # make it a sub-process so we can do this process faster
    merge_svg_paths $filename &
  done
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
    merge_svg_paths $filename
    add_header_to_file $filename
    filename=$(basename $filename)
    echo "*  skin/classic/browser/zen-icons/$filename                      (../shared/zen-icons/common/$filename) " >> jar.inc.mn
  done
  for filename in common/selectable/*.svg; do
    # remove the os/ prefix
    merge_svg_paths $filename
    add_header_to_file $filename
    filename=$(basename $filename)
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
