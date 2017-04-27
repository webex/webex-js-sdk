#!/bin/bash

#
# This is the entry point for the docker suite.
#

set -e

# Load secrets
export env $(cat .env | xargs)

cd ${WORKSPACE}

GRUNT_LOG_FILE="$(pwd)/reports/logs/${PACKAGE}.log"
mkdir -p "$(dirname ${GRUNT_LOG_FILE})"
export BABEL_CACHE_PATH
BABEL_CACHE_PATH=$(pwd)/.tmp/babel-cache/${PACKAGE}.babel.json
mkdir -p "$(pwd)/.tmp/babel-cache"

if [ -n "${SDK_BUILD_DEBUG}" ]; then
  set -x
fi

function STOP_SAUCE {
  # This would be a terrible place to fail the build
  set +e

  echo "${PACKAGE}: Shutting down Sauce tunnel with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"
  daemon --stop --name sauce_connect
  PID_CHECK=0
  while [[ -e "${SC_PID_FILE}" && ${PID_CHECK} -lt 24 ]]; do
    sleep 5
    let PID_CHECK+=1
    echo "${PACKAGE}: SC Shutdown Check: ${PID_CHECK}"
  done

  if [ -e "${SC_PID_FILE}" ]; then
    echo "${PACKAGE}: SC PID file still exists after two minutes; exiting anyway"
  else
    echo "${PACKAGE}: SC Tunnel closed successfully"
  fi
}

# copied from http://www.tldp.org/LDP/abs/html/comparison-ops.html because I can
# never remember which is which
# > -z string is null, that is, has zero length
# > -n string is not null.

if [ -z "${PACKAGE}" ]; then
  echo "${PACKAGE}: PACKAGE must be defined"
  exit 20
fi

# FIXME prefix every log statement with $PACKAGE
for SUITE_ITERATION in $(seq 1 "${MAX_TEST_SUITE_RETRIES}"); do
  if [[ -z "${SAUCE_IS_DOWN}" && ! -e "${SC_PID_FILE}" ]]; then
    for SC_ITERATION in $(seq 1 "${MAX_SAUCE_CONNECT_RETRIES}"); do
      export SC_TUNNEL_IDENTIFIER
      SC_TUNNEL_IDENTIFIER="${PACKAGE}-$(cat /proc/sys/kernel/random/uuid)"
      echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC Attempt ${SC_ITERATION}: Connecting with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"

      set +e
      daemon -U --name sauce_connect -- ${SC_BINARY} \
        -B mercury-connection-a.wbx2.com,mercury-connection-intb.ciscospark.com \
        -t internal-testing-services.wbx2.com,127.0.0.1,localhost \
        -vv \
        -l "$(pwd)/reports/sauce/sauce_connect.$(echo ${PACKAGE} | awk -F '/' '{ print $NF }').${SC_ITERATION}.log" \
        --tunnel-identifier "${SC_TUNNEL_IDENTIFIER}" \
        --pidfile "${SC_PID_FILE}" \
        --readyfile "${SC_READY_FILE}"
      EXIT_CODE=$?
      set -e

      if [ "${EXIT_CODE}" -ne "0" ]; then
        echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC Attempt ${SC_ITERATION}: Failed"
        continue
      fi

      echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC Attempt ${SC_ITERATION}: Succeeded, waiting for readyfile"

      READY_CHECK=0
      while [[ ! -e "${SC_READY_FILE}" && ${READY_CHECK} -lt 24 ]]; do
        sleep 5
        let READY_CHECK+=1
        echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC Attempt ${SC_ITERATION}: Ready Check: ${READY_CHECK}"
      done

      if [ ! -e "${SC_READY_FILE}" ]; then
        echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC Attempt ${SC_ITERATION}: Ready Check Failed"
        set +e
        STOP_SAUCE
        set -e
        continue
      fi

      # Make sure to kill Sauce Connect when the script exits
      trap "STOP_SAUCE" EXIT

      break;
    done

    if [ -e "${SC_PID_FILE}" ]; then
      echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC: Connected with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"
    else
      echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC: Failed to connect to Sauce Labs"
      exit 10
    fi
  fi

  set +e
  echo "" >> ${GRUNT_LOG_FILE}
  echo "### Attempt ${SUITE_ITERATION} ###" >> ${GRUNT_LOG_FILE}
  echo "" >> ${GRUNT_LOG_FILE}
  if [ "${PACKAGE}" == "legacy-node" ]; then
    npm run test:legacy-node >> ${GRUNT_LOG_FILE} 2>&1
  elif [ "${PACKAGE}" == "legacy-browser" ]; then
    npm run test:legacy-browser >> ${GRUNT_LOG_FILE} 2>&1
  else
    npm run test >> ${GRUNT_LOG_FILE} 2>&1
  fi
  EXIT_CODE=$?
  set -e

  # No need to repeat if there was a success
  if [ "${EXIT_CODE}" -eq "0" ]; then
    exit 0
  fi

  if [ -z "${SAUCE_IS_DOWN}" ]; then
    if [ ! -e "${SC_PID_FILE}" ]; then
      echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC_PID_FILE missing after suite exited with ${EXIT_CODE}"
      rm -f "${SC_READY_FILE}"
      continue
    fi

    PID=$(cat "${SC_PID_FILE}")

    if ps -p "${PID}" > /dev/null; then
      # Sauce is still connected (as expected)
      echo "${PACKAGE}: "
    else
      echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC_PID_FILE present but identified process not running after suite exited with ${EXIT_CODE}"
      rm -f "${SC_PID_FILE}"
      rm -f "${SC_READY_FILE}"
      continue
    fi

    # SAUCE TUNNEL FAILURES
    echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: Suite exited with code ${EXIT_CODE}, disconnecting/reconnecting Sauce Tunnel"
    STOP_SAUCE
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
