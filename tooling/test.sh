#!/bin/bash

set -e
set -x

docker ps
docker ps -a

echo "INSTALLING LEGACY DEPENDENCIES"
pwd
docker run ${DOCKER_RUN_OPTS} pwd
ls
docker run ${DOCKER_RUN_OPTS} ls
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
