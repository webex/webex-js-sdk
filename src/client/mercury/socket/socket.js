/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var Socket = require('./socket-base');
var WS = require('ws');

assign(Socket.prototype, {
  _open: function _open(url) {
    return new WS(url);
  }
});

module.exports = Socket;
