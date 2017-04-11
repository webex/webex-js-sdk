#!/bin/bash

set -e

# First, check if the last commit says we should release a specific version
NEXT_VERSION=$(git log -n 1 | grep '#release' | awk '{print $2}' | sed s/v//)

# If the commit message didn't specify a version, we'll need to figure out what
# type of bump this is, then do some weird stuff to get `npm version` to do the
# heave lifting
if [ -z "${NEXT_VERSION}" ]; then
  # Assume this is a patch release
  NEXT_VERSION_TYPE=patch
  # If there are breaking changes, make it a minor bump. post-1.0, this logic
  # will need to be revised
  BREAKING_COUNT=$(git log --oneline upstream/master.. | grep -c '$BREAKING CHANGE:')
  if [ $BREAKING_COUNT -gt 0 ]; then
    NEXT_VERSION_TYPE=minor
  fi

  # Now that we know the type, do some silly things to make npm version work
  #
  # Figure out the current version
  CURRENT_VERSION=$(jq -r .version lerna.json)
  # Put the current version in package.json
  sed -i.bak "s/\"version\": \".*\"/\"version\": \"${CURRENT_VERSION}\"/" package.json
  # use `npm version` to figure out the next version
  NEXT_VERSION=$(npm version ${NEXT_VERSION_TYPE} --no-git-tag-version | sed s/v//)
  # Restore package.json
  mv package.json.bak package.json
fi

# echo the new version so we can use it in the jenkinsfile
echo ${NEXT_VERSION}
