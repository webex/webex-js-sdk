/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var htmlBase = require('./html');

// escape and escapeSync probably don't both need to exist, but it seemed like a
// good idea in case we ever want to for the future.

/**
 * Escape HTML tags
 * @memberof Util.html
 * @param {string} html
 * @returns {Promise<string>}
 */
function escape(html) {
  return new Promise(function executor(resolve) {
    resolve(escapeSync(html));
  });
}

var escapeMe = /(\<|\>|&)/g;

/**
 * Synchronously escapse HTML
 * @param {string} html
 * @returns {string}
 */
function escapeSync(html) {
  return html.replace(escapeMe, entityReplacer);
}

function entityReplacer(char) {
  switch (char) {
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '&':
      return '&amp;';
    default:
      return char;
  }
}

module.exports = assign({
  escape: escape,
  escapeSync: escapeSync
}, htmlBase);
