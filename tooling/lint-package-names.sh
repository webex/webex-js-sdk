#!/bin/bash

set -e
shopt -s extglob

DEPRECATED_PACKAGES="@ciscospark/storage-adapter-session-storage \
  @ciscospark/test-helper-automation \
  @ciscospark/sparkd \
  @ciscospark/recipe-private-web-client \
  @ciscospark/test-helper-mock-socket \
  @ciscospark/test-helper-server \
  @ciscospark/storage-adapter-local-forage \
  @ciscospark/common \
  @ciscospark/common-evented \
  @ciscospark/common-timers \
  @ciscospark/helper-html"

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
