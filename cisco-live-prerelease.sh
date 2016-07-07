#!/bin/bash

set -e

set +e
npm -v
if [ $? != 0 ]; then
  echo "Node and npm are required. Exiting"
  exit 1
fi
set -e

echo "Installing tooling..."
npm install
echo "Done"

echo "Installing dependencies..."
npm run bootstrap
echo "Done"

echo "Building..."
npm run build
echo "Done"

echo "npm linking key packages..."
cd packages/ciscospark/
npm link
cd ../phone
npm link
echo "Done"

echo
echo "Successfully boostrapped."
echo
echo "Run 'npm link @ciscospark/phone' in your project directory"
echo "And put 'var ciscospark = require(\'ciscospark\').default;' in your app entry point"
echo
