#!/bin/bash

set -e

cd "${SDK_ROOT_DIR}"

echo "#"
echo "# GZIPPING ARTIFACTS"
echo "#"

set +e
rm ./.sauce/*/sauce_connect*log.gz
gzip -r ./.sauce/*/sauce_connect*log
gzip -r ./reports
