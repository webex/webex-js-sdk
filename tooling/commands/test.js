/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable complexity */

const debug = require('debug')('tooling:test:command');
const wrapHandler = require('../lib/wrap-handler');
const {testPackage} = require('../lib/test');
const {list} = require('../lib/package');
const spawn = require('../util/spawn');
const {report} = require('../util/coverage');
const {start, stop} = require('../util/server');

const http = require('http');
const path = require('path');
const yakbak = require('yakbak');

/**
 * Returns true if the given package should be tested
 * in the browser. (Some packages are intended for use
 * only in Node.)
 * @param {String} packageName
 * @returns {Boolean}
 */
function shouldTestInBrowser(packageName) {
  const noBrowserPackages = [
    '@webex/webex-server'
  ];
  return !noBrowserPackages.includes(packageName);
}

// yakbak stuff

const services = [
  {
    defaultUrl: 'https://api.ciscospark.com/v1',
    env: 'HYDRA_SERVICE_URL',
    name: 'hydra',
    port: 3010,
    serviceUrl: process.env.HYDRA_SERVICE_URL
  },
  {
    defaultUrl: 'https://wdm-a.wbx2.com/wdm/api/v1',
    env: 'WDM_SERVICE_URL',
    name: 'wdm',
    port: 3020,
    serviceUrl: process.env.WDM_SERVICE_URL
  }
];

// custom hash stuff for yakbak

const url = require('url');
const crypto = require('crypto');

/**
 * Creates a custom hash used as the snapshot's filename.
 * @param {http.ClientRequest} req
 * @param {Object} body
 * @returns {String} hashed filename
 */
function customHash(req, body) {
  const hash = crypto.createHash('md5');
  updateHash(hash, req);
  hash.write(body);
  return hash.digest('hex');
}

/**
 * Updates the given hash with the appropriate
 * methods, headers, etc.
 * @param {Hash} hash
 * @param {http.ClientRequest} req
 */
function updateHash(hash, req) {
  const parts = url.parse(req.url, true);
  const headers = pruneHeaders(req.headers);

  hash.update(req.httpVersion);
  hash.update(req.method);
  hash.update(parts.pathname);
  hash.update(JSON.stringify(sort(parts.query)));
  hash.update(JSON.stringify(sort(headers)));
  hash.update(JSON.stringify(sort(req.trailers)));
}

/**
 * Remove headers that are unique for each request
 * from the given headers object. This ensures
 * that certain headers do not "bust" the hash.
 * @param {Object} requestHeaders
 * @returns {Object} a new, pruned headers object
 */
function pruneHeaders(requestHeaders) {
  const headers = Object.assign({}, requestHeaders);
  delete headers.trackingid;
  delete headers.authorization;
  return headers;
}

/**
 * Sorts the given object.
 * @param {Object} obj
 * @returns {Object} a new, sorted object
 */
function sort(obj) {
  const ret = {};
  Object.keys(obj).sort().forEach((key) => {
    ret[key] = obj[key];
  });
  return ret;
}

// end custom hash stuff

/**
 * Sets the process's environment variable given the service,
 * e.g., HYDRA_SERVICE_URL="http://localhost:3010"
 * @param {Object} service
 * @returns {Promise}
 */
async function setEnv(service) {
  return new Promise((resolve) => {
    process.env[service.env] = `http://localhost:${service.port}`;
    resolve();
  });
}

/**
 * Starts a proxy server for the given service.
 * @param {Object} service
 * @returns {Promise|http.server} proxy server
 */
async function startProxy(service) {
  return new Promise((resolve) => {
    const snapshotsDir = path.join(__dirname, '../../test/services/', service.name, 'snapshots');
    const app = yakbak(service.defaultUrl, {
      dirname: snapshotsDir,
      hash: customHash
    });
    const proxy = http.createServer(app).listen(service.port, () => {
      console.log(`Yakbak server listening on port ${service.port}. Proxy for ${service.defaultUrl}`);
    });
    resolve();
    return proxy;
  });
}

/**
 * Stops the given proxy server.
 * @param {http.server} proxy
 * @returns {http.server} proxy server
 */
async function stopProxy(proxy) {
  return new Promise((resolve) => {
    proxy.close();
    resolve();
    return proxy;
  });
}

// end yakbak stuff


module.exports = {
  command: 'test',
  desc: 'Run the test suite',
  builder: {
    coverage: {
      description: 'Generate code coverage',
      default: false,
      type: 'boolean'
    },

    coverageReport: {
      description: 'Internal; when false, no report is generated',
      default: true,
      type: 'boolean'
    },

    xunit: {
      description: 'Generate xunit xml reports. Note: exit code will always be zero of reports are generated successfully, even if tests fail',
      default: false,
      type: 'boolean'
    },

    browser: {
      description: 'Run tests in browser( defaults to true if --node is not specified)',
      default: false,
      type: 'boolean'
    },
    node: {
      description: 'Run tests in node (defaults to true if --browser is not specified)',
      default: false,
      type: 'boolean'
    },

    unit: {
      description: 'Run unit tests (defaults to true if --integration and --automation are not specified)',
      default: false,
      type: 'boolean'
    },
    integration: {
      description: 'Run integration tests (defaults to true if --unit and --automation are not specified)',
      default: false,
      type: 'boolean'
    },
    documentation: {
      description: 'Check source code for examples and run any containing assertions',
      default: false,
      type: 'boolean'
    },
    automation: {
      description: 'Run automation tests (defaults to true if --unit and --integration are not specified)',
      default: false,
      type: 'boolean'
    },

    grep: {
      description: 'Run a subset of tests',
      default: [],
      type: 'array'
    },

    karmaDebug: {
      description: 'Start karma in watch mode',
      default: false,
      type: 'boolean'
    },

    serve: {
      description: 'Start the fixture server. Since this defaults to true, you find --no-serve useful',
      default: true,
      type: 'boolean'
    },

    tests: {
      description: 'Set to false to skip tests but do the other work that happens during a test run (e.g. generate the coverage report)',
      default: true,
      type: 'boolean'
    }
  },
  handler: wrapHandler(async (argv) => {
    if (!argv.browser && !argv.node) {
      argv.browser = shouldTestInBrowser(argv.package);
      argv.node = true;
    }

    if (!argv.unit && !argv.integration && !argv.automation && !argv.documentation) {
      argv.unit = true;
      argv.integration = true;
      argv.automation = true;
      argv.documentation = true;
    }

    if (argv.automation && !argv.unit && !argv.integration && !argv.documentation) {
      argv.browser = false;
    }

    if (argv.tests) {
      if (argv.package) {
        if (argv.serve) {
          debug('starting test server');
          await start();
          debug('started test server');
        }

        // Use HTTP "snapshots" instead of live network calls to test.
        let proxies;
        if (argv.snapshots || argv.snapshot) {
          argv.node = true;
          await Promise.all(services.map((service) => setEnv(service)));
          proxies = await Promise.all(services.map((service) => startProxy(service)));
        }

        await testPackage(argv, argv.package);

        // TODO: Not working
        if (argv.snapshots || argv.snapshot) {
          if (proxies && proxies.length) {
            await Promise.all(proxies.map((proxy) => stopProxy(proxy)));
          }
        }

        if (argv.serve) {
          debug('stopping test server');
          await stop();
          debug('stopped test server');
        }
      }
      else {
        for (const packageName of await list()) {
          const argString = Object.keys(argv).reduce((acc, key) => {
            const value = argv[key];
            if (typeof value === 'boolean') {
              acc += value ? ` --${key}` : ` --no-${key}`;
            }
            return acc;
          }, '');
          const [cmd, ...args] = `npm run test --silent -- --no-coverage-report --package ${packageName}${argString}`.split(' ');
          await spawn(cmd, args);
        }
      }
    }

    if (argv.coverage && argv.coverageReport) {
      debug('generating overall coverage report');
      await report();
      debug('generated overall coverage report');
    }

    for (const handle of process._getActiveHandles()) {
      // unref any outstanding timers/sockets/streams/processes.
      handle.unref();
    }
  })
};
