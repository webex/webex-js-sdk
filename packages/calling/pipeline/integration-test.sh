#!/bin/bash -e
source ~/.nvm/nvm.sh
nvm use

export SAUCE_USERNAME="web-sdk"
export SAUCE="true"

echo "--------------------------------------------------"
echo "Running integration tests..."
yarn test:integration
