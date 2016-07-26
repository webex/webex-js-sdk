#!/bin/bash

set -e
set -o pipefail

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
git checkout -b ${BUILD_NUMBER}
git push -f ${REMOTE} ${BUILD_NUMBER}:${branch}

./tooling/circle --auth ${CIRCLE_CI_AUTHTOKEN} \
  --username ${USERNAME} \
  --project ${PROJECT} \
  --branch ${BRANCH} \
  trigger-build
