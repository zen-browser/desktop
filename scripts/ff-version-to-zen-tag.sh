#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Find the most recent Zen release tag that targets a specified
# Firefox version. (The tag must be present in the local Git repo
# in order for this script to find it.)
#
# Example shell-script usage:
#   tag=$(scripts/ff-version-to-zen-tag.sh 150.0)
#   git switch -d $tag
#

ff_version=$1

error() {
  echo "Error: $1" >&2
  exit 1
}

if [ -z "$ff_version" ]; then
  echo "usage: $0 FIREFOX_VERSION"
  echo "example: $0 150.0"
  exit 1
fi

grep -Pqx '\d{3}\.\d{1,2}(\.\d{1,2})?' <<< $ff_version \
|| error 'Invalid Firefox version specified.'

# Matches a valid Zen release tag that may be returned by this script.
# Use with "grep -Px".
tag_regex='\d\.\d{1,2}(\.\d{1,2})?b?'

top=$(cd $(dirname $0) && cd .. && pwd)
version_regex="^\\s*\"version\":\\s*\"${ff_version//./\\.}\","

git -C $top log -n1 >/dev/null 2>&1 \
|| error 'This script is not inside a valid Git repository!'

# Find the (first) commit that adds the specified FF version to surfer.json
intro_commit=$(git -C $top log -G"$version_regex" --pretty='%H' dev -- surfer.json | tail -n1)
test -n "$intro_commit" \
|| error "No commit found that targets Firefox version $ff_version."

git -C $top show $intro_commit:surfer.json | grep -Eq "$version_regex" \
|| error "Got incorrect commit $intro_commit that does NOT target Firefox version $ff_version."

# Starting from the first tag on/after that commit, find the last
# (most recent) tag that still targets the desired Firefox version
zen_tag=
for tag in $(git -C $top tag --contains=$intro_commit --sort=creatordate | grep -Px "$tag_regex"); do
  if git -C $top show $tag:surfer.json | grep -Eq "$version_regex"; then
    zen_tag=$tag
  else
    break
  fi
done
test -n "$zen_tag" \
|| error "No release tag found that targets Firefox version $ff_version, would be on/after commit $intro_commit."

echo $zen_tag
