#!/bin/bash

#
# This is the entry point for the docker suite. Its purpose is to redirect all
# output produced by the container to a file
#

set -e

set +e
/work/retry.sh > reports/logs/docker-${PACKAGE}.log 2>&1
EXIT_CODE=$?
set -e

if [ "${EXIT_CODE}" -ne "0" ]; then
  MSG="Suite for ${PACKAGE} failed one or more times. Please see reports/logs/docker.${PACKAGE}.log for more info."

  echo "################################################################################"
  echo "# ${MSG}"
  echo "################################################################################"
fi
