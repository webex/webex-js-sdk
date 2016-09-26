/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var EventEmitter = require('events').EventEmitter;
var sinon = require('sinon');
var util = require('util');

function MockSocket() {
  this.readyState = 1;

  Object.defineProperties(this, {
    close: {
      value: sinon.spy()
    },
    open: {
      value: sinon.stub()
    },
    send: {
      value: sinon.spy()
    }
  });
}

util.inherits(MockSocket, EventEmitter);

module.exports = MockSocket;
