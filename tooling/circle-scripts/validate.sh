#!/bin/bash

set -e

if [ "${CIRCLE_BRANCH}" = "release" ]; then
  echo "Build running on release branch; choosing to exit rather than running test suite a second time"
  exit 0
fi

if [ "${CI_PULL_REQUEST}" ]; then
  echo "PR Build: limiting to static-analysis and node-only unit tests"
  UNIT_ONLY=true npm run grunt:circle static-analysis test coverage
  exit 0
fi

echo "Connecting to Sauce Labs"
npm run sauce:start

set +e
npm run sauce:run -- npm run grunt:circle -- static-analysis test coverage
EXIT_CODE=$?
set -e

echo "Disconnecting from Sauce Labs"
npm run sauce:stop

exit ${EXIT_CODE}
