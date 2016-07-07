/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/**
 * Creates a placeholder for methods that need to be shimmed.
 * @param {string} nodeFileName
 * @param {string} methodName
 */
function shimPlaceholder(nodeFileName, methodName) {
  return function placeholder() {
    throw new Error('`' + methodName + '` must be implemented in `' + nodeFileName + '.js` and `' + nodeFileName + '.shim.js`');
  };
}

module.exports = shimPlaceholder;
