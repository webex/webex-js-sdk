'use strict';

const debug = require(`debug`)(`tooling:build`);
const {
  mkdirp,
  transformFile
} = require(`../lib/async`);
const path = require(`path`);
const {readFile, writeFile} = require(`fs-promise`);
const {glob} = require(`../util/package`);
const {exists} = require(`./fs`);
const {cloneDeep} = require(`lodash`);

exports.buildFile = buildFile;
exports.buildPackage = buildPackage;

/**
 * Build a single file
 * @param {string} src
 * @param {string} dest
 * @param {Object} config
 * @returns {Promise}
 */
async function buildFile(src, dest, config = {}) {
  debug(`transforming ${src}`);
  const {code, map} = await transformFile(src, config);
  debug(`transformed file ${src}`);
  await mkdirp(path.dirname(dest));
  debug(`writing ${dest}`);
  await writeFile(dest, code);
  await writeFile(`${dest}.map`, JSON.stringify(map));
  debug(`wrote ${dest}`);
}

/**
 * Build all the files in a given package, for node, browser, and
 * es6-modules(node)
 * @param {string} packageName
 * @returns {Promise}
 */
async function buildPackage(packageName) {
  debug(`building package ${packageName}`);
  const files = await glob(`src/**/*.js`, {packageName});
  debug(`building files `, files);

  const mapped = [];
  for (const filename of files) {
    if (!filename.endsWith(`.browser.js`)) {
      mapped.push({
        src: await srcFromFilename(packageName, filename),
        dest: {
          browser: path.resolve(`packages`, `node_modules`, packageName, filename.replace(`src`, `dist/browser`)),
          main: path.resolve(`packages`, `node_modules`, packageName, filename.replace(`src`, `dist/main`)),
          module: path.resolve(`packages`, `node_modules`, packageName, filename.replace(`src`, `dist/module`))
        }
      });
    }
  }

  const config = JSON.parse(await readFile(path.join(process.cwd(), `.babelrc`)));
  config.plugins = config.plugins.map((plugin) => {
    if (plugin.startsWith && plugin.startsWith(`./`)) {
      return path.resolve(process.cwd(), plugin);
    }
    return plugin;
  });
  config.babelrc = false;

  const browserConfig = cloneDeep(config);
  Reflect.deleteProperty(browserConfig.presets.find((item) => Array.isArray(item) && item[0] === `env`)[1].targets, `node`);

  const nodeConfig = cloneDeep(config);
  Reflect.deleteProperty(nodeConfig.presets.find((item) => Array.isArray(item) && item[0] === `env`)[1].targets, `browsers`);

  const moduleConfig = cloneDeep(nodeConfig);
  moduleConfig.presets.find((item) => Array.isArray(item) && item[0] === `env`)[1].modules = false;

  for (const {src, dest: {browser, main, module}} of mapped) {
    await buildFile(src.browser, browser, browserConfig);
    await buildFile(src.main, main, nodeConfig);
    await buildFile(src.main, module, moduleConfig);
  }
}

/**
 * Given a filename, determine the source files for it's browser, main, and
 * module targets
 * @private
 * @param {string} packageName
 * @param {string} filename
 * @returns {Promise<Object>}
 */
async function srcFromFilename(packageName, filename) {
  let browser = filename.replace(`.js`, `.browser.js`);
  debug(`checking if ${browser} is a file`);
  if (await exists(path.join(`packages`, `node_modules`, packageName, browser))) {
    debug(`${filename} is overridden by ${browser}`);
  }
  else {
    debug(`${filename} is not overridden`);
    browser = filename;
  }

  return {
    browser: path.resolve(`packages`, `node_modules`, packageName, browser),
    main: path.resolve(`packages`, `node_modules`, packageName, filename),
    module: path.resolve(`packages`, `node_modules`, packageName, filename.replace(`main`, `module`))
  };
}
