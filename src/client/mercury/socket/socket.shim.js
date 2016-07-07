/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */

var assign = require('lodash.assign');
var Socket = require('./socket-base');

assign(Socket.prototype, {
  _open: function _open(url) {
    return new WebSocket(url);
  }
});

module.exports = Socket;
