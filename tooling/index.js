#!/usr/bin/env babel-node

const dotenv = require(`dotenv`);
dotenv.config({path: `.env.default`});
dotenv.config();

// eslint-disable-next-line no-unused-expressions
require(`yargs`)
  .env(``)
  .commandDir(`./commands`)
  .demandCommand(1)
  .help()
  .argv;
