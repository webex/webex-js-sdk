#!/bin/bash

set -e

cd `dirname $0`

./test.sh

echo "COLLECTING COVERAGE REPORTS"
npm run grunt:circle -- coverage

echo "BUMPING INTERNAL VERSION NUMBER"
npm run grunt -- release

LAST_LOG=`git log -1 --pretty=%B`

if [[ ${LAST_LOG} == "#release"* ]]; then
  # Remove command commit, but allow it to dirty the workspace if it includes
  # changes
  git reset HEAD^
  HAS_CHANGES=`git status --porcelain | wc -l`
  if [ "${HAS_CHANGES}" -ne "0" ]; then
    echo "After removing command commit, local workspace has changes"
    echo git status
    echo "Command commits should not make changes, exiting"
    exit 1
  fi

  VERSION=`echo ${LAST_LOG} | sed -e 's/#release //g' | sed -e 's/^\s*//g' | sed -e 's/\s$//g'`
  DOCKER_RUN_OPTS="-it --rm -v `pwd`:/workspace spark-js-sdk-builder"

  echo "REBUILDING IN PRODUCTION MODE"
  docker run -e NODE_ENV=production ${DOCKER_RUN_OPTS} npm run build

  echo "BUILDING EXAMPLE APP"
  docker run -e PACKAGE=example-phone -e NODE_ENV=production ${DOCKER_RUN_OPTS} npm run grunt:package -- webpack-dev-server:build

  echo "PUBLISHING NEW VERSIONS TO NPM"
  echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > .npmrc
  npm run lerna -- publish --repo-version=${VERSION}
  rm -f .npmrc

  echo "PUBLISHING NEW DOCUMENENTATION"
  npm run grunt:circle -- publish-docs

  echo ${VERSION}
fi
