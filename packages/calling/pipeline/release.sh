#!/bin/bash -e
source ~/.nvm/nvm.sh
nvm use

HUSKY=0 # Skip Husky in CI

echo '_auth = ${ARTIFACTORY_TOKEN}
email = web-calling-sdk.gen@cisco.com
always-auth = true
@webex:registry=https://engci-maven.cisco.com/artifactory/api/npm/webex-npm-group/
//engci-maven.cisco.com/artifactory/api/npm/webex-npm-group/:_password=${ARTIFACTORY_GROUP_PASS}
//engci-maven.cisco.com/artifactory/api/npm/webex-npm-group/:username=web-calling-sdk.gen
//engci-maven.cisco.com/artifactory/api/npm/webex-npm-group/:email=web-calling-sdk.gen@cisco.com
//engci-maven.cisco.com/artifactory/api/npm/webex-npm-group/:always-auth=true' >> .npmrc

source ./pipeline/set-npmrc-path.sh

echo "--------------------------------------------------"
echo "Building docs..."
yarn build:docs #TODO: add publish:docs with semantic release to push to github pages
echo "docs have been built to docs/index.html: https://sqbu-github.cisco.com/WebExSquared/web-calling-sdk/blob/master/docs/index.html"

echo "--------------------------------------------------"
echo "Releasing code..."
yarn publish:release
echo "--------------------------------------------------"
echo "Code has been released"
