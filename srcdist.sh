#!/bin/bash

sed -ibak 's/"main": "src\/index.js/"main": "dist\/index.js/' packages/*/package.json
rm packages/*/*bak
