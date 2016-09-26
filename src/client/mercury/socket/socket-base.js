/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var defaults = require('lodash.defaults');
var EventEmitter = require('events').EventEmitter;
var extendError = require('extend-error');
var isObject = require('lodash.isobject');
var shimPlaceholder = require('../../../lib/shim-placeholder');
var util = require('util');
var uuid = require('uuid');

var ConnectionError = extendError({
  parseFn: function parse(event) {
    Object.defineProperties(this, {
      code: {
        value: event.code
      },
      reason: {
        value: event.reason
      }
    });

    return event.reason;
  },

  subTypeName: 'ConnectionError'
});

var AuthorizationError = extendError(ConnectionError, {
  subTypeName: 'AuthorizationError'
});

function Socket() {
  Object.defineProperties(this, {
    binaryType: {
      get: function get() {
        return this._socket.binaryType;
      }
    },
    bufferedAmount: {
      get: function get() {
        return this._socket.bufferedAmount;
      }
    },
    extensions: {
      get: function get() {
        return this._socket.extensions;
      }
    },
    protocol: {
      get: function get() {
        return this._socket.protocol;
      }
    },
    readyState: {
      get: function get() {
        return this._socket.readyState;
      }
    },
    url: {
      get: function get() {
        return this._socket.url;
      }
    }
  });

  this.onclose = this.onclose.bind(this);
  this.onmessage = this.onmessage.bind(this);
}

util.inherits(Socket, EventEmitter);

assign(Socket.prototype, {
  close: function close(options) {
    return new Promise(function close(resolve, reject) {
      this.logger.info('socket: closing');
      if (this._socket.readyState === 2 || this._socket.readyState === 3) {
        this.logger.info('socket: already closed');
        return resolve();
      }

      options = options || {};
      if (options.code && options.code !== 1000 && (options.code < 3000 || options.code > 4999)) {
        return reject(new Error('`options.code` must be 1000 or between 3000 and 4999 (inclusive)'));
      }

      options = defaults(options, {
        code: 1000,
        reason: 'Done'
      });

      var closeTimer = setTimeout(function forceClose() {
        try {
          this.logger.info('socket: no close event received, forcing closure');
          resolve(this.onclose({
            code: 1000,
            reason: 'Done (forced)'
          }));
        }
        catch (error) {
          // The only way this catch can be triggered is if something goes
          // horribly wrong in the Mercury close handler
          /* istanbul ignore next */
          this.logger.warn('socket: force-close failed', error);
        }
      }.bind(this), this.forceCloseDelay);

      this._socket.onclose = function onclose(event) {
        this.logger.info('socket: close event fired', event.code, event.reason);
        clearTimeout(closeTimer);
        this.onclose(event);
        resolve(event);
      }.bind(this);

      this._socket.close(options.code, options.reason);
    }.bind(this));
  },

  open: function open(url, options) {
    options = options || {};

    return new Promise(function open(resolve, reject) {
      /* eslint complexity: [0] */
      if (!url) {
        return reject(new Error('`url` is required'));
      }

      if (this._socket) {
        return reject(new Error('socket#open() can only be called once'));
      }

      [
        'forceCloseDelay',
        'pingInterval',
        'pongTimeout',
        'token',
        'trackingId',
        'logger'
      ].forEach(function setRequiredOptions(key) {
        if (!options[key]) {
          throw new Error('`options.' + key + '` is required');
        }

        Object.defineProperty(this, key, {
          enumerable: false,
          value: options[key],
          writable: false
        });
      }.bind(this));

      if (options.logLevelToken) {
        Object.defineProperty(this, 'logLevelToken', {
          enumerable: false,
          value: options.logLevelToken,
          writable: true
        });
      }

      options = options || {};

      // It's unlikely we'll ever not need to add the extra parameter here.
      /* istanbul ignore else */
      if (url.indexOf('outboundWireFormat=text') === -1) {
        url += ((url.indexOf('?') === -1) ? '?' : '&') + 'outboundWireFormat=text';
      }

      /* istanbul ignore else */
      if (url.indexOf('bufferStates=true') === -1) {
        // It's unlikely bufferStates is the first parameter as
        // outboundingWireFormat will be there first
        /* istanbul ignore next */
        url += ((url.indexOf('?') === -1) ? '?' : '&') + 'bufferStates=true';
      }

      this.logger.info('socket: connecting to websocket');
      this._socket = this._open(url);

      this._socket.binaryType = 'arraybuffer';

      this._socket.onmessage = this.onmessage;

      this._socket.onclose = function onclose(event) {
        this.logger.info('socket: closed while connecting', event.code, event.reason);
        event = this._fixCloseCode(event);
        if (event.code === 1008) {
          reject(new AuthorizationError(event));
          return;
        }
        reject(new ConnectionError(event));
      }.bind(this);

      this._socket.onopen = function onopen() {
        this.logger.info('socket: connected');
        this._authorize()
          .then(function onauthorize() {
            this.logger.info('socket: authorized');
            this._socket.onclose = this.onclose;
          }.bind(this))
          .then(resolve)
          .catch(reject);
      }.bind(this);

      this._socket.onerror = function onerror(event) {
        this.logger.warn('socket: error event fired', event);
      }.bind(this);

    }.bind(this));
  },

  onclose: function onclose(event) {
    this.logger.info('socket: closed', event.code, event.reason);
    clearTimeout(this.pongTimer);
    clearTimeout(this.pingTimer);

    event = this._fixCloseCode(event);
    this.emit('close', event);

    // Remove all listeners to (a) avoid reacting to late pongs and (b) ensure
    // we don't have a retain cycle.
    this.removeAllListeners();
  },

  onmessage: function onmessage(event) {
    try {
      var data = JSON.parse(event.data);

      var sequenceNumber = parseInt(data.sequenceNumber);
      this.logger.debug('socket: sequence number: ', sequenceNumber);
      if (this.expectedSequenceNumber && sequenceNumber !== this.expectedSequenceNumber) {
        this.logger.debug('socket: sequence number mismatch indicates lost mercury message', this.expectedSequenceNumber, sequenceNumber);
        this.emit('sequence-mismatch', sequenceNumber, this.expectedSequenceNumber);
      }
      this.expectedSequenceNumber = sequenceNumber + 1;

      var processedEvent = {data: data};
      this._acknowledge(processedEvent);
      // Yes, it's a little weird looking; we want to emit message events that
      // look like normal socket message events, but event.data cannot be
      // modified.
      if (data.type === 'pong') {
        this.emit('pong', processedEvent);
      }
      else {
        this.emit('message', processedEvent);
      }
    }
    catch (e) {
      // The above code should only be able to throw if we receive an unparsable
      // message from Mercury. At this time, the only action we have is to
      // ignore it and move on.
      /* istanbul ignore next */
      this.logger.warn('socket: error while handling Mercury message', e, e.stack);
    }
  },

  send: function send(data) {
    return new Promise(function send(resolve, reject) {
      if (this.readyState !== 1) {
        return reject(new Error('INVALID_STATE_ERROR'));
      }

      if (isObject(data)) {
        data = JSON.stringify(data);
      }

      this._socket.send(data);
      resolve();
    }.bind(this));
  },

  _acknowledge: function _acknowledge(event) {
    event = event || {};
    event.data = event.data || {};
    if (!event.data.id) {
      return Promise.reject(new Error('`event.data.id` is required'));
    }

    return this.send({
      messageId: event.data.id,
      type: 'ack'
    });
  },

  _authorize: function _authorize() {
    this.logger.info('socket: authorizing');
    return new Promise(function _authorize(resolve, reject) {
      this.send({
        id: uuid.v4(),
        type: 'authorization',
        data: {
          token: this.token
        },
        trackingId: this.trackingId,
        logLevelToken: this.logLevelToken
      });

      var id = uuid.v4();
      this.once('pong', function onPong(event) {
        try {
          if (event.data.id === id) {
            this._ping();

            return resolve();
          }

          reject(new Error('socket: received response to wrong ping'));
        }
        catch (error) {
          // This try/catch block was added as a debugging step; to the best of
          // my knowledge, the above can never throw.
          /* istanbul ignore next */
          this.logger.error('socket: failed to receive initial pong', error);
          /* istanbul ignore next */
          reject(error);
        }
      }.bind(this));

      this.send({
        id: id,
        type: 'ping'
      });
    }.bind(this));

  },

  _fixCloseCode: function _fixCloseCode(event) {
    if (event.code === 1005) {
      switch (event.reason.toLowerCase()) {
        case 'replaced':
          this.logger.debug('socket: fixing CloseEvent code for reason: ', event.reason);
          event.code = 4000;
          break;
        case 'authentication failed':
        case 'authentication did not happen within the timeout window of 30000 seconds.':
          this.logger.debug('socket: fixing CloseEvent code for reason: ', event.reason);
          event.code = 1008;
          break;
      }
    }

    return event;
  },

  _open: shimPlaceholder('Socket', '_open'),

  _ping: function _ping(id) {
    id = id || uuid.v4();
    this.pongTimer = setTimeout(onPongNotReceived.bind(this), this.pongTimeout);
    this.once('pong', scheduleNextPingAndCancelPongTimer.bind(this));
    this.once('pong', confirmPongId.bind(this));

    this.logger.debug('socket: ping', id);
    return this.send({
      id: id,
      type: 'ping'
    });

    function onPongNotReceived() {
      try {
        this.logger.info('socket: pong not received in expected period, closing socket');
        this.close({
          code: 1000,
          reason: 'Pong not received'
        })
          .catch(function logFailure(reason) {
            this.logger.warn('socket: failed to close socket after missed pong', reason);
          }.bind(this));
      }
      catch (error) {
        // This try/catch block was added as a debugging step; to the best of my
        // knowledge, the above can never throw.
        /* istanbul ignore next */
        this.logger.error('socket: error occurred in onPongNotReceived', error);
      }
    }

    function scheduleNextPingAndCancelPongTimer() {
      try {
        clearTimeout(this.pongTimer);
        this.pingTimer = setTimeout(this._ping.bind(this), this.pingInterval);
      }
      catch (error) {
        // This try/catch block was added as a debugging step; to the best of my
        // knowledge, the above can never throw.
        /* istanbul ignore next */
        this.logger.error('socket: error occurred in scheduleNextPingAndCancelPongTimer', error);
      }
    }

    function confirmPongId(event) {
      try {
        this.logger.debug('socket: pong', event.data.id);
        if (event.data && event.data.id !== id) {
          this.logger.info('socket: received pong for wrong ping id, closing socket');
          this.logger.debug('socket: expected', id, 'received', event.data.id);
          this.close({
            code: 1000,
            reason: 'Pong mismatch'
          });
        }
      }
      catch (error) {
        // This try/catch block was added as a debugging step; to the best of my
        // knowledge, the above can never throw.
        /* istanbul ignore next */
        this.logger.error('socket: error occurred in confirmPongId', error);
      }
    }
  }
});

assign(Socket, {
  ConnectionError: ConnectionError,

  AuthorizationError: AuthorizationError
});

module.exports = Socket;
