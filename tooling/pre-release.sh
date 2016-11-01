#!/bin/bash

set -e

# Updates version numbers but *does not* publish to npm/github

VERSION=$(node <<EOF
var fs = require('fs');
var lerna = JSON.parse(fs.readFileSync('./lerna.json'));
var version = lerna.version;
version = version.split('.');
console.log(version[0] + '.' + version[1] + '.' + (parseInt(version[2], 10) + 1));
EOF)

npm run lerna -- publish --skip-npm --skip-git --repo-version="${VERSION}" --yes
git add lerna.json packages/*/package.json
git commit -m "v${VERSION}"

echo "################################################################################"
echo "# REBUILDING WITHOUT NODE_ENV"
echo "################################################################################"
unset NODE_ENV
docker run ${DOCKER_RUN_OPTS} npm run build

echo "################################################################################"
echo "# BUILDING EXAMPLE APP"
echo "################################################################################"
docker run -e PACKAGE=example-phone -e NODE_ENV=production ${DOCKER_RUN_OPTS} npm run grunt:package -- webpack:build
