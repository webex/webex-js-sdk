#!/bin/bash

set -x
set -e
set -o pipefail

export NPM_CONFIG_REGISTRY=http://engci-maven-master.cisco.com/artifactory/api/npm/webex-npm-group

npm install

set +e
git remote | grep -qc ghc
IS_MISSING_GHC_REMOTE=$?
set -e
if [ $IS_MISSING_GHC_REMOTE -eq "1" ]; then
  git remote add ghc git@github.com:ciscospark/spark-js-sdk.git
fi

# TODO move to docker image
# Avoid Host key verification failed errors
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

REMOTE=ghc
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
