/* eslint-disable tsdoc/syntax */
/*!
 * Copyright (c) 2020 Cisco Systems, Inc. See LICENSE file.
 */

// import * as path from 'path';
import { spawn } from 'child_process';

const debug = require('debug')('monorepo:test:server');

let child:any;
/**
 * Stops the test server
 * @returns {Promise<void>}
 */
export async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (child !== null && child.kill) {
      debug('stopping test server');
      child.kill('SIGTERM');
      process.removeListener('exit', stopServer);
      child = null;
      debug('stopped test server');
    }

    resolve(child);
  });
}
/**
 * Starts the test server
 * @returns {Promise<void>}
 */
export async function startServer(): Promise<void> {
  if (child) {
    await stopServer();
  }

  return new Promise((resolve) => {
    // TODO:  move the logic for spawn the server to test-helper-server
    const serverPath = '../../@webex/test-helper-server';

    child = spawn(process.argv[0], [serverPath], {
      env: process.env,
      stdio: ['ignore', 'pipe', process.stderr],
    });

    child.stdout.on('data', (data: Buffer) => {
      const message = data.toString();
      const pattern = /.+/gi;

      if (pattern.test(message)) {
        resolve(child);
      }
    });

    process.on('exit', stopServer);
  });
}
