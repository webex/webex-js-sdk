#!/bin/bash

#
# This is the entry point for the docker suite.
#

set -e

SUITE_START_TIME=$(date +%s)

trap 'onExit' EXIT

function log {
  OUT="${PACKAGE}: "
  if [ -n "${SUITE_ITERATION}" ]; then
    OUT="${OUT}Suite Attempt ${SUITE_ITERATION}: "
  fi
  if [ -n "${SC_ITERATION}" ]; then
    OUT="${OUT}SC Attempt ${SC_ITERATION} "
  fi
  echo "${OUT}${1}"
}

function reportTime {
  SUITE_END_TIME=$(date +%s)
  DURATION=$((SUITE_END_TIME - SUITE_START_TIME))
  log "start/end/duration/suite_attempts/sauce_attempts: ${SUITE_START_TIME}/${SUITE_END_TIME}/${DURATION}/${SUITE_ITERATION}/${SC_ITERATION}"
  echo "${PACKAGE},${SUITE_START_TIME},${SUITE_END_TIME},${DURATION},${SUITE_ITERATION},${SC_ITERATION}" >> ./reports/timings
  log "EXIT detected with exit status $1"
}

function onExit {
  SCRIPT_EXIT_CODE=$?
  stopSauce
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

function stopSauce {
  # This would be a terrible place to fail the build
  set +e

  log "Shutting down Sauce tunnel with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"
  npm run sauce:stop
}

# copied from http://www.tldp.org/LDP/abs/html/comparison-ops.html because I can
# never remember which is which
# > -z string is null, that is, has zero length
# > -n string is not null.

if [ -z "${PACKAGE}" ]; then
  log "PACKAGE must be defined"
  exit 20
fi

# FIXME prefix every log statement with $PACKAGE
for SUITE_ITERATION in $(seq 1 "${MAX_TEST_SUITE_RETRIES}"); do
  if [[ -z "${SAUCE_IS_DOWN}" && ! -e "${SC_PID_FILE}" ]]; then
    for SC_ITERATION in $(seq 1 "${MAX_SAUCE_CONNECT_RETRIES}"); do
      export SC_TUNNEL_IDENTIFIER
      SC_TUNNEL_IDENTIFIER="${PACKAGE}-$(cat /proc/sys/kernel/random/uuid)"
      log "Connecting with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"

      set +e
      npm run sauce:start
      EXIT_CODE=$?
      set -e

      if [ "${EXIT_CODE}" -ne "0" ]; then
        log "Failed"
        continue
      fi

      break;
    done

    if [ -e "${SC_PID_FILE}" ]; then
      log "SC: Connected with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"
    else
      log "SC: Failed to connect to Sauce Labs"
      exit 10
    fi
  fi

  set +e
  echo "" >> "${GRUNT_LOG_FILE}"
  echo "### Attempt ${SUITE_ITERATION} ###" >> "${GRUNT_LOG_FILE}"
  echo "" >> "${GRUNT_LOG_FILE}"
  if [ "${PACKAGE}" == "legacy-node" ]; then
    npm run test:legacy-node >> "${GRUNT_LOG_FILE}" 2>&1
  elif [ "${PACKAGE}" == "legacy-browser" ]; then
    npm run test:legacy-browser >> "${GRUNT_LOG_FILE}" 2>&1
  else
    npm run test >> "${GRUNT_LOG_FILE}" 2>&1
  fi
  EXIT_CODE=$?
  set -e

  # No need to repeat if there was a success
  if [ "${EXIT_CODE}" -eq "0" ]; then
    exit 0
  fi

  if [ -z "${SAUCE_IS_DOWN}" ]; then
    if [ ! -e "${SC_PID_FILE}" ]; then
      log "SC_PID_FILE missing after suite exited with ${EXIT_CODE}"
      rm -f "${SC_READY_FILE}"
      continue
    fi

    PID=$(cat "${SC_PID_FILE}")

    if ps -p "${PID}" > /dev/null; then
      # Sauce is still connected (as expected)
      log "sc still running after suite exited with ${EXIT_CODE}"
    else
      log "SC_PID_FILE present but identified process not running after suite exited with ${EXIT_CODE}"
      rm -f "${SC_PID_FILE}"
      rm -f "${SC_READY_FILE}"
      continue
    fi

    # SAUCE TUNNEL FAILURES
    log "Suite exited with code ${EXIT_CODE}, disconnecting/reconnecting Sauce Tunnel"
    stopSauce
  fi

done

# SAUCE TUNNEL FAILURES
# If we failed every iteration, check for the xml file. if the xml file exists,
# let the jenkins junit parser handle the error; if it does not, assume there's
# an infrastructure problem and fail the build.
if [ "${EXIT_CODE}" -ne "0" ]; then
  if [ -f "./reports/junit/*/${PACKAGE}-karma.xml" ]; then
    exit 0
  fi
fi

if [ "${EXIT_CODE}" -ne "0" ]; then
  log "Test Suite failed after ${MAX_TEST_SUITE_RETRIES} attempts"
  exit "${EXIT_CODE}"
fi

log "succeeded"
