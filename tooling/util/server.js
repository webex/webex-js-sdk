/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const path = require('path');
const fs = require('fs');
const {spawn} = require('child_process');

const debug = require('debug')('monorepo:test:server');

let child;

/**
 * Finds the workspace root by looking for package.json with workspaces
 * @param {string} startPath - Starting directory path
 * @returns {string} Workspace root path
 * @throws {Error} If workspace root is not found
 */
function findWorkspaceRoot(startPath = process.cwd()) {
  let workspaceRoot = startPath;

  while (true) {
    try {
      const packageJsonPath = path.join(workspaceRoot, 'package.json');
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      if (packageJson.workspaces) {
        return workspaceRoot;
      }
    } catch (e) {
      // package.json doesn't exist or is malformed at this level
    }

    const parentDir = path.dirname(workspaceRoot);
    if (parentDir === workspaceRoot) {
      // Reached filesystem root
      break;
    }
    workspaceRoot = parentDir;
  }

  throw new Error('Could not find workspace root with package.json containing workspaces field');
}

/**
 * Gets the server path based on workspace root
 * @param {string} workspaceRoot - Workspace root directory
 * @returns {string} Server path
 */
function getServerPath(workspaceRoot) {
  return path.join(workspaceRoot, 'packages/@webex/test-helper-server');
}

/**
 * Starts the test server
 * @returns {Promise}
 */
async function start() {
  if (child) {
    await stop();
  }

  return new Promise((resolve) => {
    const workspaceRoot = findWorkspaceRoot();
    const serverPath = getServerPath(workspaceRoot);

    child = spawn(process.argv[0], [serverPath], {
      env: process.env,
      stdio: ['ignore', 'pipe', process.stderr],
    });

    child.stdout.on('data', (data) => {
      const message = `${data}`;
      const pattern = /.+/gi;

      if (message.match(pattern)) {
        resolve();
      }
    });

    process.on('exit', stop);
  });
}

/**
 * Stops the test server
 * @returns {Promise}
 */
function stop() {
  return new Promise((resolve) => {
    if (child && child.kill) {
      debug('stopping test server');
      child.kill('SIGTERM');
      process.removeListener('exit', stop);
      child = null;
      debug('stopped test server');
    }

    resolve();
  });
}

module.exports = {
  start,
  stop,
  findWorkspaceRoot,
  getServerPath,
};
