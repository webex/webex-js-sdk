#!/bin/bash

#
# Test runner. Executes a single test run
#

# Note: docker build will put this file in /work/ but then the WORKDIR will be
# updated to the Jenkins sdk root dir, so, actions in this file are relative to
# the sdk root dir

set -e

rm -rf ".sauce/${PACKAGE}/sc.pid"
rm -rf ".sauce/${PACKAGE}/sc.tid"
rm -rf ".sauce/${PACKAGE}/sc.ready"

# copied from http://www.tldp.org/LDP/abs/html/comparison-ops.html because I can
# never remember which is which
# > -z string is null, that is, has zero length
# > -n string is not null.

if [ -n "${SAUCE_IS_DOWN}" ]; then
  npm run test:package
else
  npm run sauce:start

  set +e
  npm run sauce:run -- npm run test:package
  EXIT_CODE=$?
  set -e

  # Don't fail the build if we fail to disconnect from sauce
  set +e
  npm run sauce:stop
  exit ${EXIT_CODE}
fi
