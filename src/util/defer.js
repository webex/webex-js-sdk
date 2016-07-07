/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';


/**
 * @memberof Util
 */
function Defer() {
  var result = {};
  result.promise = new Promise(function executor(resolve, reject) {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
}

module.exports = Defer;
