#!/bin/bash

set -e

# Make sure there's no 503 artifact lingering from a previous build
rm -f 503

# Make sure the old sha artifact has been removed
rm -f .promotion-sha

# Install lerna
npm install

# Install dependencies which will be needed for publication (publish.sh should
# be run as a post-build step, *not* a promotion job)
npm run bootstrap

# TODO update circle.yml cache_directories

# Push to the validated merge branch so subjobs have access to the merge result
git push -f origin HEAD:refs/heads/validated-merge

git rev-parse HEAD > .promotion-sha
