#!/bin/bash

echo "$*"
echo $*
echo "$#"
echo $#
echo "$@"
echo $@

export BUILD_NUMBER=${CIRCLE_BUILD_NUM}
export XUNIT=true
export XUNIT_DIR=CIRCLE_TEST_REPORTS/junit

for i in $*; do
  PACKAGE=$I npm run sauce:run -- npm run test:package test
done
