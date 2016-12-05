#!/bin/bash

set -e

# Kill background tasks if the script exits early
# single quotes are intentional
# see http://stackoverflow.com/questions/360201/how-do-i-kill-background-processes-jobs-when-my-shell-script-exits
# and https://wiki.jenkins-ci.org/display/JENKINS/Aborting+a+build
trap 'JOBS=$(jobs -p); if [ -n "${JOBS}" ]; then kill "${JOBS}"; fi' SIGINT SIGTERM EXIT

echo "################################################################################"
echo "# INSTALLING LEGACY DEPENDENCIES"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm install

echo "################################################################################"
echo "# CLEANING"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm run grunt -- clean
docker run ${DOCKER_RUN_OPTS} npm run grunt:concurrent -- clean
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
echo "# BOOTSTRAPPING MODULES"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm run bootstrap

echo "################################################################################"
echo "# BUILDING MODULES"
echo "################################################################################"
docker run ${DOCKER_RUN_OPTS} npm run build

echo "################################################################################"
echo "# RUNNING TESTS"
echo "################################################################################"

PIDS=""

# Ideally, the following would be done with lerna but there seem to be some bugs
# in --scope and --ignore
PACKAGES=$(ls "${SDK_ROOT_DIR}/packages")
PACKAGES+=" legacy-node"
PACKAGES+=" legacy-browser"
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

  CONTAINER_NAME="${PACKAGE}-${BUILD_NUMBER}"

  if [ -n "${CONCURRENCY}" ]; then
    echo "Keeping concurrent job count below ${CONCURRENCY}"
    while [ $(jobs -p | wc -l) -gt ${CONCURRENCY} ]; do
      echo "."
      sleep 5
    done
  else
    echo "Warning: CONCURRENCY limit not set; running all suites at once"
  fi

  echo "################################################################################"
  echo "# RUNNING ${PACKAGE} TESTS IN CONTAINER ${CONTAINER_NAME}"
  echo "################################################################################"
  # Note: using & instead of -d so that wait works
  # Note: the Dockerfile's default CMD will run package tests automatically
  docker run --name "${CONTAINER_NAME}" -e PACKAGE=${PACKAGE} ${DOCKER_RUN_OPTS} &
  PID="$!"
  PIDS+=" ${PID}"
  echo "Running tests for ${PACKAGE} as ${PID}"
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
  fi
done

echo "################################################################################"
echo "# Stripping unhelpful, jenkins breaking logs from karma xml"
echo "################################################################################"

cd ${SDK_ROOT_DIR}
for FILE in $(find ./reports/junit -name "karma-*.xml") ; do
  awk '
  BEGIN { write = 1 }
  /<system-out/{ write = 0 }
  (write) { print $0 }
  /<\/system-out/ { write = 1 }
  ' < $FILE > ${FILE}-out.xml

  # Backup the raw data in case we want to look at it later. We'll just put in
  # .tmp because exporting it as a build artifact will massively grow the build.
  mkdir -p ".tmp/$(dirname ${FILE})"
  mv ${FILE} .tmp/${FILE}

  mv ${FILE}-out.xml ${FILE}
done

if [ "${FINAL_EXIT_CODE}" -ne "0" ]; then
  echo "################################################################################"
  echo "# One or more test suites failed to execute"
  echo "################################################################################"
  exit ${FINAL_EXIT_CODE}
fi
