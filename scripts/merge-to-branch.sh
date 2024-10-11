set -ex

branch=zen-"$1"
default_branch="central"

if [ $branch = "zen-stable" ]; then
  $(dirname $0)/merge-to-branch.sh twilight
fi

git checkout "$branch"
git merge "$default_branch"
git push origin "$branch"

git checkout "$default_branch"