
set -ex

CURRENT_DIR=$(pwd)

git config --global init.defaultBranch main
git config --global fetch.prune true

cd $CURRENT_DIR

update_language() {
  langId=$1
  cd ./l10n
  cd $langId

  echo "Updating $langId"
  rm -rf .git

  git init 
  git remote add upstream https://github.com/mozilla-l10n/firefox-l10n/$langId
  git remote set-url upstream https://github.com/mozilla-l10n/firefox-l10n/$langId
  git pull upstream branches/default/tip

  cd $CURRENT_DIR
}

export PATH=~/tools/git-cinnabar:$PATH
for lang in $(cat ./l10n/supported-languages); do
  update_language $lang
done
cd $CURRENT_DIR

# Move all the files to the correct location

sh scripts/copy-language-pack.sh en-US
for lang in $(cat ./l10n/supported-languages); do
  sh scripts/copy-language-pack.sh $lang
done

wait

echo "Cleaning up"
rm -rf ~/tools
rm -rf ~/.git-cinnabar

for lang in $(cat ./l10n/supported-languages); do
  # remove every file except if it starts with "zen"
  find ./l10n/$lang -type f -not -name "zen*" -delete
done
