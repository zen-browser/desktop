
# confirm before doing anything
echo "This script will merge the current branch to both the stable and twilight branches."
echo "Are you sure you want to continue? (y/n)"
read -r response
if [ "$response" != "y" ]; then
  echo "Exiting."
  exit 1
fi

set -ex

sh $(dirname $0)/merge-to-branch.sh twilight
sh $(dirname $0)/merge-to-branch.sh stable
