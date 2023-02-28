const yargs = require('yargs');

const {Package} = require('./');

/**
 * CLI entry class.
 */
class CLI {
  /**
   * Process the command line arguements and execute this package as a CLI application.
   *
   * @returns {void}
   */
  static process() {
    const args = yargs(process.argv.slice(2)).options({
      'destination': {
        alias: 'o',
        default: './dist',
        describe: 'output files directory',
        type: 'string',
      },
      'generateMap': {
        alias: 'm',
        describe: 'generate source-map files',
        type: 'boolean',
      },
      'javascript': {
        alias: 'j',
        describe: 'process javascript files',
        type: 'boolean',
      },
      'source': {
        alias: 'i',
        default: './src',
        describe: 'input files directory',
        type: 'string',
      },
      'typescript': {
        alias: 't',
        describe: 'process typescript files',
        type: 'boolean',
      }
    }).argv;

    const {javascript, typescript, source, destination, generateMap} = args;

    Package.build({javascript, typescript, source, destination, generateMap});
  }
}

CLI.process();
