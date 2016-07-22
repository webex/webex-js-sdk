'use strict';

const CircleCI = require(`circleci`);
const common = require(`./lib/common-options`);
const exitWithError = require(`./lib/exit-with-error`);
const print = require(`./lib/print`);
const requireDir = require(`require-dir`);
const S = require(`string`);
const yargs = require(`yargs`);

Object.keys(CircleCI.prototype).forEach((methodName) => {
  const cmdName = S(methodName).dasherize().s;
  yargs.command({
    command: cmdName,
    describe: `Pass through to ci.${methodName}`,
    builder: Object.assign({}, common),
    handler: (argv) => {
      const ci = new CircleCI({
        auth: argv.auth
      });

      ci[methodName](argv)
        .then(print(argv))
        .catch(exitWithError);
    }
  });
});


const commands = requireDir(`./commands`);

Object.keys(commands).forEach((cmd) => yargs.command(commands[cmd]));

yargs
  .help();
