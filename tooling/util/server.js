/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require(`debug`)(`monorepo:test:server`);
const path = require(`path`);
const {spawn} = require(`child_process`);

let child;

/**
 * Starts the test server
 * @returns {Promise}
 */
async function start() {
  if (child) {
    await stop();
  }

  return new Promise((resolve) => {
    const serverPath = path.resolve(process.cwd(), `packages/node_modules/@ciscospark/test-helper-server`);
    child = spawn(process.argv[0], [serverPath], {
      env: process.env,
      stdio: [`ignore`, `pipe`, process.stderr]
    });

    child.stdout.on(`data`, (data) => {
      const message = `${data}`;
      const pattern = /.+/gi;
      if (message.match(pattern)) {
        resolve();
      }
    });

    process.on(`exit`, stop);
  });

}

/**
 * Stops the test server
 * @returns {Promise}
 */
function stop() {
  return new Promise((resolve) => {
    if (child && child.kill) {
      debug(`stopping test server`);
      child.kill(`SIGTERM`);
      process.removeListener(`exit`, stop);
      child = null;
      debug(`stopped test server`);
    }

    resolve();
  });
}

module.exports = {
  start,
  stop
};
