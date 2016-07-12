#!/bin/bash

set -e -o pipefail

ps -A | grep node | awk '{print $1}' | xargs kill
ps -A | grep sc | awk '{print $1}' | xargs kill
ps -A | grep grunt | awk '{print $1}' | xargs kill

# INSTALL
echo "Installing legacy SDK dependencies"
npm install

echo "Installing modular SDK dependencies"
npm run bootstrap

echo "Cleaning modular directories"
npm run grunt:concurrent -- --no-color --stack clean

echo "Building modules"
NODE_ENV=production npm run grunt:concurrent -- --no-color --stack build

echo "Publish to npm"
npm run lerna publish

echo "Tricking npm into updating the README"
echo "TODO"
