/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import querystring from 'querystring';

import {WebexPlugin} from '@webex/webex-core';
import {base64} from '@webex/common';

/**
 * @class
 * @extends {Lyra}
 * @memberof Lyra
 */
const Space = WebexPlugin.extend({
  namespace: 'Lyra',

  /**
   * Lists lyra spaces associated with user
   *
   * @returns {Promise<Array>} spaces
   */
  list() {
    return this.webex
      .request({
        method: 'GET',
        api: 'lyra',
        resource: '/spaces',
      })
      .then((res) => res.body.items);
  },

  /**
   * Retrieves a lyra space info
   * @param {Types~LyraSpace} space
   * @param {string} space.id
   * @param {string} space.identity.id
   * @returns {Promise<LyraSpace>} response body
   */
  get(space = {}) {
    const spaceId = space.id || (space.identity && space.identity.id);

    if (!spaceId) {
      return Promise.reject(new Error('space.id is required'));
    }

    return this.webex
      .request({
        method: 'GET',
        api: 'lyra',
        resource: `/spaces/${spaceId}`,
      })
      .then((res) => res.body);
  },

  /**
   * Joins a lyra space, update every 10 minutes to keep alive for MANUAL
   * @param {Types~LyraSpace} space
   * @param {string} space.url
   * @param {object} options
   * @param {string} options.passType
   * @param {string} options.data additional data such as proof for ultrasound
   * @param {string} options.uri use a custom uri
   * @returns {Promise}
   */
  join(space, options) {
    options = {
      passType: 'MANUAL',
      ...options,
    };

    const body = {
      pass: {
        type: options.passType,
      },
      deviceUrl: this.webex.internal.device.url,
    };

    if (options.data) {
      body.pass.data = options.data;
    }

    if (options.verificationInitiation) {
      body.verificationInitiation = options.verificationInitiation;
    }

    // if options.uri is available use it, since that would have the
    // complete lyra service URL
    if (options.uri) {
      return this.webex.request({
        method: 'PUT',
        uri: options.uri,
        body,
      });
    }

    return this.webex.request({
      method: 'PUT',
      api: 'lyra',
      resource: `${space.url}/occupants/@me`,
      body,
    });
  },

  /**
   * Leaves a lyra space
   * @param {Types~LyraSpace} space
   * @param {string} space.url
   * @param {object} options
   * @param {boolean} options.removeAllDevices remove all devices of current user also
   * @returns {Promise}
   */
  leave(space, options = {}) {
    // all devices are removed by default (when deviceUrl is not supplied)
    let uri = `${space.url}/occupants/@me`;

    if (!options.removeAllDevices) {
      const params = {
        deviceUrl: base64.toBase64Url(this.webex.internal.device.url),
      };

      uri += `?${querystring.stringify(params)}`;
    }

    return this.webex.request({
      method: 'DELETE',
      api: 'lyra',
      resource: uri,
    });
  },

  /**
   * Verifies a space occupant (to be used by the lyra device)
   * @param {Types~LyraSpace} space
   * @param {string} space.url
   * @param {string} occupantId id of user to verify
   * @returns {Promise}
   */
  verifyOccupant(space, occupantId) {
    const body = {
      pass: {
        type: 'VERIFICATION',
      },
    };

    return this.webex.request({
      method: 'PUT',
      uri: `${space.url}/occupants/${occupantId}`,
      body,
    });
  },

  /**
   * Gets the state of bindings in this Lyra space
   * @param {Types~LyraSpace} space
   * @param {string} space.url
   * @returns {Promise<LyraBindings>} bindings response body
   */
  getCurrentBindings(space) {
    return this.webex
      .request({
        method: 'GET',
        uri: `${space.url}/bindings`,
      })
      .then((res) => res.body);
  },

  /**
   * Binds a conversation to lyra space
   * @param {Types~LyraSpace} space
   * @param {string} space.url
   * @param {string} space.id
   * @param {string} space.identity.id
   * @param {Types~Conversation} conversation
   * @param {string} conversation.kmsResourceObjectUrl
   * @param {string} conversation.url
   * @param {object} options
   * @param {boolean} options.uri complete lyra service URL
   * @returns {Promise<LyraBindings>} bindings response body
   */
  bindConversation(space = {}, conversation = {}, options = {}) {
    const spaceId = space.id || (space.identity && space.identity.id);

    if (!space.url) {
      return Promise.reject(new Error('space.url is required'));
    }

    if (!spaceId) {
      return Promise.reject(new Error('space.id is required'));
    }

    if (!conversation.kmsResourceObjectUrl) {
      return Promise.reject(new Error('conversation.kmsResourceObjectUrl is required'));
    }

    if (!conversation.url) {
      return Promise.reject(new Error('conversation.url is required'));
    }

    const body = {
      kmsMessage: {
        method: 'create',
        uri: '/authorizations',
        resourceUri: `${conversation.kmsResourceObjectUrl}`,
        userIds: [spaceId],
      },
      conversationUrl: conversation.url,
    };

    const request = {
      method: 'POST',
      body,
    };

    // if options.uri is available use it, since that would have the
    // complete lyra service URL
    if (options.uri) {
      request.uri = options.uri;
    } else {
      request.api = 'lyra';
      request.resource = `${space.url}/bindings`;
    }

    return this._bindConversation(spaceId)
      .then(() => this.webex.request(request))
      .then((res) => res.body);
  },

  /**
   * Binds a conversation to lyra space by posting capabilities to Lyra.
   *
   * Lyra no longer automatically enables binding for a space containing a device with type "SPARK_BOARD".
   * Webexboard now is running the CE code stack which supports posting of capabilities to Lyra.
   * @param {String} spaceId space ID
   * @returns {Promise<LyraBindings>} bindings response body
   */
  _bindConversation(spaceId) {
    // Skip until we can bind a conversation to lyra space by posting capabilities to Lyra.
    /* eslint no-unreachable: 1 */
    return Promise.resolve();

    // PUT /lyra/api/v1/spaces/{spaceId}/devices/{encodedDeviceUrl}/capabilities
    const encodedDeviceUrl = base64.encode(this.webex.internal.device.url);
    const resource = `spaces/${spaceId}/devices/${encodedDeviceUrl}/capabilities`;

    return this.webex.request({
      method: 'PUT',
      api: 'lyra',
      resource,
      body: {
        bindingCleanupAfterCall: true,
      },
    });
  },

  /**
   * Removes binding between a conversation and a lyra space using conversation
   * url
   * @param {Types~LyraSpace} space
   * @param {string} space.url
   * @param {string} space.id
   * @param {string} space.identity.id
   * @param {Types~Conversation} conversation
   * @param {string} conversation.kmsResourceObjectUrl
   * @param {string} conversation.url
   * @param {object} options
   * @param {boolean} options.uri complete lyra service URL
   * @returns {Promise<LyraBindings>} bindings response body
   */
  unbindConversation(space = {}, conversation = {}, options = {}) {
    const spaceId = space.id || (space.identity && space.identity.id);

    if (!space.url) {
      return Promise.reject(new Error('space.url is required'));
    }

    if (!spaceId) {
      return Promise.reject(new Error('space.id is required'));
    }

    if (!conversation.url) {
      return Promise.reject(new Error('conversation.url is required'));
    }

    if (!conversation.kmsResourceObjectUrl) {
      return Promise.reject(new Error('conversation.kmsResourceObjectUrl is required'));
    }

    const parameters = {
      kmsMessage: {
        method: 'delete',
        uri: `${conversation.kmsResourceObjectUrl}/authorizations?${querystring.stringify({
          authId: spaceId,
        })}`,
      },
      conversationUrl: base64.toBase64Url(conversation.url),
    };

    return this.webex.internal.encryption.kms.prepareRequest(parameters.kmsMessage).then((req) => {
      parameters.kmsMessage = req.wrapped;
      // if options.uri is available use it, since that would have the
      // complete lyra service URL
      if (options.uri) {
        return this.webex.request({
          method: 'DELETE',
          uri: `${options.uri}?${querystring.stringify(parameters)}`,
        });
      }

      return this.webex.request({
        method: 'DELETE',
        api: 'lyra',
        resource: `${space.url}/bindings?${querystring.stringify(parameters)}`,
      });
    });
  },

  /**
   * Delete a binding using binding id
   * @param {Types~LyraSpace} space
   * @param {string} space.url
   * @param {string} space.identity.id
   * @param {object} options
   * @param {string} options.kmsResourceObjectUrl
   * @param {string} options.bindingId
   * @returns {Promise<LyraBindings>} bindings response body
   */
  deleteBinding(space = {}, options = {}) {
    const spaceId = space.id || (space.identity && space.identity.id);

    if (!space.url) {
      return Promise.reject(new Error('space.url is required'));
    }

    if (!spaceId) {
      return Promise.reject(new Error('space.id is required'));
    }

    if (!options.kmsResourceObjectUrl) {
      return Promise.reject(new Error('options.kmsResourceObjectUrl is required'));
    }

    if (!options.bindingId) {
      return Promise.reject(new Error('options.bindingId is required'));
    }

    const parameters = {
      kmsMessage: {
        method: 'delete',
        uri: `${options.kmsResourceObjectUrl}/authorizations?${querystring.stringify({
          authId: spaceId,
        })}`,
      },
    };

    return this.webex.internal.encryption.kms.prepareRequest(parameters.kmsMessage).then((req) => {
      parameters.kmsMessage = req.wrapped;

      return this.webex.request({
        method: 'DELETE',
        uri: `${space.url}/bindings/${options.bindingId}?${querystring.stringify(parameters)}`,
      });
    });
  },
});

export default Space;
