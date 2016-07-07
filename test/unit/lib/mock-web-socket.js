/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var EventEmitter = require('events').EventEmitter;
var sinon = require('sinon');
var util = require('util');

function MockWebSocket(url) {
  var onclose;
  var onerror;
  var onmessage;
  var onopen;
  Object.defineProperties(this, {
    url: {
      writable: true,
      value: url
    },
    onclose: {
      get: function() {
        return onclose;
      },
      set: function(fn) {
        if (onclose) {
          this.removeListener('close', onclose);
        }
        onclose = fn;
        if (fn) {
          this.on('close', onclose);
        }
      }
    },
    onerror: {
      get: function() {
        return onerror;
      },
      set: function(fn) {
        if (onerror) {
          this.removeListener('error', onerror);
        }
        onerror = fn;
        if (fn) {
          this.on('error', onerror);
        }
      }
    },
    onmessage: {
      get: function() {
        return onmessage;
      },
      set: function(fn) {
        if (onmessage) {
          this.removeListener('message', onmessage);
        }
        onmessage = fn;
        if (fn) {
          this.on('message', onmessage);
        }
      }
    },
    onopen: {
      get: function() {
        return onopen;
      },
      set: function(fn) {
        if (onopen) {
          this.removeListener('open', onopen);
        }
        onopen = fn;
        if (fn) {
          this.on('open', onopen);
        }
      }
    },
    close: {
      value: function(code, reason) {
        this.readyState = 3;
        this.readyState = 4;
        this.onclose({
          code: code,
          reason: reason
        });
      },
      writable: true
    },
    send: {
      value: sinon.stub()
    }
  });

  sinon.spy(this, 'close');
}

util.inherits(MockWebSocket, EventEmitter);

assign(MockWebSocket.prototype, {
  addEventListener: function addEventListener() {
    return this.on.apply(this, arguments);
  },
  removeEventListener: function removeEventListener() {
    return this.removeEventListener.apply(this, arguments);
  }
});

module.exports = MockWebSocket;
