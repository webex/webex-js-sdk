import 'babel-polyfill';
import {dotSauce, logFile, pidFile, readyFile} from './lib/paths';
import _mkdirp from 'mkdirp';
import denodeify from 'denodeify';
import exists from './lib/exists';
import spawn from './lib/spawn';
import rm from './lib/rm';

const mkdirp = denodeify(_mkdirp);

const SAUCE_CONNECT_VERSION = `4.3.16`;

(async function run() {
  try {
    if (await exists(pidFile)) {
      console.log(`Sauce Connect already connected`);
      return;
    }

    checkRequiredEnvironment([
      `SAUCE_USERNAME`,
      `SAUCE_ACCESS_KEY`,
      `SC_TUNNEL_IDENTIFIER`
    ]);

    await downloadSauceConnect();
    await spawn(`rm`, [`-f`, logFile]);
    await connectWithRetry();
  }
  catch (reason) {
    console.error(reason.stack);
    process.exit(1);
  }
}());

/**
 * Asserts that the specified array of names are defined on `process.env`
 * @param {Array<string>} vars
 * @private
 * @returns {undefined}
 * @throws Error
 */
function checkRequiredEnvironment(vars) {
  vars.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`\`${key}\` is required`);
    }
  });
}

/**
 * Connect to Sauce Labs
 * @private
 * @returns {Promise}
 */
function connect() {
  return new Promise((resolve, reject) => {
    const options = {
      stdio: `ignore`,
      detached: true
    };

    // eslint-disable-next-line prefer-const
    let interval;
    // cancel the connect process if the ready file hasn't been detected within
    // 60 seconds
    const timer = setTimeout(async function failAfter() {
      clearInterval(interval);
      if (!await exists(readyFile)) {
        console.log(`Failed to connect to Sauce Labs`);
        options.child.kill();
        return reject();
      }
      return resolve();
    }, 60 * 1000);

    // Check for the ready file once per second forever until it exists
    interval = setInterval(async function checkConnected() {
      if (await exists(readyFile)) {
        console.log(`Connected to Sauce Labs`);
        clearTimeout(timer);
        clearInterval(interval);
        resolve();
      }
    }, 1000);

    spawn(`sc/bin/sc`, [
      `-D`, [
        `*.ciscospark.com`,
        `*.wbx2.com`,
        `*.webex.com`,
        `storage101.dfw1.clouddrive.com`
      ].join(`,`),
      `-vv`,
      `-l`, `${logFile}`,
      `--pidfile`, pidFile,
      `--readyfile`, readyFile,
      `--tunnel-identifier`, process.env.SC_TUNNEL_IDENTIFIER
    ], options)
      .catch(reject);
  });
}

/**
 * Prevents the next connection attempt until the pid file from the previous
 * attempt disappears (or the tiemout expires and we remove it forcibly)
 * @returns {Promise}
 */
function blockUntilClosed() {
  return new Promise((resolve) => {
    // eslint-disable-next-line prefer-const
    let interval;
    const timer = setTimeout(async function removeAfter() {
      clearInterval(interval);
      if (await exists(pidFile)) {
        console.log(`pid file not removed; forcibly removing`);
        await rm(pidFile);
        resolve();
      }
    }, 60 * 1000);

    interval = setInterval(async function check() {
      if (!await exists(pidFile)) {
        clearTimeout(timer);
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
}

/**
 * Connect to Sauce Labs with up to three attempts
 * @private
 * @returns {Promise}
 */
async function connectWithRetry() {
  try {
    await connect();
  }
  catch (reason) {
    console.warn(`Timed out connecting to Sauce Labs, retrying`);
    try {
      await blockUntilClosed();
      await connect();
    }
    catch (reason2) {
      console.warn(`Timed out connecting to Sauce Labs, retrying`);
      try {
        await blockUntilClosed();
        await connect();
      }
      catch (reason3) {
        console.error(`Failed to connect to Sauce Labs after three attempts, aborting`);
        process.exit(2);
      }
    }
  }
}

/**
 * Download the Sauce Connect binary
 * @private
 * @returns {Promise}
 */
async function downloadSauceConnect() {
  await mkdirp(dotSauce);
  process.chdir(dotSauce);
  if (await exists(`sc`)) {
    return;
  }
  const scBasename = `sc-${SAUCE_CONNECT_VERSION}-${process.platform === `darwin` ? `osx` : `linux`}`;
  const scPackage = `${scBasename}${process.platform === `darwin` ? `.zip` : `.tar.gz`}`;
  const scUrl = `https://saucelabs.com/downloads/${scPackage}`;
  await spawn(`curl`, [`-o`, scPackage, scUrl]);
  if (process.platform === `darwin`) {
    await spawn(`unzip`, [scPackage]);
  }
  else {
    await spawn(`tar`, [`-xf`, scPackage]);
  }
  await spawn(`mv`, [scBasename, `sc`]);
}
