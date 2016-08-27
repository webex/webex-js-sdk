/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var backoff = require('backoff');
var contains = require('lodash.contains');
var set = require('lodash.set');
var oneFlight = require('../../util/one-flight');
var MercuryMetrics = require('../mercury/metrics');
var resolveWith = require('../../util/resolve-with');
var S = require('string');
var Socket = require('./socket');
var SparkBase = require('../../lib/spark-base');

/**
 * @class Mercury
 */
var Mercury = SparkBase.extend(
  /** @lends Mercury.prototype */
  {
  children: {
    metrics: MercuryMetrics
  },

  namespace: 'Mercury',

  session:
    /** @lends Mercury.prototype */
    {
    connecting: {
      default: false,
      type: 'boolean'
    },
    connected: {
      default: false,
      type: 'boolean'
    },
    socket: {
      type: 'any'
    }
  },

  derived:
    /** @lends Mercury.prototype */
    {
    /**
     * @deprecated
     * @type {boolean}
     */
    listening: {
      deps: ['connected'],
      fn: function listening() {
        return this.connected;
      }
    }
  },

  connect: oneFlight('connect', function connect() {
    if (this.connected) {
      this.logger.info('mercury: already connected, will not connect again');
      return Promise.resolve();
    }

    this.logger.info('mercury: connecting');

    return this._connectWithBackoff();
  }),

  disconnect: function disconnect() {
    return new Promise(function disconnect(resolve) {
      if (this.backoffCall) {
        this.logger.info('mercury: aborting connection');
        this.backoffCall.abort();
        // Temporary workaround because node-backoff doesn't emit abort events
        // or execute the completion handler.
        // See https://github.com/MathieuTurcotte/node-backoff/issues/15 for
        // details.
        this.backoffCall.emit('abort');
      }

      if (this.socket) {
        this.socket.removeAllListeners('message');
        this.once('offline', resolve);
        this.socket.close();
        return;
      }

      resolve();
    }.bind(this));
  },

  /**
   * @deprecated
   * @return {Promise}
   */
  listen: function listen() {
    return this.connect();
  },

  /**
   * @deprecated
   * @return {Promise}
   */
  stopListening: function stopListening() {
    return this.disconnect();
  },

  _connectWithBackoff: oneFlight('_connectWithBackoff', function _connectWithBackoff() {
    return new Promise(function _connectWithBackoff(resolve, reject) {
      this.connecting = true;
      var call = backoff.call(function depromiseify(callback) {
        this.logger.info('mercury: attempting mercury connection, retry ', call.getNumRetries());
        this._attemptConnection()
          .then(function applyCallback(res) {
            callback(null, res);
          })
          .catch(callback);
      }.bind(this), function onComplete(err) {
        this.connecting = false;
        this.backoffCall = undefined;
        if (err) {
          this.logger.info('mercury: failed to connect after ' + call.getNumRetries() + ' retries; log statement about next retry was inaccurate');
          return reject(err);
        }
        this.connected = true;
        resolve();
      }.bind(this));

      call.setStrategy(new backoff.ExponentialStrategy({
        initialDelay: 1000,
        maxDelay: this.config.backoffTimeMax
      }));

      if (this.config.maxRetries) {
        call.failAfter(this.config.maxRetries);
      }

      call.on('abort', function onAbort() {
        this.logger.info('mercury: connection aborted');
        reject();
      }.bind(this));

      call.on('callback', function onCallback(err) {
        var number = call.getNumRetries();
        var delay = call.strategy_.nextBackoffDelay_;
        if (err) {
          this.logger.info('mercury: failed to connect; attempting retry ' + (number + 1) + ' in ' + delay + ' ms');
          /* istanbul ignore if */
          if (process.env.NODE_ENV === 'development') {
            this.logger.debug('mercury:', err, err.stack);
          }
          return;
        }
        this.logger.info('mercury: connected');
      }.bind(this));

      setTimeout(function func() {
        call.start();
      }, Math.floor(1 + Math.random()*(900 - 1)));

      this.backoffCall = call;
    }.bind(this));
  }),

  _attemptConnection: function _attemptConnection() {
    var socket = this._getNewSocket();
    socket.on('close', this._onclose.bind(this));
    socket.on('message', this._onmessage.bind(this));
    socket.on('sequence-mismatch', this.metrics.submitSkipSequenceMetric.bind(this.metrics));

    return this.spark.credentials.getAuthorization()
      .then(function connect(authorization) {
        return socket.open(this.spark.device.webSocketUrl, {
          forceCloseDelay: this.config.forceCloseDelay,
          pingInterval: this.config.pingInterval,
          pongTimeout: this.config.pongTimeout,
          token: authorization,
          trackingId: this.spark.trackingId,
          logger: this.logger
        });
      }.bind(this))
      .then(function onconnect() {
        this.socket = socket;
        this.metrics.submitConnectMetric();
        this.trigger('online');
      }.bind(this))
      .catch(function handleError(reason) {
        // Suppress connection errors that appear to be network related. This
        // may end up suppressing metrics during outages, but we might not care
        // (especially since many of our outages happen in a way that client
        // metrics can't be trusted).
        if (reason.code !== 1006 && this.backoffCall.getNumRetries() > 0) {
          this.metrics.submitConnectionFailureMetric(reason);
        }
        this.logger.info('mercury: connection attempt failed');
        if (reason instanceof Socket.AuthorizationError) {
          this.logger.info('mercury: received authorization error, reauthorizing');
          return this.spark.refresh()
            .then(resolveWith(Promise.reject(reason)));
        }

        return Promise.reject(reason);
      }.bind(this));
  },

  _getNewSocket: function _getNewSocket() {
    return new Socket();
  },

  /**
   * Wraps `this.trigger()` in a try/catch so that errors in consuming libraries
   * do not break the entire app, but only processing of specific event.
   * @private
   */
  _emit: function _emit() {
    try {
      this.trigger.apply(this, arguments);
    }
    catch (error) {
      this.logger.error('mercury: error occurred in event handler', error);
    }
  },

  _onclose: function _onclose(event) {
    // I don't see any way to avoid the complexity or statement count in here.
    /* eslint max-statements: [0] */
    /* eslint complexity: [0] */
    try {
      var reason = event.reason && event.reason.toLowerCase();
      this.socket.removeAllListeners();
      this.unset('socket');
      this.connected = false;
      this._emit('offline', event);

      if (event.code === 1003) {
        this.logger.info('mercury: Mercury service rejected last message; will not reconnect', event.reason);
        this._emit('offline:permanent');
        this.metrics.submitDisconnectMetric({
          event: event,
          action: 'close'
        });
      }
      else if (event.code === 4000) {
        this.logger.error('mercury: socket replaced; will not reconnect');
        // TODO determine if the event needs to be emitted
        this._emit('offline:replaced', event);
        this.metrics.submitDisconnectMetric({
          event: event,
          action: 'close'
        });
      }
      else if (contains([1001, 1005, 1006, 1011], event.code)) {
        this.logger.info('mercury: socket disconnected; reconnecting');
        this._emit('offline:transient');
        this._reconnect();
        this.metrics.submitDisconnectMetric({
          event: event,
          action: 'reconnect'
        });

        if (event.code === 1011 && reason !== 'ping error') {
          this.metrics.submitUnexpectedClosureMetric(event);
        }
      }
      else if (event.code === 1000) {
        if (event.reason && contains([
          'idle',
          'done (forced)',
          'pong not received',
          'pong mismatch'
        ], reason)) {
          this.logger.info('mercury: socket disconnected; reconnecting');
          this._emit('offline:transient');
          this._reconnect();
          this.metrics.submitDisconnectMetric({
            event: event,
            action: 'reconnect'
          });

          if (reason === 'done (forced)') {
            this.metrics.submitForceClosureMetric();
          }
        }
        else {
          this.logger.info('mercury: socket disconnected; will not reconnect');
          this._emit('offline:permanent');
          this.metrics.submitDisconnectMetric({
            event: event,
            action: 'close'
          });
        }
      }
      else {
        this.logger.info('mercury: socket disconnected; will not reconnect');
        this._emit('offline:permanent');
        this.metrics.submitDisconnectMetric({
          event: event,
          action: 'close'
        });
        this.metrics.submitUnexpectedClosureMetric(event);
      }
    }
    catch (error) {
      this.logger.error('mercury: error occurred in close handler', error);
    }
  },

  /**
   * Takes the altered data from the 'headers' field and moves it
   * to the appropriate place within the activity.
   * @param  {Event} event   Contains the activity to modify.
   * @access private
   */
  _moveHeadersToData: function _moveHeadersToData(event) {
    var headerKeys = Object.keys(event.headers);
    headerKeys.forEach(function moveHeaderToData(keyPath) {
      set(event, keyPath, event.headers[keyPath]);
    });
  },

  _onmessage: function _onmessage(event) {
    event = event.data;

    if (event.headers) {
      this._moveHeadersToData(event);
    }

    // This looks a little more complicated than it needs to right now, but
    // eventually we'll want to be able to register event handlers rather than
    // just autowiring them.
    return this._getEventHandlers(event.data.eventType)
      .reduce(function runHandler(promise, handler) {
        // TODO should handlers receive the entire event?
        return promise.then(function runNextHandler() {
          event.namespace = handler.namespace;

          // Wrap the handler overly aggresively so that any exceptions it
          // produces still get logged via .catch
          return new Promise(function executor(resolve) {
            resolve(this.spark[handler.namespace][handler.name](event.data));
          }.bind(this))
            .catch(function logError(reason) {
              this.logger.error('mercury: error occurred in autowired event handler for ' + event.data.eventType, reason);
            }.bind(this));
        }.bind(this));
      }.bind(this), Promise.resolve())
      .then(function emitEvents() {
        this._emit('*', event);

        if (event.data.requestId) {
          this._emit('request', event.data);
          this._emit('request:' + event.data.requestId, event.data);
        }
        else {
          // TODO at some point, introduce a breaking change that emits just
          // `event`.
          this._emit(event.data.eventType, event.data, event);
          // Emit the event by category (e.g. 'locus.participant_joined'
          // -> 'locus').
          this._emit(event.namespace, event.data, event);
        }
      }.bind(this));
  },

  _getEventHandlers: function _getEventHandlers(eventType) {
    var parts = eventType.split('.');
    var handlers = [];

    var namespace = parts[0];
    if (!this.spark[namespace]) {
      return handlers;
    }
    var name = S('process_' + parts[1] + '_event').camelize().s;
    if (this.spark[namespace][name]) {
      handlers.push({
        namespace: namespace,
        name: name
      });
    }

    return handlers;
  },

  _reconnect: function reconnect() {
    this.logger.info('mercury: reconnecting');
    return this.connect();
  }
});

module.exports = Mercury;
