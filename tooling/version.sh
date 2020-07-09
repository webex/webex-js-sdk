#!/bin/bash

echo "Build Packages and Script"
npm run build
npm run build:script

echo "Bump all package version"
npm run tooling -- version set "${npm_package_version}" --all

echo "Generate Changelog"
npm run changelog:generate

git add packages/node_modules/*/package.json packages/node_modules/@ciscospark/*/README.md packages/node_modules/@webex/*/package.json packages/node_modules/webex/umd/*.js CHANGELOG.md
