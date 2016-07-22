#!/bin/bash

set -e
set -o pipefail

export NPM_CONFIG_REGISTRY=http://engci-maven-master.cisco.com/artifactory/api/npm/webex-npm-group

npm install

REMOTE=upstream
BRANCH=validated-merge
USERNAME=ciscospark
PROJECT=spark-js-sdk

rm -rf ./reports

# Ensure there are no builds running/enqueued for the validated merge branch
# (jenkins should be handling the queuing, not circle)
./tooling/circle --auth ${CIRCLE_CI_AUTHTOKEN} \
  --username ${USERNAME} \
  --project ${PROJECT} \
  --branch ${BRANCH} \
  verify-no-builds-on-branch

git push -f ${REMOTE} HEAD:validated-merge

./tooling/circle --auth ${CIRCLE_CI_AUTHTOKEN} \
  --username ${USERNAME} \
  --project ${PROJECT} \
  --branch ${BRANCH} \
  trigger-build

# TODO update circle.yml cache_directories
