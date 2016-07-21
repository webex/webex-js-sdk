#!/bin/bash

set -e pipefail

SDK_ROOT=`pwd`
SDK_VERSION=`cat ${SDK_ROOT}/lerna.json | jq .version`

PUBLISH_DIR="${SDK_ROOT}/../github-publish"
if [ -d "${PUBLISH_DIR}" ]; then
  cd ${PUBLISH_DIR}
  git pull --rebase
  cd ${SDK_ROOT}
else
  git clone git@github.com:ciscospark/spark-js-sdk.git "${PUBLISH_DIR}"
fi

# Note: ${SDK_ROOT}/. makes sure that we copy to .github-publish, not
# .github-publish/spark-js-sdk
rsync \
  -a \
  --delete \
  --exclude=${PUBLISH_DIR} \
  --exclude=node_modules \
  --exclude=*node_modules* \
  --exclude=.git \
  --exclude=.nvm \
  --exclude=.grunt \
  ${SDK_ROOT}/. ${PUBLISH_DIR}

cd ${PUBLISH_DIR}
git add .

set +e
git commit -m "Release ${SDK_VERSION}"
EXIT_CODE=$?
set -e

if [ ${EXIT_CODE} -ne "0" ]; then
  # no changes; no need to push to github.com
  exit 0
else
  # changes found, push to github.com
  git push
fi
