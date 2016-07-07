import 'babel-polyfill';
import cp from 'child_process';
import {defaults} from 'lodash';
import denodeify from 'denodeify';
import fs from 'fs';
import path from 'path';

const readdir = denodeify(fs.readdir);
const stat = denodeify(fs.stat);

(async function run() {
  try {
    const cwd = process.cwd();
    // `node` and `script` below need to be set in order to make the assignment
    // work, but eslint doesn't currently recognize that.
    /* eslint no-unused-vars: [0] */
    const [node, script, cmd, ...args] = process.argv;

    await dirApply(path.join(cwd, `packages`), async function applyCallback(name, stats) {
      if (stats.isDirectory()) {
        process.chdir(path.join(cwd, `packages`, name));
        await spawn(cmd, args);
        process.chdir(cwd);
      }
    });

  }
  catch (reason) {
    console.error(reason.stack);
    process.exit(1);
  }
}());

/**
 * Runs the specified function against each file in the specified directory
 * @param {string} dir
 * @param {Function} fn
 * @private
 * @returns {Promise}
 */
async function dirApply(dir, fn) {
  const names = await readdir(dir);
  for (const name of names) {
    await fn(name, await stat(path.join(dir, name)));
  }
}

/**
 * Wrapper around child_process.spawn
 * @param {string} cmd
 * @param {Array<string>} args
 * @param {Object} options
 * @private
 * @returns {Promise}
 */
function spawn(cmd, args, options) {
  return new Promise((resolve, reject) => {
    if (!cmd) {
      return reject(new Error(`\`cmd\` is required`));
    }

    console.info(`Running \`${cmd}${args.join(` `)}\` in ${process.cwd()}`);
    const child = cp.spawn(cmd, args, defaults(options), {
      // At some point, this'll need to be node-version dependent
      std: [`pipe`, `pipe`, `pipe`]
    });

    let data = ``;
    if (child.stderr) {
      child.stderr.on(`data`, (d) => {
        data += d;
        process.stderr.write(d.toString());
      });
    }

    if (child.stdout) {
      child.stdout.on(`data`, (d) => {
        process.stdout.write(d.toString());
      });
    }

    child.on(`close`, (code) => {
      if (code) {
        const e = new Error(code);
        e.data = data;
        return reject(e);
      }
      return resolve();
    });

    if (options && options.detached) {
      child.unref();
      /* eslint no-param-reassign: [0] */
      options.child = child;
    }

    return null;
  });

}
