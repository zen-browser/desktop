set -ex

branch="$1"
default_branch="central"

git checkout "$branch"
git merge "$default_branch"
git push origin "$branch"

git checkout "$default_branch"