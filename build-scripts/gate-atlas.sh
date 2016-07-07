#!/bin/bash

set -o pipefail

export PIPELINE=true
export SAUCE=true
export XUNIT=true

export NPM_CONFIG_REGISTRY=http://engci-maven-master.cisco.com/artifactory/api/npm/webex-npm-group

LOG_FILE="$(pwd)/test.log"
rm -f "${LOG_FILE}"

ps -A | grep node | awk '{print $1}' | xargs kill
ps -A | grep sc | awk '{print $1}' | xargs kill
ps -A | grep grunt | awk '{print $1}' | xargs kill

set -e

# INSTALL
echo "Installing legacy SDK dependencies"
npm install

echo "Installing modular SDK dependencies"
npm run bootstrap

# BUILD
echo "Cleaning legacy directories"
npm run grunt -- --no-color clean

echo "Cleaning modular directories"
npm run grunt:concurrent -- --no-color clean

echo "Building modules"
npm run grunt:concurrent -- --no-color build

# TEST
echo "Connecting to Sauce Labs..."
npm run sauce:start
echo "Connected to Sauce Labs"

echo "Running legacy browser tests and teeing output to ${LOG_FILE}"

set +e
# For now, run legacy browser tests and any @atlas tagged node tests. We'll need
# to add packages as appropriate once they're a little closer to being ready.
npm run sauce:run -- npm run grunt -- connect:test karma:test 2>&1 | tee "${LOG_FILE}"
EXIT_CODE=$?
set -e

echo "Disconnecting from Sauce Labs..."
npm run sauce:stop
echo "Disconnected from Sauce Labs"

# ANALYSIS
echo "Checking build output for non-failures"

set +e
npm run check-karma-output ${EXIT_CODE} ${LOG_FILE}
ANALYZE_EXIT_CODE=$?
set -e

echo "Checked build output for non-failures"

if [ "${ANALYZE_EXIT_CODE}" -ne 0 ]; then
  echo "Tests exited with non-zero code ${EXIT_CODE}; exiting the test suite so XUNIT marks it as unstable"
  exit 0
fi

# Run subset of node tests after confirming browser tests did not fail
npm run sauce:run -- npm run grunt -- connect:test mochaTest:integration --grep "@atlas"
