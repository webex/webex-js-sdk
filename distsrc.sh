#!/bin/bash

sed -ibak 's/"main": "dist\/index.js/"main": "src\/index.js/' packages/*/package.json
rm packages/*/*bak
