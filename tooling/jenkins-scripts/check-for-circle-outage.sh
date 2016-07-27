#!/bin/bash

echo "Begin check-for-circle-outage.sh"

if [ -e 503 ]; then
  FALLBACK_TO_INTERNAL=`cat 503`
  if [ "${FALLBACK_TO_INTERNAL}" -eq "yes" ]; then
    echo "Circle appears to be having an outage, falling back to internal executors"
    echo "Complete check-for-circle-outage.sh"
    exit 0
  fi
fi

echo "Complete check-for-circle-outage.sh"

exit 1
