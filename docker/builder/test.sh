#!/bin/bash

#
# Test runner. Executes a single test run
#

# Note: docker build will put this file in /work/ but then the WORKDIR will be
# updated to the Jenkins sdk root dir, so, actions in this file are relative to
# the sdk root dir

set -e
npm run sauce:start
set +e
npm run sauce:run -- npm run test:package
EXIT_CODE=$?
set -e
npm run sauce:stop

exit ${EXIT_CODE}
