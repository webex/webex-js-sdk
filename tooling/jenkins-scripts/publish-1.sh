#!/bin/bash

set -e
set -o pipefail

echo "Installing Tooling and legacy node_modules"
npm install

REMOTE=ghc
BRANCH=release
USERNAME=ciscospark
PROJECT=spark-js-sdk

# Ensure there are no builds running/enqueued for the branch
./tooling/circle --auth ${CIRCLE_CI_AUTHTOKEN} \
  --username ${USERNAME} \
  --project ${PROJECT} \
  --branch ${BRANCH} \
  verify-no-builds-on-branch

# We're currently on a detached head; name it so we can merge back to it when
# the build succeeds
echo "Naming branch to leave detached-head state"
git checkout -b ${BUILD_NUMBER}
echo "Pushing validated merge result to GitHub release branch"
git push -f ${REMOTE} ${BUILD_NUMBER}:${branch}

echo "Publishing validated-merge result via Circle CI"
./tooling/circle --auth ${CIRCLE_CI_AUTHTOKEN} \
  --username ${USERNAME} \
  --project ${PROJECT} \
  --branch ${BRANCH} \
  trigger-build
