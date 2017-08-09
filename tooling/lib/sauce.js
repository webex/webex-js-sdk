const assert = require(`assert`);
const {spawn} = require(`child_process`);
const asyncSpawn = require(`../util/spawn`);
const {EventEmitter} = require(`events`);
const uuid = require(`uuid`);
const {readFile, rename, writeFile, unlink} = require(`fs-promise`);
const {exists, mkdirp} = require(`./async`);
const path = require(`path`);
const {defaults, wrap} = require(`lodash`);


/**
 * Unlinks a file but fails silently if it doesn't exist
 * @param {string} filename
 * @returns {Promise}
 */
async function safeUnlink(filename) {
  try {
    await unlink(filename);
  }
  catch (err) {
    if (err.code !== `ENOENT`) {
      throw err;
    }
  }
}

const debug = wrap(require(`debug`)(`tooling:sauce`), (fn, msg, ...rest) => {
  if (typeof msg !== `string`) {
    rest.unshift(msg);
    msg = ``;
  }

  if (process.env.SC_ITERATION) {
    msg = `SC attempt ${process.env.SC_ITERATION}: ${msg}`;
  }

  if (process.env.SUITE_ITERATION) {
    msg = `Suite attempt ${process.env.SUITE_ITERATION}: ${msg}`;
  }

  if (process.env.PACKAGE) {
    msg = `${process.env.PACKAGE}: ${msg}`;
  }

  fn(msg, ...rest);
});


const SAUCE_CONNECT_VERSION = process.env.SAUCE_CONNECT_VERSION || `4.4.8`;

/**
 * Returns a rejected promise after ms millseconds
 * @param {number} ms
 * @private
 * @returns {Promise}
 */
function failAfterTime(ms) {
  return new Promise((resolve, reject) => {
    const ref = setTimeout(() => reject(new Error(`Ready file does not exist after ${ms}ms`)), ms);
    ref.unref();
  });
}

/**
 * Resolves when the ready file exists
 * @param {string} readyFile
 * @private
 * @returns {Promise}
 */
async function waitForReadyFile(readyFile) {
  debug(`waiting for ready file`);
  while (!await exists(readyFile)) {
    debug(`checking for ready file`);
    await sleep(5);
  }
  debug(`ready file found`);
}

/**
 * Resolves when the ready file does not exist
 * @param {string} readyFile
 * @private
 * @returns {Promise}
 */
async function waitForReadyFileRemoval(readyFile) {
  debug(`waiting for ready file removal`);
  while (await exists(readyFile)) {
    debug(`ready file still exists`);
    await sleep(5);
  }
  debug(`ready file gone`);
}

/**
 * Resolves the returned Promise after s seconds
 * @param {number} s seconds
 * @private
 * @returns {Promise}
 */
async function sleep(s) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

/**
 * Determines the sauce connect pid based on either the passed in pid or the
 * path to the written pidFile
 * @param {number} pid
 * @param {string} pidFile
 * @private
 * @returns {number}
 */
async function getPid(pid, pidFile) {
  if (!pid) {
    debug(`no pid specifed, reading from ${pidFile}`);
    return parseInt(await readFile(pidFile), 10);
  }

  return pid;
}

/**
 * Adds defaults to all of the Sauce class's method calls.
 * @param {Object} target
 * @param {string} prop
 * @param {Object} descriptor
 * @private
 * @returns {undefined}
 */
function applyDefaults(target, prop, descriptor) {
  // eslint-disable-next-line complexity
  descriptor.value = wrap(descriptor.value, async function wrapper(fn, options, ...rest) {
    defaults(options, {
      package: process.env.PACKAGE,
      suiteIteration: process.env.SUITE_ITERATION,
      sauceIteration: process.env.SC_ITERATION,
      tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER || uuid.v4()
    });

    if (!options.dir) {
      options.dir = options.package ? path.resolve(`.sauce`, options.package) : path.resolve(`.sauce`);
    }

    defaults(options, {
      binFile: process.env.SC_BINARY || `${options.dir}/sc/bin/sc`,
      pidFile: process.env.PID_FILE || `${options.dir}/sc.pid`,
      readyFile: process.env.READY_FILE || `${options.dir}/sc.ready`,
      tidFile: process.env.TID_FILE || `${options.dir}/sc.tid`
    });

    if (!options.logFile) {
      let lf;
      if (options.package) {
        lf = path.resolve(`reports/sauce/sauce_connect.${options.package.replace(`/`, `_`)}`);
      }
      else {
        lf = `${options.dir}/sc`;
      }
      if (options.suiteIteration) {
        lf += `.${options.suiteIteration}`;
      }
      if (options.sauceIteration) {
        lf += `.${options.sauceIteration}`;
      }
      lf += `.log`;
      options.logFile = lf;
    }
    // eslint-disable-next-line no-invalid-this
    return Reflect.apply(fn, this, [options, ...rest]);
  });
}

/**
 * Abstraction around sauce connect shell commands
 */
class Sauce extends EventEmitter {
  @applyDefaults
  /**
   * Downloads sauce connect
   * @param {Object} options
   * @param {string} options.dir
   * @returns {Promise}
   */
  static async download({dir}) {
    dir = path.resolve(dir);
    debug(`creating ${dir}`);
    await mkdirp(dir);
    debug(`created ${dir}`);

    const basename = `sc-${SAUCE_CONNECT_VERSION}-${process.platform === `darwin` ? `osx` : `linux`}`;
    const filename = `${basename}${process.platform === `darwin` ? `.zip` : `.tar.gz`}`;
    const url = `https://saucelabs.com/downloads/${filename}`;

    const archivePath = path.resolve(dir, filename);
    const unzippedFolderPath = path.resolve(dir, basename);
    const folderPath = path.resolve(dir, `sc`);

    debug(`dowloading sauce connect from ${url}`);
    await asyncSpawn(`curl`, [`-o`, archivePath, url]);
    debug(`downloaded ${archivePath}`);

    if (process.platform === `darwin`) {
      debug(`unzipping ${archivePath} to ${folderPath}`);
      await asyncSpawn(`unzip`, [archivePath, `-d`, dir]);
      debug(`unzipped ${archivePath} to ${folderPath}`);
    }
    else {
      debug(`untarring ${archivePath} to ${folderPath}`);
      await asyncSpawn(`tar`, [`-xf`, archivePath, `-C`, dir]);
      debug(`untarred ${archivePath} to ${folderPath}`);
    }

    debug(`moving ${unzippedFolderPath} to ${folderPath}`);
    await rename(unzippedFolderPath, folderPath);
    debug(`moved ${unzippedFolderPath} to ${folderPath}`);
  }

  @applyDefaults
  /**
   * Runs a command with the right env vars set to use the sauce tunnel
   * @param {Object} options
   * @param {bymber} options.pid
   * @param {string} options.pidFile
   * @param {string} options.readyFile
   * @param {number} options.tid
   * @param {string} options.tidFile
   * @param {string} cmd
   * @param {Array} args
   * @returns {Promise}
   */
  static async run({pid, pidFile, readyFile, tid, tidFile}, cmd, args) {
    pid = await getPid(pid, pidFile);
    tid = tid || await readFile(tidFile);

    await asyncSpawn(cmd, args, {
      stdio: `inherit`,
      env: Object.assign({}, process.env, {
        SC_TUNNEL_IDENTIFIER: tid,
        SC_PID_FILE: pidFile
      })
    });
  }

  @applyDefaults
  /**
   * Starts sauce connect and exits
   * @param {Object} options
   * @see @{link Sauce#start()}
   * @returns {Promise}
   */
  static async start(...args) {
    // TODO fail if already running
    const sauce = new Sauce({detached: true});
    await sauce.start(...args);
  }

  @applyDefaults
  /**
   * Stops sauce connect and exits
   * @param {Object} options
   * @param {bymber} options.pid
   * @param {string} options.pidFile
   * @param {string} options.readyFile
   * @param {string} options.tidFile
   * @returns {Promise}
   */
  static async stop({pid, pidFile, readyFile, tidFile}) {
    debug(`preparing to stop sauce connect`);
    pid = await getPid(pid, pidFile);

    debug(`killing pid ${pid}`);
    await spawn(`kill`, [pid]);

    try {
      await Promise.race([
        waitForReadyFileRemoval(readyFile),
        failAfterTime(2 * 60 * 1000)
      ]);

      debug(`sauce stopped`);
    }
    catch (err) {
      debug(`ready file was not removed after 2 minutes, sending kill signal`);
      await spawn(`kill`, [`-TERM`, pid]);
      await safeUnlink(readyFile);
      await safeUnlink(pidFile);
    }

    debug(`removing ${tidFile}`);
    await safeUnlink(tidFile);
  }

  /**
   * Constructor
   * @param {Object} options
   */
  constructor(options = {}) {
    super();
    assert(process.env.SAUCE_USERNAME, `SAUCE_USERNAME must be set`);
    assert(process.env.SAUCE_ACCESS_KEY, `SAUCE_ACCESS_KEY must be set`);
    Object.assign(this, options);
  }

  @applyDefaults
  /**
   * Starts the sauce connect tunnel
   * @param {Object} options
   * @param {bymber} options.binFile
   * @param {bymber} options.logFile
   * @param {string} options.pidFile
   * @param {string} options.readyFile
   * @param {string} options.tidFile
   * @param {string} options.tunnelIdentifier
   * @returns {Promise}
   */
  async start({binFile, logFile, pidFile, readyFile, tidFile, tunnelIdentifier}) {
    if (!await exists(binFile)) {
      // eslint-disable-next-line prefer-rest-params
      await Sauce.download(...arguments);
    }

    let options;
    if (this.detached) {
      debug(`starting sauce connect in background`);
      options = {
        stdio: `ignore`,
        detached: true
      };
    }
    else {
      debug(`starting sauce connect in foreground`);
      options = {
        stdio: `inherit`
      };
    }

    await safeUnlink(logFile);

    const child = this.child = spawn(path.resolve(binFile), [
      `-B`, [
        `mercury-connection-intb.ciscospark.com`,
        `idbroker.webex.com`,
        `127.0.0.1`,
        `localhost`,
        `*.wbx2.com`,
        `*.ciscospark.com`
      ].join(`,`),
      `-t`, [
        `internal-testing-services.wbx2.com`,
        `127.0.0.1`,
        `localhost`
      ].join(`,`),
      `-vv`,
      `-l`, logFile,
      `--pidfile`, pidFile,
      `--readyfile`, readyFile,
      `--tunnel-identifier`, tunnelIdentifier
    ], options);

    if (options.detached) {
      debug(`detaching child process`);
      child.unref();
    }

    debug(`waiting up to 2 minutes for sauce connect to drop the ready file`);
    await Promise.race([
      waitForReadyFile(readyFile),
      failAfterTime(2 * 60 * 1000),
      new Promise((resolve, reject) => {
        child.on(`exit`, (code) => {
          if (code) {
            debug(`Sauce Connect exited unexpectedly with code ${code}`);
            reject(new Error(`Sauce Connect exited unexpectedly with code ${code}`));
          }
        });
      })
    ]);
    debug(`ready file created, continuing`);

    debug(`write tunnel id to ${tidFile}`);
    await writeFile(tidFile, tunnelIdentifier);
    debug(`wrote tunnel id to ${tidFile}`);
  }

  /**
   * Stops the sauce connect tunnel
   * @returns {Promise}
   */
  async stop() {
    await new Promise((resolve) => {
      this.child.once(`close`, resolve);
      this.child.kill();
    });
  }
}

module.exports = Sauce;
