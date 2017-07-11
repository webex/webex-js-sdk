#!/bin/bash

set -e

cd ./packages/node_modules/@ciscospark/internal-plugin-encryption

documentation build \
  --shallow \
  --infer-private \
  --github \
  --config ./toc.yml \
  --format html \
  --output ../../../../edocs \
  ./src/**/*
