#!/bin/bash

set -e -o pipefail

# Blocks of code are commented out here while experimenting with canary
# releases. If canary seems awful, remove it and use the commented blocks.
# NEXT_VERSION=`node <<- EOF
#  var version = JSON.parse(require('fs').readFileSync('lerna.json')).version.split('.');
#  version[2] = parseInt(version[2], 10) + 1;
#  console.log(version.join('.'));
# EOF`

# Make sure we don't run on multiple nodes
if [ ${CIRCLE_NODE_INDEX} -ne "0" ]; then
  exit 0
fi

NODE_ENV=production npm run build

echo "Setting git credentials"
# Reminder: these are global so that the checkout made by grunt-gh-pages sees
# them
git config --global user.email "spark-js-sdk@example.com"
git config --global user.name "spark-js-sdk automation"

echo "Creating temporary .npmrc"
# Note the intentional single quotes to avoid string interpolation
echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > .npmrc

echo "Publishing new versions to npm"
# TODO deprecate previous versions?
# npm run lerna -- publish --repo-version=${NEXT_VERSION}
npm run lerna -- publish --skip-git --canary --yes
# TODO parse top commit message for something like !release:X.Y.Z to decide
# whether to do a canary release
NEW_VERSION=`cat lerna.json | grep version | awk '{print $2}'`
git add lerna.json package.json packages/*/package.json
git commit -m "Release ${NEW_VERSION}"
git tag -a -m "Release ${NEW_VERSION}" "${NEW_VERSION}"
git commit --allow-empty -m '[skip ci]'
git push origin HEAD:refs/heads/master
git push origin "${NEW_VERSION}"

echo "Publishing new documentation"
npm run grunt:circle -- publish-docs

echo "Tricking npm website into updating the README"
# Trick npmjs.com into updating the readme
# See https://github.com/npm/newww/issues/389#issuecomment-188428605 and
# https://github.com/lerna/lerna/issues/64 for details
cd packages/ciscospark
npm version --no-git-tag-version "${NEW_VERSION}-readmehack"
npm publish
npm unpublish ciscospark@"${NEW_VERSION}-readmehack"
