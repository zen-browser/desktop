
branch="$1"
default_branch="central"

if [ -z "$branch" ]; then
  branch="$default_branch"
fi

git checkout "$branch"
git merge "$default_branch"
git push origin "$branch"

git checkout "$default_branch"