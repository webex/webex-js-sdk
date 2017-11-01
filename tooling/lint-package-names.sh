#!/bin/bash

set -e

PACKAGES=$(echo packages/node_modules/{*,@ciscospark/*} | xargs -n 1 | sed 's/packages\/node_modules\///' | xargs -n 1 | grep -v '^@ciscospark$' | grep -v '^samples$')
for PACKAGE in $PACKAGES; do
  NAME_IN_PACKAGE=$(cat "./packages/node_modules/${PACKAGE}/package.json" | jq -r .name);
  if [ "${NAME_IN_PACKAGE}" != "${PACKAGE}" ]; then
   echo "package.json for '${PACKAGE}' contains unexpected package name '${NAME_IN_PACKAGE}'"
   exit 1
  fi
done
