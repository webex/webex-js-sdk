'use strict';

const denodeify = require(`denodeify`);
exports.mkdirp = denodeify(require(`mkdirp`));
exports.transformFile = denodeify(require(`babel-core`).transformFile);
