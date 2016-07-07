/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/**
 * Helper for getting a url to localhost
 * @param {string} resource
 * @returns {string}
 */
module.exports = function makeLocalUrl(resource) {
  if (typeof window !== 'undefined') {
    return '/fixtures' + resource;
  }

  return 'http://localhost:' + process.env.FIXTURE_PORT + resource;
};
