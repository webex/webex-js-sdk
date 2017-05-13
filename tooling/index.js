#!/usr/bin/env babel-node

'use strict';

// eslint-disable-next-line no-unused-expressions
require(`yargs`)
  .commandDir(`./commands`)
  .demandCommand()
  .help()
  .argv;
