LANGS_FILE="./supported-languages"

# Clean up the file
echo -n > $LANGS_FILE

# Iterate the directories in the current path
for d in */; do
  # ignore assets and .github directories
  if [ "$d" != "assets/" ] && [ "$d" != ".github/" ] && [ "$d" != "en-US/" ] && [ -d "$d" ]; then
    # Get the directory name
    lang=$(basename $d)
    echo "Added $lang"
    echo -n "$lang" >> $LANGS_FILE
    # if the language is not the last one, add a new line
    if [ "$d" != "zh-TW/" ]; then
      echo >> $LANGS_FILE
    fi
  fi
done
