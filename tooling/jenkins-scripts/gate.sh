#!/bin/bash

set -e

echo "Begin gate.sh"

# Make sure there's no 503 artifact lingering from a previous build
echo "no" > 503

rm -rf reports

PROMOTION_SHA=`cat .promotion-sha`
git checkout ${PROMOTION_SHA}

echo "Installing legacy SDK dependencies"
npm install

if [ "${USE_CIRCLE}" = "true" ]; then
  ./tooling/jenkins-scripts/gate-circle.sh
  set +e
  ./tooling/jenkins-scripts/check-for-circle-outage.sh
  CIRCLE_OUTAGE_OCCURRED=$?
  set -e
  if [ "${CIRCLE_OUTAGE_OCCURRED}" = "0" ]; then
    rm -rf reports
    ./tooling/jenkins-scripts/gate-jenkins.sh
  fi
else
  ./tooling/jenkins-scripts/gate-jenkins.sh
fi

echo "Complete gate.sh"
