const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

yargs(hideBin(process.argv))
  .env('')
  .commandDir('./commands')
  .demandCommand(1)
  .help()
  .argv;
