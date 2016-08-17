#!/bin/bash

set -e

# Kill background tasks if the script exits early
# single quotes are intentional
# see http://stackoverflow.com/questions/360201/how-do-i-kill-background-processes-jobs-when-my-shell-script-exits
# and https://wiki.jenkins-ci.org/display/JENKINS/Aborting+a+build
trap 'JOBS=$(jobs -p); if [ -n "${JOBS}" ]; then kill "${JOBS}"; fi' SIGINT SIGTERM EXIT

docker ps
docker ps -a

echo "################################################################################"
echo "# INSTALLING LEGACY DEPENDENCIES"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm install

echo "################################################################################"
echo "# CLEANING"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm run grunt -- clean
docker run ${DOCKER_RUN_OPTS} npm run grunt:concurrent -- clean

rm -rf ${SDK_ROOT_DIR}/reports
mkdir -p ${SDK_ROOT_DIR}/reports/logs

echo "################################################################################"
echo "# BOOTSTRAPPING MODULES"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm run bootstrap

echo "################################################################################"
echo "# BUILDING MODULES"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm run build

PIDS=""

echo "################################################################################"
echo "# RUNNING LEGACY NODE TESTS"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} bash -c "npm run test:legacy:node > ${SDK_ROOT_DIR}/reports/logs/legacy.node.log 2>&1" &
set -x
PIDS+=" $!"
set +x

echo "################################################################################"
echo "# RUNNING LEGACY BROWSER TESTS"
echo "################################################################################"
docker run -e PACKAGE=${legacy} ${DOCKER_RUN_OPTS} bash -c "npm run test:legacy:browser > ${SDK_ROOT_DIR}/reports/logs/legacy.browser.log 2>&1" &
set -x
PIDS+=" $!"
set +x

echo "################################################################################"
echo "# RUNNING MODULE TESTS"
echo "################################################################################"

CONCURRENCY=6
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

  echo "################################################################################"
  echo "# Docker Stats"
  echo "################################################################################"
  docker stats --no-stream

  echo "Keeping concurrent job count below ${CONCURRENCY}"
  while [ $(jobs -p | wc -l) -gt ${CONCURRENCY} ]; do
    echo "."
    sleep 5
  done

  PACKAGE=$(echo $i | sed -e 's/.*packages\///g')
  echo "################################################################################"
  echo "# RUNNING ${PACKAGE} TESTS"
  echo "################################################################################"
  # Note: using & instead of -d so that wait works
  # Note: the Dockerfile's default CMD will run package tests automatically
  docker run -e PACKAGE=${PACKAGE} ${DOCKER_RUN_OPTS} &
  set -x
  PIDS+=" $!"
  set +x
done

FINAL_EXIT_CODE=0
for P in $PIDS; do
  echo "################################################################################"
  echo "# Docker Stats"
  echo "################################################################################"
  docker stats --no-stream

  echo "################################################################################"
  echo "# Waiting for $(jobs -p | wc -l) jobs to complete"
  echo "################################################################################"

  set +e
  set -x
  wait $P
  EXIT_CODE=$?
  set +x
  set -e

  if [ "${EXIT_CODE}" -ne "0" ]; then
    FINAL_EXIT_CODE=1
  fi
  # TODO cleanup sauce files for package
done

if [ "${FINAL_EXIT_CODE}" -ne "0" ]; then
  echo "################################################################################"
  echo "# One or more test suites failed to execute"
  echo "################################################################################"
  exit ${FINAL_EXIT_CODE}
fi
