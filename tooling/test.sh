#!/bin/bash

set -e

START_DIR=$(pwd)
cd "${START_DIR}/../builder"
docker build -t spark-js-sdk-builder .
cd "${START_DIR}/.."

# Remove secrets on exit
trap "rm -f .env" EXIT

cat <<EOF >.env
COMMON_IDENTITY_CLIENT_SECRET=${CISCOSPARK_CLIENT_SECRET}
CISCOSPARK_CLIENT_SECRET=${CISCOSPARK_CLIENT_SECRET}
SAUCE_USERNAME=${SAUCE_USERNAME}
SAUCE_ACCESS_KEY=${SAUCE_ACCESS_KEY}
EOF

DOCKER_RUN_ENV=""
if [ -n "${CONVERSATION_SERVICE}" ]; then
  DOCKER_RUN_ENV+=" -e CONVERSATION_SERVICE=${CONVERSATION_SERVICE} "
fi
if [ -n "${DEVICE_REGISTRATION_URL}" ]; then
  DOCKER_RUN_ENV+=" -e DEVICE_REGISTRATION_URL=${DEVICE_REGISTRATION_URL} "
fi
if [ -n "${ATLAS_SERVICE_URL}" ]; then
  DOCKER_RUN_ENV+=" -e ATLAS_SERVICE_URL=${ATLAS_SERVICE_URL} "
fi
if [ -n "${HYDRA_SERVICE_URL}" ]; then
  DOCKER_RUN_ENV+=" -e HYDRA_SERVICE_URL=${HYDRA_SERVICE_URL} "
fi
if [ -n "${WDM_SERVICE_URL}" ]; then
  DOCKER_RUN_ENV+=" -e WDM_SERVICE_URL=${WDM_SERVICE_URL} "
fi
if [ -n "${ENABLE_NETWORK_LOGGING}" ]; then
  DOCKER_RUN_ENV+=" -e ENABLE_NETWORK_LOGGING=${ENABLE_NETWORK_LOGGING} "
fi
if [ -n "${ENABLE_VERBOSE_NETWORK_LOGGING}" ]; then
  DOCKER_RUN_ENV+=" -e ENABLE_VERBOSE_NETWORK_LOGGING=${ENABLE_VERBOSE_NETWORK_LOGGING} "
fi

DOCKER_RUN_OPTS="${DOCKER_RUN_ENV} -it --rm -v $(pwd):/workspace spark-js-sdk-builder"

echo "INSTALLING LEGACY DEPENDENCIES"
docker run ${DOCKER_RUN_OPTS} npm install

echo "CLEANING"
docker run ${DOCKER_RUN_OPTS} npm run grunt -- clean
docker run ${DOCKER_RUN_OPTS} npm run grunt:concurrent -- clean

rm -rf reports
mkdir -p reports

echo "BOOTSTRAPPING MODULES"
docker run ${DOCKER_RUN_OPTS} npm run bootstrap

echo "BUILDING MODULES"
docker run ${DOCKER_RUN_OPTS} npm run build

echo "RUNNING MODULE TESTS"

PIDS=""
# Ideally, the following would be done with lerna but there seem to be some bugs
# in --scope and --ignore
for i in ./packages/*; do
  if ! echo $i | grep -qc -v test-helper ; then
    continue
  fi

  if ! echo $i | grep -qc -v bin- ; then
    continue
  fi

  if ! echo $i | grep -qc -v xunit-with-logs ; then
    continue
  fi

  PACKAGE=$(echo $i | sed -e 's/.*packages\///g')
  # Note: using & instead of -d so that wait works
  docker run -e PACKAGE=${PACKAGE} ${DOCKER_RUN_OPTS} npm run test:package:sauce > reports/logs/${PACKAGE}.log 2>&1 &
  PIDS+=" $!"
done

echo "RUNNING LEGACY NODE TESTS"
docker run ${DOCKER_RUN_OPTS} npm run test:legacy:node > reports/logs/legacy.node.log 2>&1&
PIDS+=" $!"

echo "RUNNING LEGACY BROWSER TESTS"
docker run ${DOCKER_RUN_OPTS} npm run test:legacy:browser > reports/logs/legacy.browser.log 2>&1 &
PIDS+=" $!"

FINAL_EXIT_CODE=0
for P in $PIDS; do
  set +e
  wait $P
  EXIT_CODE=$?
  set -e

  if [ ${EXIT_CODE} -ne 0 ]; then
    FINAL_EXIT_CODE=1
  fi
done

if [ ${FINAL_EXIT_CODE} -ne 0 ]; then
  echo "One or more test suites failed to execute"
  exit ${FINAL_EXIT_CODE}
fi
