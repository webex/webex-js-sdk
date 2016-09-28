/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {curry} from 'lodash';

export {escape, escapeSync} from './html-base';

/**
 * @param {Object} allowedTags
 * @param {Array<string>} allowedStyles
 * @param {string} html
 * @private
 * @returns {string}
 */
function noop(...args) {
  return new Promise((resolve) => {
    resolve(noopSync(...args));
  });
}

/**
 * @param {function} processCallback callback function to do additional
 * processing on node. of the form process(node)
 * @param {Object} allowedTags
 * @param {Array<string>} allowedStyles
 * @param {string} html
 * @private
 * @returns {string}
 */
function noopSync(processCallback, allowedTags, allowedStyles, html) {
  return html;
}

export const filter = curry(noop, 4);
export const filterSync = curry(noopSync, 4);
