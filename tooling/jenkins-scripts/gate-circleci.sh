#!/bin/bash

set -e
set -o pipefail

BRANCH="gate-${JOB_NAME}-${BUILD_NUMBER}"

PROMOTION_SHA=`cat .promotion-sha`
git checkout ${PROMOTION_SHA}
git push -f ghc ${HEAD}:/refs/heads/${BRANCH}

./tooling/circle --auth ${CIRCLECI_AUTH_TOKEN} \
  --username ciscospark \
  --project spark-js-sdk \
  --branch ${BRANCH} \
  -e CONVERSATION_SERVICE=${CONVERSATION_SERVICE} \
  -e DEVICE_REGISTRATION_URL=${DEVICE_REGISTRATION_URL} \
  -e SKIP_FLAKY_TESTS=${SKIP_FLAKY_TESTS} \
  -e ATLAS_SERVICE_URL=${ATLAS_SERVICE_URL} \
  -e HYDRA_SERVICE_URL=${HYDRA_SERVICE_URL} \
  -e WDM_SERVICE_URL=${WDM_SERVICE_URL} \
  trigger-build

git push ghc --delete ${BRANCH}
