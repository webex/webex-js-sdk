#!/bin/bash

set -e

# Make sure local tags don't include failed releases
git tag | xargs git tag -d

cd $(dirname $0)

./test.sh

echo "################################################################################"
echo "# COLLECTING COVERAGE REPORTS"
echo "################################################################################"
npm run grunt:circle -- coverage

echo "################################################################################"
echo "# BUMPING INTERNAL VERSION NUMBER"
echo "################################################################################"
npm run grunt -- release

echo "################################################################################"
echo "# STORING PRMOTION SHA"
echo "################################################################################"

git rev-parse HEAD > ${SDK_ROOT_DIR}/.promotion-sha
