#!/bin/bash

set -e
set -o pipefail

# Merge the new package versions from Circle CI
git fetch ghc
git merge ghc/master
