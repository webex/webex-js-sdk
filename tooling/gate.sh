#!/bin/bash

set -e

cd $(dirname $0)

echo "################################################################################"
echo "# INSTALLING LEGACY DEPENDENCIES"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm install

echo "################################################################################"
echo "# CLEANING"
echo "################################################################################"

rm -rf "${SDK_ROOT_DIR}/.sauce/*/sc.*"
rm -rf "${SDK_ROOT_DIR}/.sauce/*/sauce_connect*log"

rm -rf ${SDK_ROOT_DIR}/reports
mkdir -p ${SDK_ROOT_DIR}/reports/coverage
mkdir -p ${SDK_ROOT_DIR}/reports/coverage-final
mkdir -p ${SDK_ROOT_DIR}/reports/junit
mkdir -p ${SDK_ROOT_DIR}/reports/logs
mkdir -p ${SDK_ROOT_DIR}/reports/sauce
chmod -R ugo+w ${SDK_ROOT_DIR}/reports

echo "################################################################################"
echo "# BUILDING MODULES"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm run build

./test.sh
