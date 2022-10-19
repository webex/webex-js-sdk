/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import uuid from 'uuid';
import {tap} from '@webex/common';
import {WebexPlugin} from '@webex/webex-core';

import RealtimeChannelCollection from './realtime-channel-collection.js';

/**
 * @class
 * @extends {Mercury}
 * @memberof Board
 */
const RealtimeService = WebexPlugin.extend({
  namespace: 'Board',

  collections: {
    realtimeChannels: RealtimeChannelCollection
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
    let contentType = 'STRING';

    if (message.payload.file) {
      contentType = 'FILE';
      encryptionPromise = this.webex.internal.board.encryptSingleFileContent(channel.defaultEncryptionKeyUrl, message.payload);
    }
    else {
      encryptionPromise = this.webex.internal.board.encryptSingleContent(channel.defaultEncryptionKeyUrl, message.payload);
    }

    return encryptionPromise
      .then((encryptedPayloadAndKeyUrl) => this.publishEncrypted(channel, encryptedPayloadAndKeyUrl, contentType));
  },

  /**
    * Sends the message via the socket. The message should already have been
    * encrypted
    * @memberof Board.RealtimeService
    * @param {Board~Channel} channel
    * @param {object} encryptedPayloadAndKeyUrl
    * @param {string} contentType - provides hint for decryption. Defaults to
    * `STRING`, and could also be `FILE`
    * @returns {Promise<Board~Content>}
    */
  publishEncrypted(channel, encryptedPayloadAndKeyUrl, contentType) {
    const realtimeChannel = this.realtimeChannels.get(channel.channelId);

    if (!realtimeChannel) {
      return Promise.reject(new Error('Realtime Channel not found'));
    }

    const data = {
      id: uuid.v4(),
      type: 'publishRequest',
      recipients: [{
        alertType: 'none',
        route: realtimeChannel.binding,
        headers: {}
      }],
      data: {
        eventType: 'board.activity',
        contentType,
        payload: encryptedPayloadAndKeyUrl.payload,
        envelope: {
          encryptionKeyUrl: encryptedPayloadAndKeyUrl.encryptionKeyUrl,
          channelId: channel.channelId
        }
      }
    };

    // provide a hint for decryption
    if (contentType === 'FILE') {
      data.data.payload = {
        file: encryptedPayloadAndKeyUrl.file,
        payload: encryptedPayloadAndKeyUrl.payload
      };
    }

    return realtimeChannel.send(data);
  },

  createRealtimeChannel(channel) {
    const requestBindings = [this._boardChannelIdToMercuryBinding(channel.channelId)];
    const bindingObj = {bindings: requestBindings};

    return this.webex.internal.board.register(bindingObj)
      .then(({webSocketUrl, bindings}) => {
        this.realtimeChannels.add({
          channelId: channel.channelId,
          socketUrl: webSocketUrl,
          binding: bindings[0]
        });

        return this.realtimeChannels.get(channel.channelId);
      });
  },

  /**
    * Open new mercury connection
    * @memberof Board.RealtimeService
    * @param   {Board~Channel} channel
    * @returns {Promise}
    */
  connectByOpenNewMercuryConnection(channel) {
    let promise = Promise.resolve();
    let realtimeChannel = this.realtimeChannels.get(channel.channelId);

    if (!realtimeChannel) {
      this.logger.info('board realtime: realtime channel not found, creating new channel');
      promise = this.createRealtimeChannel(channel)
        .then((rc) => {
          realtimeChannel = rc;
          this.logger.info('board realtime: realtime channel created');

          return realtimeChannel;
        });
    }

    return promise
      .then(() => realtimeChannel.connect(realtimeChannel.socketUrl));
  },

  /**
    * Disconnect connection
    * @memberof Board.RealtimeService
    * @param   {Board~Channel} channel
    * @returns {Promise}
    */
  disconnectMercuryConnection(channel) {
    const realtimeChannel = this.realtimeChannels.get(channel.channelId);

    if (!realtimeChannel) {
      return Promise.reject(new Error('Realtime Channel not found!'));
    }

    return realtimeChannel.disconnect()
      // even if we can't remove the channels from the collection, we can still
      // continue on execution
      .then(tap(() => this.realtimeChannels.remove(channel.channelId)));
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
    return this.config.mercuryBindingPrefix + channelId.replace(/-/g, '.').replace(/_/g, '#');
  },

  /**
   * Connect and use an exisiting mercury connection
   * @memberof Board.RealtimeService
   * @param  {Board~Channel} channel
   * @returns {Promise<Board~Registration>}
   */
  connectToSharedMercury(channel) {
    return this.webex.internal.board.registerToShareMercury(channel)
      .then((res) => {
        this.realtimeChannels.add({
          channelId: channel.channelId,
          binding: res.binding,
          socketUrl: res.webSocketUrl
        });

        const realtimeChannel = this.realtimeChannels.get(channel.channelId);

        if (!res.sharedWebSocket) {
          return realtimeChannel.connect(realtimeChannel.socketUrl)
            .then(() => res);
        }

        realtimeChannel.isSharingMercury = true;
        realtimeChannel.socket = this.webex.internal.mercury.socket;
        // refresh socket reference when mercury is reconnected
        this.webex.internal.mercury.off('online', this.refreshMercurySocketReference, this);
        this.webex.internal.mercury.on('online', this.refreshMercurySocketReference, this);

        // make sure there's only one handler
        this.webex.internal.mercury.off('event:board.activity', this.handleBoardActivityMessages, this);
        this.webex.internal.mercury.on('event:board.activity', this.handleBoardActivityMessages, this);

        return res;
      });
  },

  handleBoardActivityMessages(event) {
    const realtimeChannel = this.realtimeChannels.get(event.data.envelope.channelId);

    if (realtimeChannel) {
      realtimeChannel._emit('event:board.activity', event);
    }
  },

  refreshMercurySocketReference() {
    this.realtimeChannels.forEach((realtimeChannel) => {
      realtimeChannel.socket = this.webex.internal.mercury.socket;
    });
  },

  /**
   * Remove board binding from existing mercury connection
   * @memberof Board.RealtimeService
   * @param  {Board~Channel} channel
   * @returns {Promise<Board~Registration>}
   */
  disconnectFromSharedMercury(channel) {
    const realtimeChannel = this.realtimeChannels.get(channel.channelId);

    if (!realtimeChannel.isSharingMercury && realtimeChannel.socket && realtimeChannel.connected) {
      return this.disconnectMercuryConnection(channel);
    }

    return this.webex.internal.board.unregisterFromSharedMercury(channel, realtimeChannel.binding)
      // tap suppress errors but we can still go on if the channel can't be
      // removed from the collection
      .then(tap(() => this.realtimeChannels.remove(channel.channelId)));
  }

});

export default RealtimeService;
