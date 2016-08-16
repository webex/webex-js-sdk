#!/bin/bash

set -e

# Kill background tasks if the script exits early
# single quotes are intentional
# see http://stackoverflow.com/questions/360201/how-do-i-kill-background-processes-jobs-when-my-shell-script-exits
# and https://wiki.jenkins-ci.org/display/JENKINS/Aborting+a+build
trap 'JOBS=$(jobs -p); if [ -n "${JOBS}" ]; then kill "${JOBS}"; fi' SIGINT SIGTERM EXIT

docker ps
docker ps -a

echo "INSTALLING LEGACY DEPENDENCIES"
docker run ${DOCKER_RUN_OPTS} npm install

echo "CLEANING"
docker run ${DOCKER_RUN_OPTS} npm run grunt -- clean
docker run ${DOCKER_RUN_OPTS} npm run grunt:concurrent -- clean

rm -rf ${SDK_ROOT_DIR}/reports
mkdir -p ${SDK_ROOT_DIR}/reports/logs

echo "BOOTSTRAPPING MODULES"
docker run ${DOCKER_RUN_OPTS} npm run bootstrap

echo "BUILDING MODULES"
docker run ${DOCKER_RUN_OPTS} npm run build

echo "RUNNING MODULE TESTS"

PIDS=""
# Ideally, the following would be done with lerna but there seem to be some bugs
# in --scope and --ignore
for i in ${SDK_ROOT_DIR}/packages/*; do
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
  set -x
  docker run -e PACKAGE=${PACKAGE} ${DOCKER_RUN_OPTS} bash -c "npm run test:package:sauce > ${SDK_ROOT_DIR}/reports/logs/docker.${PACKAGE}.log 2>&1" &
  PIDS+=" $!"
  set +x
done

echo "RUNNING LEGACY NODE TESTS"
set -x
docker run ${DOCKER_RUN_OPTS} bash -c "npm run test:legacy:node > ${SDK_ROOT_DIR}/reports/logs/legacy.node.log 2>&1" &
PIDS+=" $!"
set +x

echo "RUNNING LEGACY BROWSER TESTS"
set -x
docker run -e PACKAGE=${legacy} ${DOCKER_RUN_OPTS} bash -c "npm run test:legacy:browser > ${SDK_ROOT_DIR}/reports/logs/legacy.browser.log 2>&1" &
PIDS+=" $!"
set +x

FINAL_EXIT_CODE=0
for P in $PIDS; do
  set +e
  set -x
  wait $P
  EXIT_CODE=$?
  set +x
  set -e

  if [ ${EXIT_CODE} -ne 0 ]; then
    FINAL_EXIT_CODE=1
  fi
  # TODO cleanup sauce files for package
done

if [ ${FINAL_EXIT_CODE} -ne 0 ]; then
  echo "One or more test suites failed to execute"
  exit ${FINAL_EXIT_CODE}
fi
