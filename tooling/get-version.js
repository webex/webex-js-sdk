#!/usr/bin/env node

// eslint-disable-next-line
'use strict';

const path = require(`path`);
const lerna = require(path.join(__dirname, `../lerna`));
let version = lerna.version;
version = version.split(`.`);
process.stdout.write(`${version[0]}.${version[1]}.${parseInt(version[2], 10) + 1}`);
