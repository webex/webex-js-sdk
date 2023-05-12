#!/bin/bash -e

source ~/.nvm/nvm.sh
nvm use

echo "--------------------------------------------------"
echo "Running linter..."
yarn fix:lint

echo "--------------------------------------------------"
echo "Running prettier..."
yarn fix:prettier

echo "--------------------------------------------------"
echo "Running spellchecker..."
yarn test:spell-check