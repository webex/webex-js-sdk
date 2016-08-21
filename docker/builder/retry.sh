#!/bin/bash

#
# This file orchestrates running up to three test runs to attempt to keep suite
# stable
#

set +e

/work/test.sh
EXIT_CODE=$?

if [ "${EXIT_CODE}" -eq "0" ]; then
  exit ${EXIT_CODE}
fi

echo "Retrying ${PACKAGE} for the first time"
/work/test.sh
EXIT_CODE=$?

if [ "${EXIT_CODE}" -eq "0" ]; then
  exit ${EXIT_CODE}
fi

echo "Retrying ${PACKAGE} for the second time"
/work/test.sh
EXIT_CODE=$?
