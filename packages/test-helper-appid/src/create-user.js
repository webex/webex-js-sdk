/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

'use strict';

var jwt = require('jsonwebtoken');

module.exports = function createUser(options) {
  return Promise.resolve({jwt: jwt.sign({
    org: process.env.CISCOSPARK_APPID_ORGID
  }, new Buffer(process.env.CISCOSPARK_APPID_SECRET, 'base64'), options)});
};
