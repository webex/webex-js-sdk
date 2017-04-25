#!/bin/bash

# documentation's linter has a few errors that don't really seem fixable. This
# scripts makes sure they're the only errors when errors are found.

out=$(documentation lint packages/node_modules/{*,*/*}/src/**/*.js)
EXIT_CODE=$?

if [ "${EXIT_CODE}" != "0" ]; then
  warnings=$(echo "$out" \
  | grep warning \
  | grep -v "could not determine @name for hierarchy" \
  | grep -v "@memberof reference to" \
  | grep -v "⚠" \
  | wc -l)

  if [ "${warnings}" != "0" ]; then
    echo "$out"
    exit $EXIT_CODE
  fi
fi
