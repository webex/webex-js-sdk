#!/bin/bash

set -e

cd "$(dirname $0)/.."

# Kill background tasks if the script exits early
# single quotes are intentional
# see http://stackoverflow.com/questions/360201/how-do-i-kill-background-processes-jobs-when-my-shell-script-exits
# and https://wiki.jenkins-ci.org/display/JENKINS/Aborting+a+build
trap 'JOBS=$(jobs -p); if [ -n "${JOBS}" ]; then kill "${JOBS}"; fi' SIGINT SIGTERM EXIT

echo "################################################################################"
echo "# RUNNING TESTS"
echo "################################################################################"

PIDS=""

# The webrtc test is *very* slow in firefox, so we'll start it at the top of the
# suite
PACKAGES=" "
PACKAGES+=$(ls ./packages/node_modules | grep -v @ciscospark)
PACKAGES+=" "
PACKAGES+="$(cd ./packages/node_modules/ && find @ciscospark -maxdepth 1 -type d | egrep -v @ciscospark$) | grep -v media-adapter-webrtc"
# copied from http://www.tldp.org/LDP/abs/html/comparison-ops.html because I can
# never remember which is which
# > -z string is null, that is, has zero length
# > -n string is not null.
if [ -n "${PIPELINE}" ]; then
  PACKAGES+=" legacy-node"
  PACKAGES+=" legacy-browser"
else
  # the adapter tests are only unit tests so we don't want to run them in gating
  # pipelines
  PACKAGES="@ciscospark/media-adapter-webrtc ${PACKAGES}"
fi
for PACKAGE in ${PACKAGES}; do
  if ! echo ${PACKAGE} | grep -qc -v test-helper ; then
    continue
  fi

  if ! echo ${PACKAGE} | grep -qc -v bin- ; then
    continue
  fi

  if ! echo ${PACKAGE} | grep -qc -v xunit-with-logs ; then
    continue
  fi

  if ! echo ${PACKAGE} | grep -qc -v eslint-config ; then
    continue
  fi

  CONTAINER_NAME="$(echo ${PACKAGE} | awk -F '/' '{ print $NF }')-${BUILD_NUMBER}"

  if [ -n "${CONCURRENCY}" ]; then
    echo "Keeping concurrent job count below ${CONCURRENCY}"
    while [ $(jobs -p | wc -l) -gt ${CONCURRENCY} ]; do
      echo "."
      sleep 5
    done

    echo "The following containers are still running on this host"
    docker ps --format "table {{.ID}}\t{{.Names}}"
  else
    echo "Warning: CONCURRENCY limit not set; running all suites at once"
  fi

  echo "################################################################################"
  echo "# RUNNING ${PACKAGE} TESTS IN CONTAINER ${CONTAINER_NAME}"
  echo "################################################################################"
  # Note: using & instead of -d so that wait works
  # Note: the Dockerfile's default CMD will run package tests automatically
  eval "docker run --name=${CONTAINER_NAME} -e PACKAGE=${PACKAGE} ${DOCKER_RUN_OPTS} &"
  PID="$!"
  PIDS+=" ${PID}"
  echo "Running tests for ${PACKAGE} as ${PID}"

  echo "The following containers are running on this host"
  docker ps --format "table {{.ID}}\t{{.Names}}"
done

FINAL_EXIT_CODE=0
for PID in $PIDS; do
  echo "################################################################################"
  echo "# Waiting for $(jobs -p | wc -l) jobs to complete"
  echo "################################################################################"

  set +e
  wait $PID
  EXIT_CODE=$?
  set -e

  if [ "${EXIT_CODE}" -ne "0" ]; then
    echo "${PID} exited with code ${EXIT_CODE}; search for ${PID} above to determine which suite failed"
    FINAL_EXIT_CODE=1
  else
    echo "${PID} exited cleanly"
  fi

  echo "The following containers are still running on this host"
  docker ps --format "table {{.ID}}\t{{.Names}}"
done

./tooling/xunit-strip-logs.sh

if [ "${FINAL_EXIT_CODE}" -ne "0" ]; then
  echo "################################################################################"
  echo "# One or more test suites failed to execute"
  echo "################################################################################"
  exit ${FINAL_EXIT_CODE}
fi
