#!/usr/bin/env node

const fs = require(`fs`);
const lerna = JSON.parse(fs.readFileSync(`../lerna.json`));
let version = lerna.version;
version = version.split(`.`);
process.stdout.write(`${version[0]}.${version[1]}.${parseInt(version[2], 10) + 1}`);
