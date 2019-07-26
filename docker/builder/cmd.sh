#!/bin/bash

#
# This is the entry point for the docker suite.
#

set -e

SUITE_START_TIME=$(date +%s)
MAX_RETIRES=0

trap 'onExit' EXIT

function log {
    OUT="${PACKAGE}: "
    echo "${OUT}${1}"
}

function reportTime {
    SUITE_END_TIME=$(date +%s)
    DURATION=$((SUITE_END_TIME - SUITE_START_TIME))
    log "start/end/duration/retries: ${SUITE_START_TIME}/${SUITE_END_TIME}/${DURATION}/${MAX_RETIRES}"
    echo "${PACKAGE},${SUITE_START_TIME},${SUITE_END_TIME},${DURATION},${MAX_RETIRES}" >> ./reports/timings
    log "EXIT detected with exit status $1"
}

function onExit {
    SCRIPT_EXIT_CODE=$?
    reportTime $SCRIPT_EXIT_CODE
}

# Load secrets
export env $(cat .env | xargs)

cd "${WORKSPACE}"

GRUNT_LOG_FILE="$(pwd)/reports/logs/${PACKAGE}.log"
mkdir -p "$(dirname "${GRUNT_LOG_FILE}")"
export BABEL_CACHE_PATH
BABEL_CACHE_PATH=$(pwd)/.tmp/babel-cache/${PACKAGE}.babel.json
mkdir -p "$(pwd)/.tmp/babel-cache"

if [ -n "${SDK_BUILD_DEBUG}" ]; then
    set -x
fi

# copied from http://www.tldp.org/LDP/abs/html/comparison-ops.html because I can
# never remember which is which
# > -z string is null, that is, has zero length
# > -n string is not null.

if [ -z "${PACKAGE}" ]; then
    log "PACKAGE must be defined"
    exit 20
fi

function test {
  set +e
  if [ "${PACKAGE}" == "samples" ]; then
      CI=true npm run test:samples >> "${GRUNT_LOG_FILE}" 2>&1
      EXIT_CODE=$?
      # Generate the coverage report
      npm run tooling -- test --no-tests
  elif [ "${PACKAGE}" == "@webex/webex-server" ]; then
      npm test -- --packages @webex/webex-server --node >> "${GRUNT_LOG_FILE}" 2>&1
      EXIT_CODE=$?
      # Generate the coverage report
      npm run tooling -- test --no-tests --node
  else
      # Skip unit tests in gating pipelines
      if [ -n "${PIPELINE}" ]; then
          timeout 15m npm run test -- --no-unit >> "${GRUNT_LOG_FILE}" 2>&1
      else
          timeout 15m npm run test >> "${GRUNT_LOG_FILE}" 2>&1
      fi
      EXIT_CODE=$?
  fi
  set -e
}

test

# No need to repeat if there was a success
if [ "${EXIT_CODE}" -eq "0" ]; then
    log "succeeded"
    exit 0
# Command timed out
# retry 2 times
elif [ "${EXIT_CODE}" -eq "124" ]; then
    if [ -f "./reports/junit/*/${PACKAGE}-karma.xml" -a "$MAX_RETIRES" -eq "2" ]; then
        exit 0
    else
      MAX_RETIRES=$((MAX_RETIRES + 1))
      test
    fi

# SAUCE TUNNEL FAILURES
# If we failed every iteration, check for the xml file. if the xml file exists,
# let the jenkins junit parser handle the error; if it does not, assume there's
# an infrastructure problem and fail the build.
elif [ "${EXIT_CODE}" -ne "0" ]; then
    if [ -f "./reports/junit/*/${PACKAGE}-karma.xml" ]; then
        exit 0
    fi
fi
