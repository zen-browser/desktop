# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

set -x

if ! [ -z "$ZEN_L10N_CURR_DIR" ]; then
  cd $ZEN_L10N_CURR_DIR
fi

# remove "\r" from ./l10n/supported-languages
# note: it's fine if it fails
sed -i 's/\r$//' ./l10n/supported-languages

CURRENT_DIR=$(pwd)

git config --global init.defaultBranch main
git config --global fetch.prune true

cd $CURRENT_DIR

LAST_FIREFOX_L10N_COMMIT=$(cat ./build/firefox-cache/l10n-last-commit-hash)

cd ./l10n
rm -rf firefox-l10n
# clone only from LAST_FIREFOX_L10N_COMMIT
git clone https://github.com/mozilla-l10n/firefox-l10n
cd firefox-l10n
git checkout $LAST_FIREFOX_L10N_COMMIT
cd $CURRENT_DIR

rsyncExists=$(command -v rsync)

if [ -z "$rsyncExists" ]; then
  echo "rsync not found, using cp instead"
else
  echo "rsync found!"
fi

set -e

update_language() {
  langId=$1
  cd ./l10n
  cd $langId

  echo "Updating $langId"
  # move the contents from ../firefox-l10n/$langId to ./l10n/$langId
  # if rsync exists, use it
  # if not, use cp
  if [ -z "$rsyncExists" ]; then
    cp -r $CURRENT_DIR/l10n/firefox-l10n/$langId/* .
  else
    rsync -av --progress ../firefox-l10n/$langId/ . --exclude .git
  fi

  cd $CURRENT_DIR
}

export PATH=~/tools/git-cinnabar:$PATH
for lang in $(cat ./l10n/supported-languages); do
  update_language $lang
done
cd $CURRENT_DIR

# Move all the files to the correct location

python3 scripts/copy_language_pack.py en-US
for lang in $(cat ./l10n/supported-languages); do
  python3 scripts/copy_language_pack.py $lang
done

wait

echo "Cleaning up"
rm -rf ~/tools
rm -rf ~/.git-cinnabar

for lang in $(cat ./l10n/supported-languages); do
  # remove every file except if it starts with "zen"
  find ./l10n/$lang -type f -not -name "zen*" -delete
done

rm -rf ./l10n/firefox-l10n
