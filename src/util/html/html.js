/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var curry = require('lodash.curry');
var htmlBase = require('./html-base');

// TODO We should implement these at some point

function noop(processCallback, allowedTags, allowedStyles, html) {
  return new Promise(function executor(resolve) {
    resolve(noopSync(processCallback, allowedTags, allowedStyles, html));
  });
}

function noopSync(processCallback, allowedTags, allowedStyles, html) {
  return html;
}

module.exports = assign({
  filter: curry(noop),
  filterSync: curry(noopSync),
  filterEscape: curry(noop),
  filterEscapeSync: curry(noopSync)
}, htmlBase);
