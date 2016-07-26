#!/bin/bash

set -e
set -o pipefail

./tooling/circle --auth $CIRCLE_CI_AUTHTOKEN \
  --username ciscospark \
  --project spark-js-sdk \
  --branch circleci \
  -e WDM_SERVICE_URL=https://wdm-integration.wbx2.com/wdm/api/v1 \
  -e DEVICE_REGISTRATION_URL=https://wdm-integration.wbx2.com/wdm/api/v1/devices \
  -e CONVERSATION_SERVICE=https://conversation-integration.wbx2.com/conversation/api/v1 \
  -e SKIP_FLAKY_TESTS=true \
  -e HYDRA_SERVICE_URL=https://apialpha.ciscospark.com/v1 \
  trigger-build
