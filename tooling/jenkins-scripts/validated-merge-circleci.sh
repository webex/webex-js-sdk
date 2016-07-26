#!/bin/bash

set -e
set -o pipefail

npm install

REMOTE=ghc
BRANCH=validated-merge
USERNAME=ciscospark
PROJECT=spark-js-sdk

rm -rf ./reports

rm -f 503

# Ensure there are no builds running/enqueued for the validated merge branch
# (jenkins should be handling the queuing, not circle)
./tooling/circle --auth ${CIRCLE_CI_AUTHTOKEN} \
  --username ${USERNAME} \
  --project ${PROJECT} \
  --branch ${BRANCH} \
  verify-no-builds-on-branch

echo "Pushing validated-merge result to GitHub validated-merge branch"
git push -f ${REMOTE} HEAD:validated-merge

echo "Validating validated-merge result using Circle CI"
./tooling/circle --auth ${CIRCLE_CI_AUTHTOKEN} \
  --username ${USERNAME} \
  --project ${PROJECT} \
  --branch ${BRANCH} \
  trigger-build
