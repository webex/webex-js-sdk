/* eslint-disable tsdoc/syntax */
/*!
 * Copyright (c) 2025 Cisco Systems, Inc. See LICENSE file.
 */

// import * as path from 'path';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

const debug = require('debug')('monorepo:test:server');

let child:any;

/**
 * Finds the workspace root by traversing up the directory tree
 * @param startPath - The starting directory path (defaults to current working directory)
 * @returns {string} - The workspace root directory path
 * @throws {Error} - If workspace root cannot be found
 */
export function findWorkspaceRoot(startPath: string = process.cwd()): string {
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
 * Gets the server path by finding the workspace root and constructing the server path
 * @param startPath - The starting directory path (defaults to current working directory)
 * @returns {string} - The full path to the test helper server
 */
export function getServerPath(startPath?: string): string {
  const workspaceRoot = findWorkspaceRoot(startPath);
  return path.join(workspaceRoot, 'packages/@webex/test-helper-server');
}

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
    const serverPath = getServerPath();

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
