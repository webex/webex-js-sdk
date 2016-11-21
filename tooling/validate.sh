#!/bin/bash

set -e

echo "DEBUG: the following tags are present in this repository"
git tag

# Make sure local tags don't include failed releases
git tag | xargs git tag -d
git gc
git fetch origin --tags

echo "DEBUG: the following tags are present in this repository (after rm/gc)"
git tag

echo "DEBUG: last tag"
git describe --tags $(git rev-list --tags --max-count=1)
LAST_TAG=$(git describe --tags $(git rev-list --tags --max-count=1))

echo "DEBUG: git updated"
git diff --name-only ${LAST_TAG} -- "packages/ciscospark"

echo "DEBUG: lerna updated"

npm run lerna -- updated

cd $(dirname $0)

./test.sh

echo "################################################################################"
echo "# COLLECTING COVERAGE REPORTS"
echo "################################################################################"
npm run grunt:circle -- coverage

echo "################################################################################"
echo "# BUMPING VERSION NUMBERS"
echo "################################################################################"
npm run grunt -- release
./pre-release.sh

echo "################################################################################"
echo "# STORING PROMOTION SHA"
echo "################################################################################"

git rev-parse HEAD > ${SDK_ROOT_DIR}/.promotion-sha
