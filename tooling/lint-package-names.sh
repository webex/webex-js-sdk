#!/bin/bash

set -e
shopt -s extglob

DEPRECATED_PACKAGES="@webex/bin-sauce-connect \
  @webex/test-helper-sinon \
  @webex/internal-plugin-devices \
  @ciscospark/storage-adapter-session-storage \
  @ciscospark/test-helper-automation \
  @ciscospark/sparkd \
  @ciscospark/recipe-private-web-client \
  @ciscospark/test-helper-mock-socket \
  @ciscospark/test-helper-server \
  @ciscospark/storage-adapter-local-forage \
  @ciscospark/common \
  @ciscospark/common-evented \
  @ciscospark/common-timers \
  @ciscospark/helper-html \
  @ciscospark/helper-image \
  @ciscospark/http-core \
  @ciscospark/internal-plugin-avatar \
  @ciscospark/internal-plugin-board \
  @ciscospark/internal-plugin-calendar \
  @ciscospark/internal-plugin-conversation \
  @ciscospark/internal-plugin-encryption \
  @ciscospark/internal-plugin-feature \
  @ciscospark/internal-plugin-flag \
  @ciscospark/internal-plugin-locus \
  @ciscospark/internal-plugin-lyra \
  @ciscospark/internal-plugin-mercury \
  @ciscospark/internal-plugin-metrics \
  @ciscospark/internal-plugin-presence \
  @ciscospark/internal-plugin-search \
  @ciscospark/internal-plugin-support \
  @ciscospark/internal-plugin-team \
  @ciscospark/internal-plugin-user \
  @ciscospark/internal-plugin-wdm \
  @ciscospark/media-engine-webrtc \
  @ciscospark/plugin-authorization \
  @ciscospark/plugin-authorization-browser \
  @ciscospark/plugin-authorization-browser-first-party \
  @ciscospark/plugin-authorization-node \
  @ciscospark/plugin-logger \
  @ciscospark/plugin-memberships \
  @ciscospark/plugin-messages \
  @ciscospark/plugin-people \
  @ciscospark/plugin-phone \
  @ciscospark/plugin-rooms \
  @ciscospark/plugin-team-memberships \
  @ciscospark/plugin-teams \
  @ciscospark/plugin-webhooks \
  @ciscospark/spark-core \
  @ciscospark/storage-adapter-local-storage \
  @ciscospark/storage-adapter-spec \
  @ciscospark/test-helper-appid \
  @ciscospark/test-helper-chai \
  @ciscospark/test-helper-file \
  @ciscospark/test-helper-make-local-url \
  @ciscospark/test-helper-mocha \
  @ciscospark/test-helper-mock-spark \
  @ciscospark/test-helper-mock-web-socket \
  @ciscospark/test-helper-refresh-callback \
  @ciscospark/test-helper-retry \
  @ciscospark/test-helper-sinon \
  @ciscospark/test-helper-test-users \
  @ciscospark/xunit-with-logs \
  ciscospark"

PACKAGES=$(echo packages/node_modules/{*,@ciscospark/*,@webex/*} | xargs -n 1 | sed 's/packages\/node_modules\///' | xargs -n 1 | grep -v '^@ciscospark$' | grep -v '^samples$' | grep -v '^@webex$')
for PACKAGE in $PACKAGES; do
  # Check only packages that are not deprecated.
  case $DEPRECATED_PACKAGES in
    !(*"$PACKAGE"*))
    NAME_IN_PACKAGE=$(cat "./packages/node_modules/${PACKAGE}/package.json" | jq -r .name);
    if [ "${NAME_IN_PACKAGE}" != "${PACKAGE}" ]; then
      echo "package.json for '${PACKAGE}' contains unexpected package name '${NAME_IN_PACKAGE}'"
      exit 1
    fi
    ;;
  esac
done
