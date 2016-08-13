#!/bin/bash

set -e

cd `dirname $0`

./test.sh

echo "COLLECTING COVERAGE REPORTS"
npm run grunt:circle -- coverage

echo "BUMPING INTERNAL VERSION NUMBER"
npm run grunt -- release

# TODO check git log message for release version
# TODO rebuild in prod mode
# TODO build docs for publication
# TODO publish to npm
