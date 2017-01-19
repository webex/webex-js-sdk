/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Socket, Mercury, AuthorizationError} from '@ciscospark/plugin-mercury';
import uuid from 'uuid';

/**
 * @class
 * @extends {Mercury}
 * @memberof Board
 */
const RealtimeService = Mercury.extend({
  namespace: `Board`,

  session: {
    boardWebSocketUrl: {
      type: `string`,
      default: () => ``
    },
    boardBindings: {
      type: `array`,
      default: () => []
    }
  },

  /**
    * Sends the message via the socket. Assumes that the message is already properly formatted
    * @memberof Board.RealtimeService
    * @param {Board~Channel} channel
    * @param {string} message   Contains the un-encrypted message to send.
    * @returns {Promise<Board~Content>}
    */
  publish(channel, message) {
    let encryptionPromise;
    let contentType = `STRING`;

    if (message.payload.file) {
      contentType = `FILE`;
      encryptionPromise = this.spark.board.encryptSingleFileContent(channel.defaultEncryptionKeyUrl, message.payload);
    }
    else {
      encryptionPromise = this.spark.board.encryptSingleContent(channel.defaultEncryptionKeyUrl, message.payload);
    }

    return encryptionPromise
      .then((encryptedPayloadAndKeyUrl) => this.publishEncrypted(encryptedPayloadAndKeyUrl, contentType));
  },

  /**
    * Sends the message via the socket. The message should already have been
    * encrypted
    * @memberof Board.RealtimeService
    * @param {object} encryptedPayloadAndKeyUrl
    * @param {string} contentType - provides hint for decryption. Defaults to
    * `STRING`, and could also be `FILE`
    * @returns {Promise<Board~Content>}
    */
  publishEncrypted(encryptedPayloadAndKeyUrl, contentType) {
    const bindings = this.spark.board.realtime.get(`boardBindings`);
    const data = {
      id: uuid.v4(),
      type: `publishRequest`,
      recipients: [{
        alertType: `none`,
        route: bindings[0],
        headers: {}
      }],
      data: {
        eventType: `board.activity`,
        contentType,
        payload: encryptedPayloadAndKeyUrl.encryptedData,
        envelope: {
          encryptionKeyUrl: encryptedPayloadAndKeyUrl.encryptionKeyUrl
        }
      }
    };

    // provide a hint for decryption
    if (contentType === `FILE`) {
      data.data.payload = {
        file: encryptedPayloadAndKeyUrl.file,
        payload: encryptedPayloadAndKeyUrl.encryptedData
      };
    }

    // use mercury socket if it is shared
    // if this.socket is defined then use it instead
    const isSharingMercuryFeatureEnabled = this.spark.device.features.developer.get(`web-sharable-mercury`);
    if (isSharingMercuryFeatureEnabled && isSharingMercuryFeatureEnabled.value && !this.socket) {
      return this.spark.mercury.socket.send(data);
    }

    return this.socket.send(data);
  },

  /**
   * Connect and use an exisiting mercury connection
   * @memberof Board.RealtimeService
   * @param  {Board~Channel} channel
   * @returns {Promise<Board~Registration>}
   */
  connectToSharedMercury(channel) {
    return this.spark.board.registerToShareMercury(channel)
      .then((res) => {
        this.boardBindings = [res.binding];
        this.boardWebSocketUrl = res.webSocketUrl;
        return res;
      });
  },

  /**
   * Remove board binding from existing mercury connection
   * @memberof Board.RealtimeService
   * @param  {Board~Channel} channel
   * @returns {Promise<Board~Registration>}
   */
  disconnectFromSharedMercury(channel) {
    return this.spark.board.unregisterFromSharedMercury(channel, this.boardBindings[0])
      .then((res) => {
        this.boardBindings = [];
        this.boardWebSocketUrl = ``;
        return res;
      });
  },

  _getNewSocket() {
    return new Socket();
  },

  _attemptConnection(callback) {
    const socket = this._getNewSocket();
    socket.on(`close`, (...args) => this._onclose(...args));
    socket.on(`message`, (...args) => this._onmessage(...args));
    socket.on(`sequence-mismatch`, (...args) => this._emit(`sequence-mismatch`, ...args));

    this.spark.credentials.getAuthorization()
      .then((authorization) => socket.open(this.spark.board.realtime.get(`boardWebSocketUrl`), {
        forceCloseDelay: this.config.forceCloseDelay,
        pingInterval: this.config.pingInterval,
        pongTimeout: this.config.pongTimeout,
        token: authorization,
        trackingId: `${this.spark.sessionId}_${Date.now()}`,
        logger: this.logger
      }))
      .then(() => {
        this.socket = socket;
        callback();
      })
      .catch((reason) => {
        // Suppress connection errors that appear to be network related. This
        // may end up suppressing metrics during outages, but we might not care
        // (especially since many of our outages happen in a way that client
        // metrics can't be trusted).
        if (reason.code !== 1006 && this.backoffCall.getNumRetries() > 0) {
          this._emit(`connection_failed`, reason, {retries: this.backoffCall.getNumRetries()});
        }
        this.logger.info(`mercury: connection attempt failed`, reason);
        if (reason instanceof AuthorizationError) {
          this.logger.info(`mercury: received authorization error, reauthorizing`);
          return this.spark.refresh()
            .then(() => callback(reason));
        }
        return callback(reason);
      })
      .catch((reason) => {
        this.logger.error(`mercury: failed to handle connection failured`, reason);
        callback(reason);
      });
  }
});

export default RealtimeService;
