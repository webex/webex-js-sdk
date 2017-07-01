'use strict';

/* eslint-disable no-invalid-this */

const debug = require(`debug`)(`tooling:dot-browser`);
const wrap = require(`lodash/wrap`);

const unbuiltRe = /@ciscospark\/\w+$/;

module.exports = function dotBrowser(b) {

  // the first item in browserify's deps phase is "module-deps". We need to
  // override its resolver to
  // 1. point at src/index when trying to load a modules
  // 2. load the .browser.js version of any discovered file
  const walker = b.pipeline.get(`deps`).get(0);

  walker.resolve = wrap(walker.resolve, function resolve(fn, id, parent, next) {
    // point at src/index when trying to load a modules
    if (unbuiltRe.test(id)) {
      debug(`replacing ${id} with ${id}/src/index.js`);
      Reflect.apply(fn, this, [`${id}/src/index.js`, parent, next]);
      return;
    }

    Reflect.apply(fn, this, [id, parent, next]);
  });
};
