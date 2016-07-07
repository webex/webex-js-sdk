/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

function delay(timeout) {
  return new Promise(function(resolve) {
    setTimeout(resolve, timeout);
  });
}

module.exports = delay;
