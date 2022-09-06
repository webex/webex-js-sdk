/* eslint-disable */

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

yargs(hideBin(process.argv))
  .env('')
  .commandDir('./commands')
  .demandCommand(1)
  .help()
  .argv;

/*
    yargs makes each script in the <root>/tooling/commands a command
    Eg 1 - node tooling/index.js test
    Eg 2 - node tooling/index.js build
  */
