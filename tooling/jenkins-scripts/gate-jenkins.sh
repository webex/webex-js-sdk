#!/bin/bash

# Actions to orchestrate running a validated-merge build internally via Jenkins

set -e
set -o pipefail
set -x

echo "Begin gate-jenkins.sh"

export NODE_ENV=test
export XUNIT=true

# INSTALL
echo "Installing modular SDK dependencies"
npm run bootstrap

# BUILD
echo "Cleaning legacy directories"
npm run grunt -- --no-color --stack clean

echo "Cleaning modular directories"
npm run grunt:concurrent -- --no-color --stack clean

echo "Building modules"
npm run grunt:circle -- build

# TEST
echo "Connecting to Sauce Labs..."
npm run sauce:start
echo "Connected to Sauce Labs"

mkdir -p reports
mkdir -p reports/logs

echo "Running all tests"
set +e
CIRCLE_ARTIFACTS=./reports/logs npm run sauce:run -- npm run grunt:circle -- static-analysis test
EXIT_CODE=$?
set -e

echo "Disconnecting from Sauce Labs..."
npm run sauce:stop
echo "Disconnected from Sauce Labs"

echo "Complete gate-jenkins.sh"

exit $EXIT_CODE
