#!/bin/bash

set -e

# Make sure local tags don't include failed releases
git tag | xargs git tag -d
git fetch origin --tags

echo "DEBUG: the following tags are present in this repository"
git tag

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
