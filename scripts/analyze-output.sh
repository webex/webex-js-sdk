#!/bin/bash

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $(basename $0) <EXIT_CODE> <LOG_FILE>"
  exit -1
fi

EXIT_CODE="${1}"
LOG_FILE="${2}"

if [ ${EXIT_CODE} -ne 0 ]; then
  echo "Build appeared to fail; checking for known non-failure conditions"
  set +e
  ERROR_COUNT=$(egrep -c '^[[:space:]]+errors:' ${LOG_FILE})
  ELE_COUNT=$(egrep -c "Fatal error: Cannot read property 'ele' of null" ${LOG_FILE})
  set -e
  if [ ${ELE_COUNT} -gt 0 -a ${ERROR_COUNT} -eq 0 ]; then
    echo "Deeming this build a success despite status code of ${EXIT_CODE}"
    exit 0
  else
    echo "Build did, in fact, fail"
    exit 1
  fi
fi

exit 0
