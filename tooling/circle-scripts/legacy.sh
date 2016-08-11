#!/bin/bash

set -e

npm run test:legacy:${1} > ${CIRCLE_ARTIFACTS}/legacy.${1}.log
npm run grunt:circle coverage
