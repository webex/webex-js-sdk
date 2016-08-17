#!/bin/bash

set -e

cd $(dirname $0)

LAST_LOG=$(git log -1 --pretty=%B)

if [[ ${LAST_LOG} == "#release"* ]]; then
  # Remove command commit, but allow it to dirty the workspace if it includes
  # changes
  git reset HEAD^
  HAS_CHANGES=$(git status --porcelain | wc -l)
  if [ "${HAS_CHANGES}" -ne "0" ]; then
    echo "################################################################################"
    echo "# After removing command commit, local workspace has changes"
    echo "################################################################################"
    echo git status
    echo "################################################################################"
    echo "# Command commits should not make changes, exiting"
    echo "################################################################################"
    exit 1
  fi

  VERSION=$(echo ${LAST_LOG} | sed -e 's/#release //g' | sed -e 's/^\s*//g' | sed -e 's/\s$//g')
  DOCKER_RUN_OPTS="--rm --volumes-from ${HOSTNMAME} spark-js-sdk-builder"

  echo "################################################################################"
  echo "# REBUILDING IN PRODUCTION MODE"
  echo "################################################################################"
  docker run -e NODE_ENV=production ${DOCKER_RUN_OPTS} npm run build

  echo "################################################################################"
  echo "# BUILDING EXAMPLE APP"
  echo "################################################################################"
  docker run -e PACKAGE=example-phone -e NODE_ENV=production ${DOCKER_RUN_OPTS} npm run grunt:package -- webpack-dev-server:build

  echo "################################################################################"
  echo "# PUBLISHING NEW VERSIONS TO NPM"
  echo "################################################################################"
  echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > .npmrc
  npm run lerna -- publish --repo-version=${VERSION}
  rm -f .npmrc

  echo "################################################################################"
  echo "# PUBLISHING NEW DOCUMENENTATION"
  echo "################################################################################"
  npm run grunt:circle -- publish-docs

  echo ${VERSION}
fi
