#!/bin/bash

git clone https://github.com/webex/webex-js-sdk.wiki.git ./docs/webWiki/
cp -r ./docs/webWiki/meeting/ ./docs/Web

rm -rf ./docs/webWiki