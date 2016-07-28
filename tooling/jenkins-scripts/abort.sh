#!/bin/bash

set -e

if [ ! -e CIRCLE_BUILD_NUMBER ]; then
  exit 0
fi

USERNAME=ciscospark
PROJECT=spark-js-sdk

echo "Attempting to abort build on Circle CI"
CIRCLE_BUILD_NUMBER=`cat CIRCLE_BUILD_NUMBER`

./tooling/circle cancel-build \
  --auth=${CIRCLECI_AUTH_TOKEN} \
  --username=${USERNAME} \
  --project=${PROJECT} \
  --build_num=${CIRCLE_BUILD_NUMBER}
