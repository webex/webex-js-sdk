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
    },
    isSharingMercury: {
      type: `boolean`,
      default: false
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
    return this.spark.feature.getFeature(`developer`, `web-shared-mercury`)
      .then((isSharingMercuryFeatureEnabled) => {
        if (isSharingMercuryFeatureEnabled && this.isSharingMercury) {
          return this.spark.mercury.socket.send(data);
        }
        return this.socket.send(data);
      });
  },

  /**
    * Open new mercury connection
    * @memberof Board.RealtimeService
    * @param   {Board~Channel} channel
    * @returns {Promise}
    */
  connectByOpenNewMercuryConnection(channel) {
    const bindings = [this._boardChannelIdToMercuryBinding(channel.channelId)];
    const bindingObj = {bindings};

    return this.spark.board.register(bindingObj)
      .then((registration) => {
        this.set({boardWebSocketUrl: registration.webSocketUrl});
        this.set({boardBindings: bindings});
        return this.connect();
      })
      .then(() => {
        this.isSharingMercury = false;
      });
  },


  /**
   * Ensure board channelId is compatible with mercury bindings by replacing
   * '-' with '.' and '_' with '#'
   * @memberof Board.BoardService
   * @param   {String} channelId channel.channelId
   * @returns {String} mercury-binding compatible string
   */
  _boardChannelIdToMercuryBinding(channelId) {
    // make channelId mercury compatible replace `-` with `.` and `_` with `#`
    return this.config.mercuryBindingPrefix + channelId.replace(/-/g, `.`).replace(/_/g, `#`);
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

        if (!res.sharedWebSocket) {
          return this.connect()
            .then(() => {
              this.isSharingMercury = false;
              return res;
            });
        }

        this.isSharingMercury = true;
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
        this.isSharingMercury = false;
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
