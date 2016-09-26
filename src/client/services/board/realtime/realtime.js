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
    * @param {Conversation} conversation
    * @param {string} message   Contains the un-encrypted message to send.
    * @returns {Promise<Board~Content>}
    */
  publish: function publish(conversation, message) {
    var encryptionPromise;
    var contentType = 'STRING';

    if (message.payload.scr) {
      contentType = 'FILE';
      encryptionPromise = this.spark.board.encryptSingleFileContent(conversation.defaultActivityEncryptionKeyUrl, message.payload);
    }
    else {
      encryptionPromise = this.spark.board.encryptSingleContent(conversation.defaultActivityEncryptionKeyUrl, message.payload);
    }

    return encryptionPromise
      .then(function publishEncryptedData(encryptedPayloadAndKeyUrl) {
        return this.publishEncrypted(encryptedPayloadAndKeyUrl.encryptionKeyUrl, encryptedPayloadAndKeyUrl.encryptedData, contentType);
      }.bind(this));
  },

  /**
    * Sends the message via the socket. The message should already have been
    * encrypted
    * @memberof Board.RealtimeService
    * @param {string} encryptionKeyUrl
    * @param {string} encryptedData
    * @param {string} contentType - provides hint for decryption. Defaults to
    * 'STRING', and could also be 'FILE'
    * @returns {Promise<Board~Content>}
    */
  publishEncrypted: function publishEncrypted(encryptionKeyUrl, encryptedData, contentType) {
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
        contentType: 'STRING',
        payload: encryptedData,
        envelope: {
          encryptionKeyUrl: encryptionKeyUrl
        }
      }
    };

    // provide a hint for decryption
    if (contentType) {
      data.data.contentType = contentType;
    }
    return this.socket.send(data);
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
