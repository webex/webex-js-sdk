const yargs = require('yargs');

class CLI {
  static process() {
    const args = yargs(process.argv.slice(2)).options({
      browser: {
        description: 'Run tests in browser[s]',
        default: false,
        type: 'boolean',
      },
      browsers: {
        default: ['ChromeHeadless', 'FirefoxHeadless'],
        description: 'Run tests in specific browsers',
        type: 'array',
      },
      debug: {
        default: false,
        description: 'Start a browser watch-and-debug session',
        type: 'boolean',
      },
      targets: {
        default: [],
        description: 'Target glob pattern[s] to run tests within',
        type: 'array',
      },
      integration: {
        description: 'Run integration tests',
        default: false,
        type: 'boolean',
      },
      node: {
        description: 'Run tests in NodeJS',
        default: false,
        type: 'boolean',
      },
      unit: {
        description: 'Run unit tests',
        default: false,
        type: 'boolean',
      },
    }).parseSync();

    // test arguments
  }
}

CLI.process();
