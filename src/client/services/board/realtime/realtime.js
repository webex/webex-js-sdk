/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var Mercury = require('../../../mercury/mercury.js');
var Socket = require('../../../mercury/socket');
var resolveWith = require('../../../../util/resolve-with');
var uuid = require('uuid');
var BoardMetrics = require('./metrics');

/**
 * @class
 * @extends {Mercury}
 * @memberof Board
 */
var RealtimeService = Mercury.extend({

  children: {
    metrics: BoardMetrics
  },

  namespace: 'Board',

  session: {
    boardWebSocketUrl: {
      type: 'string',
      default: function defaultBoardSocketUrl() { return ''; }
    },
    boardBindings: {
      type: 'array',
      default: function defaultBoardBinding() { return []; }
    }
  },

  /**
    * Sends the message via the socket. Assumes that the message is already properly formatted
    * @memberof Board.RealtimeService
    * @param {Board~Channel} channel
    * @param {string} message Contains the un-encrypted message to send.
    * @returns {Promise<Board~Content>}
    */
  publish: function publish(channel, message) {
    var encryptionPromise;
    var contentType = 'STRING';

    if (message.payload.file) {
      contentType = 'FILE';
      encryptionPromise = this.spark.board.encryptSingleFileContent(channel.defaultEncryptionKeyUrl, message.payload);
    }
    else {
      encryptionPromise = this.spark.board.encryptSingleContent(channel.defaultEncryptionKeyUrl, message.payload);
    }

    return encryptionPromise
      .then(function publishEncryptedData(encryptedPayloadAndKeyUrl) {
        return this.publishEncrypted(encryptedPayloadAndKeyUrl, contentType);
      }.bind(this));
  },

  /**
    * Sends the message via the socket. The message should already have been
    * encrypted
    * @memberof Board.RealtimeService
    * @param {Object} encryptedDataAndKeyUrl
    * @param {string} contentType - provides hint for decryption. Defaults to
    * 'STRING', and could also be 'FILE'
    * @returns {Promise<Board~Content>}
    */
  publishEncrypted: function publishEncrypted(encryptedDataAndKeyUrl, contentType) {
    var bindings = this.spark.board.realtime.boardBindings;
    var data = {
      id: uuid.v4(),
      type: 'publishRequest',
      recipients: [{
        alertType: 'none',
        route: bindings[0],
        headers: {}
      }],
      data: {
        eventType: 'board.activity',
        contentType: contentType,
        payload: encryptedDataAndKeyUrl.encryptedData,
        envelope: {
          encryptionKeyUrl: encryptedDataAndKeyUrl.encryptionKeyUrl
        }
      }
    };

    if (contentType === 'FILE') {
      data.data.payload = {
        file: encryptedDataAndKeyUrl.file,
        payload: encryptedDataAndKeyUrl.encryptedData
      };
    }

    // if socket is shared, we're sending using mercury's socket rather than
    // board's instance
    // however, if board.socket is defined, we're falling back to separate
    // socket
    if (this.spark.feature.getFeature('developer', 'web-sharable-mercury') && !this.socket) {
      return this.spark.mercury.socket.send(data);
    }
    else {
      return this.socket.send(data);
    }
  },

  /**
    * Connect to an existing sharable mercury connection
    * @memberof Board.RealtimeService
    * @param   {Board~Channel} channel
    * @returns {Promise<Board~Registration>}
    */
  connectToSharedMercury: function connectToSharedMercury(channel) {
    return this.spark.board.persistence.registerToShareMercury(channel)
      .then(function assignBindingAndWebSocketUrl(res) {
        this.boardBindings = [res.binding];
        this.boardWebSocketUrl = res.webSocketUrl;
        return res;
      }.bind(this));
  },

  /**
    * Remove binding and stop receiving messages from mercury
    * @memberof Board.RealtimeService
    * @param   {Board~Channel} channel
    * @returns {Promise<Board~Registration>}
    */
  disconnectFromSharedMercury: function disconnectFromSharedMercury(channel) {
    return this.spark.board.persistence.unregisterFromSharedMercury(channel, this.boardBindings[0])
      .then(function assignBindingAndWebSocketUrl(res) {
        this.boardBindings = [];
        this.boardWebSocketUrl = '';
        return res;
      }.bind(this));
  },

  _attemptConnection: function _attemptConnection() {
    var socket = this._getNewSocket();
    socket.on('close', this._onclose.bind(this));
    socket.on('message', this._onmessage.bind(this));
    socket.on('sequence-mismatch', this.metrics.submitSkipSequenceMetric.bind(this.metrics));
    return this.spark.credentials.getAuthorization()
      .then(function connect(authorization) {
        return socket.open(this.spark.board.realtime.get('boardWebSocketUrl'), {
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
  }
});

module.exports = RealtimeService;
