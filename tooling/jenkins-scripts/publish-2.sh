#!/bin/bash

set -e
set -o pipefail

# Merge the new package versions from Circle CI
echo "Fetching publication result from GitHub.com"
git fetch ghc

echo "Merging publication result into validated-merge branch"
git merge ghc/master

echo "Recording SHA of validated-merge result"
git rev-parse HEAD > .promotion-sha
