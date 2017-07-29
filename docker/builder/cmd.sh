#!/bin/bash

set -e

E_NO_PACKAGE=10
E_SAUCE_CONNECT_FAILED=20
E_NO_SAUCE_CONNECT_PID=30
#
# This is the entry point for the docker suite.
#

# copied from http://www.tldp.org/LDP/abs/html/comparison-ops.html because I can
# never remember which is which
# > -z string is null, that is, has zero length
# > -n string is not null.

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

function onExit {
  SCRIPT_EXIT_CODE=$?
  stopSauce
  reportTime $SCRIPT_EXIT_CODE
}

function reportTime {
  if [ "$1" == "0" ]; then
    SUITE_END_TIME=$(date +%s)
    DURATION=$((SUITE_END_TIME - SUITE_START_TIME))
    echo "${PACKAGE} start/end/duration/suite_retries/sauce_retries: ${SUITE_START_TIME}/${SUITE_END_TIME}/${DURATION}/${SUITE_ITERATION}/${SC_ITERATION}"
    echo "${PACKAGE},${SUITE_START_TIME},${SUITE_END_TIME},${DURATION},${SUITE_ITERATION},${SC_ITERATION}" >> ./reports/timings
  fi
  echo "Suite for ${PACKAGE} exited with status ${1}"
}

function startSauce {
  "${SC_BINARY}" \
    -B "*.wbx2.com,*.ciscospark.com,idbroker.webex.com,127.0.0.1,localhost" \
    -t internal-testing-services.wbx2.com,127.0.0.1,localhost \
    -vv \
    -l "$(pwd)/reports/sauce/sauce_connect.$(echo "${PACKAGE}" | awk -F '/' '{ print $NF }').${SC_ITERATION}.log" \
    --tunnel-identifier "${SC_TUNNEL_IDENTIFIER}" \
    --pidfile "${SC_PID_FILE}" \
    --readyfile "${SC_READY_FILE}" \
    &
  SAUCE_PID=$!
  export SAUCE_PID

  kill -0 "${SAUCE_PID}"
  EXIT_CODE="$?"
  # Succesfully launched sauce, wait for ready file
  if [ "${EXIT_CODE}" == "0" ]; then
    log "Succeeded, waiting for readyfile"
    READY_CHECK=0
    while [[ ! -e "${SC_READY_FILE}" && ${READY_CHECK} -lt 24 ]]; do
      sleep 5
      let READY_CHECK+=1
      log "Ready Check: ${READY_CHECK}"
    done

    if [ ! -e "${SC_READY_FILE}" ]; then
      log "Ready Check Failed"
      set +e
      stopSauce
      set -e
      return 1
    fi
  else
    log "Failed"
    return 2
  fi

  return 0
}

function stopSauce {
  # This would be a terrible place to fail the build
  set +e

  echo "${PACKAGE}: Shutting down Sauce tunnel with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"

  kill -9 "${SAUCE_PID}"
}

set -e

SUITE_START_TIME=$(date +%s)

# Load secrets
export env $(cat .env | xargs)

# Make sur we're in the workspace directory
cd "${WORKSPACE}"

GRUNT_LOG_FILE="$(pwd)/reports/logs/${PACKAGE}.log"
mkdir -p "$(dirname "${GRUNT_LOG_FILE}")"
export BABEL_CACHE_PATH
BABEL_CACHE_PATH=$(pwd)/.tmp/babel-cache/${PACKAGE}.babel.json
mkdir -p "$(pwd)/.tmp/babel-cache"

if [ -n "${SDK_BUILD_DEBUG}" ]; then
  set -x
fi

if [ -z "${PACKAGE}" ]; then
  echo "${PACKAGE}: PACKAGE must be defined"
  exit "${E_NO_PACKAGE}"
fi

# FIXME prefix every log statement with $PACKAGE
for SUITE_ITERATION in $(seq 1 "${MAX_TEST_SUITE_RETRIES}"); do
  if [ -z "${SAUCE_IS_DOWN}" ]; then
    for SC_ITERATION in $(seq 1 "${MAX_SAUCE_CONNECT_RETRIES}"); do
      export SC_TUNNEL_IDENTIFIER
      SC_TUNNEL_IDENTIFIER="${PACKAGE}-$(cat /proc/sys/kernel/random/uuid)"
      log "Connecting with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"

      startSauce
      SAUCE_CONNECTED=$?
      if [ "${SAUCE_CONNECTED}" == "0" ]; then
        unset SC_ITERATION
        break
      fi
    done

    kill -0 "${SAUCE_PID}"
    EXIT_CODE=$?

    if [ "${EXIT_CODE}" == "0" ]; then
      log "Connected with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"
    elif [ "${EXIT_CODE}" == "1" ]; then
      log "Failed to connect to Sauce Labs"
      exit "${E_SAUCE_CONNECT_FAILED}"
    elif [ "${EXIT_CODE}" == "2" ]; then
      log "Sauce Lab Tunnel PID is not defined"
      exit "${E_NO_SAUCE_CONNECT_PID}"
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
    echo "${PACKAGE} Suite completed successfully"
    exit 0
  fi

  if [ -z "${SAUCE_IS_DOWN}" ]; then
    if ps -p "${SAUCE_PID}" > /dev/null; then
      # Sauce is still connected (as expected)
      log "Suite failed, but sauce still appears connected"
    else
      log "Process identified by SAUCE_PID not running after suite exited with ${EXIT_CODE}"
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
  echo "${PACKAGE}: Suite: Test Suite failed after ${MAX_TEST_SUITE_RETRIES} attempts"
  exit "${EXIT_CODE}"
fi

echo "${PACKAGE}: Suite: succeeded"
