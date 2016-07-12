/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint require-jsdoc: [0] */
/* eslint no-console: [0] */

import extract from './extract';
import generate from 'babel-generator';
import path from 'path';
import transform from './transform';

const nodeModulePatern = /node_modules/;
function isNodeModule(filename) {
  return nodeModulePatern.test(filename);
}

function inject(module, filename) {
  const code = generate(extract(transform, filename), {
    compact: false,
    quotes: `single`
  }).code;

  if (process.env.JSDOCTRINETEST_VERBOSE) {
    console.log(filename);
    console.log(code);
    console.log();
  }
  module._compile(code, filename);
}

function enableSpecInjection() {
  let dir;
  const load = require.extensions[`.js`];
  require.extensions[`.js`] = function loadWithSpecs(m, filename) {
    if (isNodeModule(filename)) {
      return load(m, filename);
    }
    // this is really janky, but so far seems to properly ensure we only load
    // files in the directories specified to mocha
    if (!dir) {
      dir = path.dirname(filename);
    }

    if (!filename.includes(dir)) {
      return load(m, filename);
    }

    return inject(m, filename);
  };
}

enableSpecInjection();
