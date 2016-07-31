#!/bin/bash

set -e

npm run test:legacy > ${CIRCLE_ARTIFACTS}/legacy.log 2>&1
