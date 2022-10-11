// eslint-disable-next-line no-unused-expressions
require('yargs')
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
