'use strict';

/* eslint-disable no-invalid-this */

const debug = require(`debug`)(`tooling:dot-browser`);
const fs = require(`fs`);
const path = require(`path`);
const {wrap} = require(`lodash`);

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

    // Skip non-project files
    if (!parent.filename.includes(`ciscospark`)) {
      debug(`skipping non-project file ${id}`);
      Reflect.apply(fn, this, [id, parent, next]);
      return;
    }

    const bid = id.endsWith(`.js`) ? id.replace(`.js`, `.browser.js`) : `${id}.browser.js`;

    // parent is the file that tried to load $id, so we need to see what dir
    // parent is in, then look for id from there.
    const filename = path.resolve(path.dirname(parent.filename), bid);

    debug(`checking for ${filename}`);
    fs.access(filename, fs.constants.F_OK, (err) => {
      // if we get an error, it means we can't ready the file at $filename, so
      // we'll delegate to the original
      if (err) {
        debug(`did not find ${filename}`);
        return Reflect.apply(fn, this, [id, parent, next]);
      }

      debug(`found ${filename}`);
      debug(`replacing ${id} with ${bid}`);
      // Otherwise, we want to tell browserify to load $bid instead of $id
      return Reflect.apply(fn, this, [bid, parent, next]);
    });
  });
};
