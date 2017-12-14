#!/bin/bash

set -e

npm run build --skip-samples
rm -rf coverage reports cov .nyc_output
npm test -- --package @ciscospark/common --coverage
npm test -- --package @ciscospark/common-evented --coverage
nyc report --temp-directory=./reports/intermediate/json --reporter=html
open ./coverage/index.html
