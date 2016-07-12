#!/bin/bash

set -o pipefail

export COVERAGE=true
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
npm run grunt -- --no-color --stack clean

echo "Cleaning modular directories"
npm run grunt:concurrent -- --no-color --stack clean

echo "Building modules"
NODE_ENV=test npm run grunt:concurrent -- --no-color --stack build

# TEST
echo "Connecting to Sauce Labs..."
npm run sauce:start
echo "Connected to Sauce Labs"

echo "Running all tests and teeing output to ${LOG_FILE}"

set +e
NODE_ENV=test npm run sauce:run -- npm test 2>&1 | tee "${LOG_FILE}"
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

# RELEASE
echo "Tagging new version"
npm run grunt -- release

npm run docs:build-api
npm run grunt:concurrent -- publish-docs
