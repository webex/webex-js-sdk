import 'babel-polyfill';
import denodeify from 'denodeify';
import exists from './lib/exists';
import fs from 'fs';
import {pidFile} from './lib/paths';
import spawn from './lib/spawn';

const readFile = denodeify(fs.readFile);

(async function run() {
  try {
    const pid = parseInt(await readFile(pidFile), 10);
    await spawn(`kill`, [`-TERM`, pid]);
    await new Promise((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let interval;
      const timeout = setTimeout(() => {
        clearInterval(interval);
        reject(`Failed to disconnect from Sauce Labs`);
      }, 60000);

      interval = setInterval(async function checkComplete() {
        clearTimeout(timeout);
        if (!await exists(pidFile)) {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });
  }
  catch (reason) {
    console.error(reason.stack);
    process.exit(1);
  }
}());
