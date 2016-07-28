#!/bin/bash

# Common actions that run at the beginning of a validated-merge build

set -e

echo "Begin validated-merge.sh"

# Make sure there's no 503 artifact lingering from a previous build
echo "no" > 503

# Make sure the old sha artifact has been removed
rm -f .promotion-sha

rm -rf reports

# Install lerna
echo "Installing Tooling and legacy node_modules"
npm install

# TODO update circle.yml cache_directories

# Push to the validated merge branch so subjobs have access to the merge result
echo "Pushing validated merge result to GitHub Enterprise validated-merge branch"
git push -f origin HEAD:refs/heads/validated-merge

echo "Complete validated-merge.sh"
