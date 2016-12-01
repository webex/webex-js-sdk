#!/bin/bash

#
# This is the entry point for the docker suite.
#

set -e

# Load secrets
export env $(cat .env | xargs)

GRUNT_LOG_FILE="/workspace/reports/logs/${PACKAGE}.log"

if [ -n "${SDK_BUILD_DEBUG}" ]; then
  set -x
fi

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
      export SC_TUNNEL_IDENTIFIER=$(cat /proc/sys/kernel/random/uuid)
      echo "${PACKAGE}: Suite Attempt ${SUITE_ITERATION}: SC Attempt ${SC_ITERATION}: Connecting with Tunnel Identifier ${SC_TUNNEL_IDENTIFIER}"

      set +e
      daemon -U --name sauce_connect -- ${SC_BINARY} \
        -D *.ciscospark.com,*.wbx2.com,*.webex.com*,storage101.dfw1.clouddrive.com \
        -vv \
        -l "/workspace/reports/sauce/sauce_connect.${SC_ITERATION}.log" \
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
        daemon --stop --name sauce_connect
        set -e
        continue
      fi

      # Make sure to kill Sauce Connect when the script exits
      trap "daemon --stop --name sauce_connect" EXIT

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
  if [ "${PACKAGE}" == "legacy-node" ]; then
    npm run test:legacy-node > ${GRUNT_LOG_FILE} 2>&1
  elif [ "${PACKAGE}" == "legacy-browser" ]; then
    npm run test:legacy-browser > ${GRUNT_LOG_FILE} 2>&1
  else
    npm run test:package > ${GRUNT_LOG_FILE} 2>&1
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
  fi
done

if [ "${EXIT_CODE}" -ne "0" ]; then
  echo "${PACKAGE}: Suite: Test Suite failed after ${MAX_TEST_SUITE_RETRIES} attempts"
  exit "${EXIT_CODE}"
fi
