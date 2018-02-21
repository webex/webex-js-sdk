#!/bin/bash

set -e

echo "################################################################################"
echo "# Stripping unhelpful, jenkins breaking logs from karma xml"
echo "################################################################################"

# Make sure there's alays a reports dir, even if it has no contents, to prevent
# the next "find" from failing
mkdir -p ./reports/junit/karma
for FILE in $(find ./reports/junit/karma -name '*.xml'); do
  awk '
  BEGIN { write = 1 }
  /<system-out/{ write = 0 }
  (write) { print $0 }
  /<\/system-out/ { write = 1 }
  ' < $FILE > ${FILE}-out.xml

  # Backup the raw data in case we want to look at it later. We'll just put in
  # .tmp because exporting it as a build artifact will massively grow the build.
  mkdir -p ".tmp/$(dirname ${FILE})"
  mv ${FILE} .tmp/${FILE}

  mv ${FILE}-out.xml ${FILE}
done
