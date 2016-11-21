#!/bin/bash

#
# This file orchestrates running up to three test runs to attempt to keep suite
# stable
#

set -e
FAILURE_COUNT=0
RUN_COUNT=1

#
# REMOVE REMNANT SAUCE FILES FROM PREVIOUS BUILD
#

rm -rf ".sauce/${PACKAGE}/sc.pid"
rm -rf ".sauce/${PACKAGE}/sc.tid"
rm -rf ".sauce/${PACKAGE}/sc.ready"
rm -rf ".sauce/${PACKAGE}/sauce_connect.log"
rm -rf ".sauce/${PACKAGE}/sauce_connect.*.log"

set +e
SUITE_RUN_COUNT="${RUN_COUNT}" /work/test.sh
EXIT_CODE=$?
set -e

if [ "${EXIT_CODE}" -ne "0" ]; then
  FAILURE_COUNT=1
  RUN_COUNT=2

  echo "Retrying ${PACKAGE} for the first time"

  set +e
  SUITE_RUN_COUNT="${RUN_COUNT}" /work/test.sh
  EXIT_CODE=$?
  set -e
fi

if [ "${EXIT_CODE}" -ne "0" ]; then
  FAILURE_COUNT=2
  RUN_COUNT=3

  echo "Retrying ${PACKAGE} for the second time"

  set +e
  SUITE_RUN_COUNT="${RUN_COUNT}" /work/test.sh
  EXIT_CODE=$?
  set -e
fi


if [ "${FAILURE_COUNT}" -ne "0" ]; then
  MSG="Suite for ${PACKAGE} failed ${FAILURE_COUNT} out of ${RUN_COUNT} attempts. Please see reports/logs/docker.${PACKAGE}.log for more info."

  if [ "${EXIT_CODE}" -ne "0" ]; then

    cat <<EOT > "./reports/junit/suite.${PACKAGE}.xml"
<testsuite
  name="spark-js-sdk"
  package="${PACKAGE}"
  timestamp="$(date)"
  tests="${RUN_COUNT}"
  errors="${FAILURE_COUNT}"
  failures="${FAILURE_COUNT}"
>
  <testcase
    name="${PACKAGE}"
    classname="${PACKAGE}"
    time="0.1"
  >
    <failure type="">${MSG}</failure>
  </testcase>
</testsuite>
EOT
  fi

  exit ${EXIT_CODE}
fi
