#!/bin/bash

set -e -o pipefail

# INSTALL
echo "Installing legacy SDK dependencies"
npm install

echo "Installing modular SDK dependencies"
npm run bootstrap

# CLEAN
echo "Cleaning modular directories"
npm run grunt:concurrent -- --no-color --stack clean

# PUBLISH
echo "Building docs and publishing to github.com"
npm run docs:publish
