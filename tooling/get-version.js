#!/usr/bin/env node

var fs = require('fs');
var lerna = JSON.parse(fs.readFileSync('../lerna.json'));
var version = lerna.version;
version = version.split('.');
console.log(version[0] + '.' + version[1] + '.' + (parseInt(version[2], 10) + 1));
