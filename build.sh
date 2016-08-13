#!/bin/bash

set -e

cd builder
docker build -t spark-js-sdk-builder .
cd ..

echo "COMMON_IDENTITY_CLIENT_SECRET=${CISCOSPARK_CLIENT_SECRET}" > .env
echo "CISCOSPARK_CLIENT_SECRET=${CISCOSPARK_CLIENT_SECRET}" >> .env
echo "SAUCE_USERNAME=${SAUCE_USERNAME}" >> .env
echo "SAUCE_ACCESS_KEY=${SAUCE_ACCESS_KEY}" >> .env

echo "INSTALLING LEGACY DEPENDENCIES"
docker run -it --rm -v `pwd`:/workspace spark-js-sdk-builder npm install

echo "CLEANING"
docker run -it --rm -v `pwd`:/workspace spark-js-sdk-builder npm run grunt -- clean
docker run -it --rm -v `pwd`:/workspace spark-js-sdk-builder npm run grunt:concurrent -- clean

rm -rf reports
mkdir -p reports

echo "BOOTSTRAPPING MODULES"
docker run -it --rm -v `pwd`:/workspace spark-js-sdk-builder npm run bootstrap

echo "BUILDING MODULES"
docker run -it --rm -v `pwd`:/workspace spark-js-sdk-builder npm run build

echo "RUNNING MODULE TESTS"

PIDS=""
# Ideally, the following would be done with lerna but there seem to be some bugs
# in --scope and --ignore
for i in ./packages/*; do
  if ! echo $i | grep -qc -v test-helper ; then
    continue
  fi

  if ! echo $i | grep -qc -v bin- ; then
    continue
  fi

  if ! echo $i | grep -qc -v xunit-with-logs ; then
    continue
  fi

  PACKAGE=`echo $i | sed -e 's/.*packages\///g'`
  # Note: using & instead of -d so that wait works
  docker run -e "PACKAGE=${PACKAGE}" --rm -v `pwd`:/workspace spark-js-sdk-builder npm run test:package:sauce > reports/logs/${PACKAGE}.log 2>&1 &
  PIDS+=" $!"
done

echo "RUNNING LEGACY NODE TESTS"
docker run --rm -v `pwd`:/workspace spark-js-sdk-builder npm run test:legacy:node > reports/logs/legacy.node.log 2>&1&
PIDS+=" $!"

echo "RUNNING LEGACY BROWSER TESTS"
docker run --rm -v `pwd`:/workspace spark-js-sdk-builder npm run test:legacy:browser > reports/logs/legacy.browser.log 2>&1 &
PIDS+=" $!"

FINAL_EXIT_CODE=0
for P in $PIDS; do
  set +e
  wait $P
  EXIT_CODE=$?
  set -e

  if [ ${EXIT_CODE} -ne 0 ]; then
    FINAL_EXIT_CODE=1
  fi
done

echo "REMOVING SECRETS"
rm -f .env

if [ ${FINAL_EXIT_CODE} -ne 0 ]; then
  echo "One or more test suites failed to execute"
  exit ${FINAL_EXIT_CODE}
fi

echo "COLLECTING COVERAGE REPORTS"
npm run grunt:circle -- coverage

echo "BUMPING INTERNAL VERSION NUMBER"
npm run grunt -- release

# TODO check git log message for release version
# TODO rebuild in prod mode
# TODO build docs for publication
# TODO publish to npm
