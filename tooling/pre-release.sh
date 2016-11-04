#!/bin/bash

set -e

# Updates version numbers but *does not* publish to npm/github
cd $(dirname $)

VERSION=$(node ./get-version.js)

echo "The following packages will be updated to version ${VERSION}"
npm run lerna -- updated

set +e
npm run lerna -- publish --skip-npm --skip-git --repo-version="${VERSION}" --yes
EXIT_CODE=$?
set -e
# if lerna publish failed, assume we don't have any releaseable updates, but we
# may still have documentation updates
if [ "${EXIT_CODE}" -eq "0" ]; then
  git add lerna.json packages/*/package.json
  git commit -m "v${VERSION}"

  echo "################################################################################"
  echo "# REBUILDING WITHOUT NODE_ENV"
  echo "################################################################################"
  unset NODE_ENV
  docker run ${DOCKER_RUN_OPTS} npm run build
fi

echo "################################################################################"
echo "# BUILDING EXAMPLE APP"
echo "################################################################################"
docker run -e PACKAGE=example-phone -e NODE_ENV=production ${DOCKER_RUN_OPTS} npm run grunt:package -- webpack:build

echo "################################################################################"
echo "# BUILDING DOCS"
echo "################################################################################"
npm run grunt:concurrent -- build:docs
