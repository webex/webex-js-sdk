#!/bin/bash

set -e


# Make sure local tags don't include failed releases
git tag | xargs git tag -d
git gc
git fetch origin --tags


# Note: the version setting stuff below belongs in pre-release.sh, but the
# grunt release command throws off lerna's version detection
echo "The following packages will be published if this build succeeds"
npm run lerna -- updated

cd $(dirname $0)
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
