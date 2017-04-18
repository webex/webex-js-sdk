#!/bin/bash

curl "https://saucelabs.com/rest/v1/storage/${SAUCE_USERNAME}/$(basename ${1})?overwrite=true" \
  -u ${SAUCE_USERNAME}:${SAUCE_ACCESS_KEY} \
  -X POST \
  -H "Content-Type: application/octet-stream" \
   --data-binary "@${1}"
