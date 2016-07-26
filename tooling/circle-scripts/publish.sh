#!/bin/bash

set -e -o pipefail

npm install
npm run bootstrap

# Blocks of code are commented out here while experimenting with canary
# releases. If canary seems awful, remove it and use the commented blocks.
# NEXT_VERSION=`node <<- EOF
#  var version = JSON.parse(require('fs').readFileSync('lerna.json')).version.split('.');
#  version[2] = parseInt(version[2], 10) + 1;
#  console.log(version.join('.'));
# EOF`

NODE_ENV=production npm run build

npm run grunt:circle -- publish-docs

# npm run lerna -- publish --repo-version=${NEXT_VERSION}
npm run lerna -- publish --canary

git push ghc HEAD:/refs/heads/master

# Trick npmjs.com into updating the readme
# See https://github.com/npm/newww/issues/389#issuecomment-188428605 and
# https://github.com/lerna/lerna/issues/64 for details
cd packages/ciscospark
npm version --no-git-tag-version "${NEXT_VERSION}-readmehack"
npm publish
npm unpublish ciscospark@"${NEXT_VERSION}-readmehack"
