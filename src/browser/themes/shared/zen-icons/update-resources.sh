# note: you need to be in the same directory as the script to run it

if [ $(basename $PWD) != "zen-icons" ]; then
  echo "You need to be in the zen-icons directory to run this script"
  exit 1
fi

echo "" > jar.inc.mn

do_icons() {
  os=$1
  preprocessed_os=$2
  echo "#ifdef XP_$preprocessed_os" >> jar.inc.mn
  for filename in $os/*.svg; do
    # remove the os/ prefix
    filename=$(basename $filename)
    echo "Working on $filename"
    echo "  skin/classic/browser/zen-icons/$filename                      (../shared/zen-icons/$os/$filename) " >> jar.inc.mn
  done
  echo "#endif" >> jar.inc.mn
}

do_icons win WIN
do_icons lin MACOSX # TODO: use macos icons
do_icons lin LINUX

echo "    skin/classic/browser/zen-icons/icons.css                      (../shared/zen-icons/icons.css) " >> jar.inc.mn

echo "Done!"
