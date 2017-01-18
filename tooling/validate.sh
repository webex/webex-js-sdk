#!/bin/bash

set -e

cd $(dirname $0)

./test.sh

echo "################################################################################"
echo "# COLLECTING COVERAGE REPORTS"
echo "################################################################################"
npm run grunt:circle -- coverage

# Make sure local tags don't include failed releases
git tag | xargs git tag -d
git gc
git fetch origin --tags

VERSION=$(node ./get-version.js)
set +e
npm run lerna -- publish --skip-npm --skip-git --repo-version="${VERSION}" --yes
EXIT_CODE=$?
set -e

cd "${SDK_ROOT_DIR}"
if [ "${EXIT_CODE}" -eq "0" ]; then
  git add lerna.json packages/*/package.json
  git commit -m "v${VERSION}"
  git tag "v${VERSION}"
fi

echo "################################################################################"
echo "# BUMPING VERSION NUMBERS"
echo "################################################################################"
npm run grunt -- release
./tooling/pre-release.sh

echo "################################################################################"
echo "# STORING PROMOTION SHA"
echo "################################################################################"

git rev-parse HEAD > ${SDK_ROOT_DIR}/.promotion-sha
