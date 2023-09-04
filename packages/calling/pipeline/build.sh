#!/bin/bash -e
source ~/.nvm/nvm.sh
nvm use

echo "--------------------------------------------------"
echo "Building code..."
yarn build

echo "--------------------------------------------------"
echo "Code has been built"
