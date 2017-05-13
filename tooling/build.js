#!/usr/bin/env babel-node

'use strict';

/* eslint-disable require-jsdoc */

const debug = require(`debug`)(`monorepo:build`);
const denodeify = require(`denodeify`);
const fs = require(`fs-promise`);
const glob = denodeify(require(`glob`));
const mkdirp = denodeify(require(`mkdirp`));
const path = require(`path`);
const rimraf = denodeify(require(`rimraf`));
const transform = denodeify(require(`babel-core`).transformFile);

async function removeFiles(pkgName) {
  let pattern = `packages/node_modules/{*,*/*}/dist`;
  if (pkgName) {
    pattern = `packages/node_modules/${pkgName}/dist`;
  }
  debug(`removing ${pattern}`);
  await rimraf(pattern);
  debug(`removed ${pattern}`);
}

async function listFiles(pkgName) {
  let pattern = `packages/node_modules/{*,*/*}/src/**/*.js`;
  if (pkgName) {
    pattern = `packages/node_modules/${pkgName}/src/**/*.js`;
  }
  const filenames = await glob(pattern, {
    ignore: `packages/node_modules/@ciscospark/example-phone/**`
  });

  return filenames.map((src) => ({
    dist: src.replace(`src`, `dist`),
    src
  }));
}

async function buildFile({src, dist}) {
  debug(`transforming ${src}`);
  const {code, map} = await transform(src);
  await mkdirp(path.dirname(dist));
  debug(`writing ${dist}`);
  await fs.writeFile(dist, code);
  await fs.writeFile(`${dist}.map`, map);
  debug(`wrote ${dist}`);
}

// eslint-disable-next-line no-extra-parens
(async function main() {
  await removeFiles(process.env.PACKAGE);
  const files = await listFiles(process.env.PACKAGE);
  for (const f of files) {
    try {
      await buildFile(f);
    }
    catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      throw err;
    }
  }
}());
