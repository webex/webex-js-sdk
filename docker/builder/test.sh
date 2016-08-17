#!/bin/bash
#
# Note: docker build will put this file in /work/ but then the WORKDIR will be
# updated to the Jenkins sdk root dir, so, actions in this file are relative to
# the sdk root dir

set -e

npm run sauce:start
set +e
npm run sauce:run -- npm run test:package > reports/logs/docker-${PACKAGE}.log 2>&1
EXIT_CODE=$?
set -e
npm run sauce:stop

echo "Suite exited withe code ${EXIT_CODE}"

if [ "${EXIT_CODE}" -ne "0" ]; then
  MSG="Suite exited with non-zero return code. Please see reports/logs/docker.${PACKAGE}.log for more info."
  echo "################################################################################"
  echo "# ${MSG}"
  echo "################################################################################"
  cat <<EOT > "./reports/junit/suite.${PACKAGE}.xml"
<testsuite
  name="spark-js-sdk"
  package="${PACKAGE}"
  timestamp="${(new Date()).toISOString()}"
  tests="1"
  errors="1"
  failures="1"
>
  <testcase
    name="${PACKAGE}"
    classname="${PACKAGE}"
    time="0.1"
  >
    <failure type="">${MSG}</failure>
  </testcase>
</testcase>
EOT
fi
exit ${EXIT_CODE}
