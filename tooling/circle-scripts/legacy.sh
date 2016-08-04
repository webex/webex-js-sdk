#!/bin/bash

set -e

npm run test:legacy:${1} > ${CIRCLE_ARTIFACTS}/legacy.${1}.log 2>&1
npm run grunt:circle coverage
