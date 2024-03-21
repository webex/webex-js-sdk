#!/bin/bash

set -e

cd "${SDK_ROOT_DIR}"

echo "#"
echo "# GZIPPING ARTIFACTS"
echo "#"

set +e
gzip -r ./reports
