/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import querystring from 'querystring';
import util from 'util';

import {safeSetTimeout} from '@webex/common-timers';
import {oneFlight} from '@webex/common';
import {WebexPlugin} from '@webex/webex-core';
import {Context, Request, Response} from 'node-kms';
import jose from 'node-jose';
import {omit} from 'lodash';
import uuid from 'uuid';

import KMSBatcher, {TIMEOUT_SYMBOL} from './kms-batcher';
import validateKMS, {KMSError} from './kms-certificate-validation';

const contexts = new WeakMap();
const kmsDetails = new WeakMap();
const partialContexts = new WeakMap();

const consoleDebug = require('debug')('kms');

/**
 * @class
 */
const KMS = WebexPlugin.extend({
  namespace: 'Encryption',

  children: {
    batcher: KMSBatcher,
  },

  /**
   * Binds a key to a resource
   * @param {Object} options
   * @param {KMSResourceObject} options.kro
   * @param {string} options.kroUri
   * @param {Key} options.key
   * @param {string} options.keyUri
   * @returns {Promise<Key>}
   */
  bindKey({kro, kroUri, key, keyUri}) {
    kroUri = kroUri || kro.uri;
    keyUri = keyUri || key.uri;

    this.logger.info('kms: binding key to resource');

    /* istanbul ignore if */
    if (!kroUri) {
      return Promise.reject(new Error('`kro` or `kroUri` is required'));
    }

    /* istanbul ignore if */
    if (!keyUri) {
      return Promise.reject(new Error('`key` or `keyUri` is required'));
    }

    return this.request({
      method: 'update',
      resourceUri: kroUri,
      uri: keyUri,
    }).then((res) => {
      this.logger.info('kms: bound key to resource');

      return res.key;
    });
  },

  /**
   * Creates a new KMS Resource
   * @param {Object} options
   * @param {Array<string>} options.userIds
   * @param {Array<string>} options.keyUris
   * @param {Key} options.key
   * @param {Array<Keys>} options.keys
   * @returns {Promise<KMSResourceObject>}
   */
  createResource({userIds, keyUris, key, keys}) {
    keyUris = keyUris || [];
    /* istanbul ignore if */
    if (keys) {
      keyUris = keys.reduce((uris, k) => {
        uris.push(k.uri);

        return uris;
      }, keyUris);
    }

    /* istanbul ignore else */
    if (key) {
      keyUris.push(key.uri);
    }

    /* istanbul ignore if */
    if (keyUris.length === 0) {
      return Promise.reject(new Error('Cannot create KMS Resource without at least one keyUri'));
    }

    this.logger.info('kms: creating resource');

    return this.request({
      method: 'create',
      uri: '/resources',
      userIds,
      keyUris,
    }).then((res) => {
      this.logger.info('kms: created resource');

      return res.resource;
    });
  },

  /**
   * Authorizes a user or KRO to a KRO
   * @param {Object} options
   * @param {Array<string>} options.userIds
   * @param {Array<string>} options.authIds interchangable with userIds
   * @param {KMSResourceObject} options.kro the target kro
   * @param {string} options.kroUri
   * @returns {Promise<KMSAuthorizationObject>}
   */
  addAuthorization({userIds, authIds, kro, kroUri}) {
    userIds = userIds || [];
    kroUri = kroUri || kro.uri;

    if (authIds) {
      userIds = userIds.concat(authIds);
    }

    /* istanbul ignore if */
    if (userIds.length === 0) {
      return Promise.reject(new Error('Cannot add authorization without userIds or authIds'));
    }

    /* istanbul ignore if */
    if (!kroUri) {
      return Promise.reject(new Error('`kro` or `kroUri` is required'));
    }

    this.logger.info('kms: adding authorization to kms resource');

    return this.request({
      method: 'create',
      uri: '/authorizations',
      resourceUri: kroUri,
      userIds,
    }).then((res) => {
      this.logger.info('kms: added authorization');

      return res.authorizations;
    });
  },

  /**
   * Retrieve a list of users that have been authorized to the KRO
   * @param {Object} options
   * @param {KMSResourceObject} options.kro the target kro
   * @param {string} options.kroUri
   * @returns {Array<authId>}
   */
  listAuthorizations({kro, kroUri}) {
    kroUri = kroUri || kro.uri;
    /* istanbul ignore if */
    if (!kroUri) {
      return Promise.reject(new Error('`kro` or `kroUri` is required'));
    }

    return this.request({
      method: 'retrieve',
      uri: `${kroUri}/authorizations`,
    }).then((res) => {
      this.logger.info('kms: retrieved authorization list');

      return res.authorizations;
    });
  },

  /**
   * Deauthorizes a user or KRO from a KRO
   * @param {Object} options
   * @param {string} options.userId
   * @param {string} options.authId interchangable with userIds
   * @param {KMSResourceObject} options.kro the target kro
   * @param {string} options.kroUri
   * @returns {Promise<KMSAuthorizationObject>}
   */
  removeAuthorization({authId, userId, kro, kroUri}) {
    authId = authId || userId;
    kroUri = kroUri || kro.uri;

    /* istanbul ignore if */
    if (!authId) {
      return Promise.reject(new Error('Cannot remove authorization without authId'));
    }

    /* istanbul ignore if */
    if (!kroUri) {
      return Promise.reject(new Error('`kro` or `kroUri` is required'));
    }

    this.logger.info('kms: removing authorization from kms resource');

    return this.request({
      method: 'delete',
      uri: `${kroUri}/authorizations?${querystring.stringify({authId})}`,
    }).then((res) => {
      this.logger.info('kms: removed authorization');

      return res.authorizations;
    });
  },

  /**
   * Requests `count` unbound keys from the kms
   * @param {Object} options
   * @param {Number} options.count
   * @returns {Array<Key>}
   */
  createUnboundKeys({count}) {
    this.logger.info(`kms: request ${count} unbound keys`);

    /* istanbul ignore if */
    if (!count) {
      return Promise.reject(new Error('`options.count` is required'));
    }

    return this.request({
      method: 'create',
      uri: '/keys',
      count,
    }).then((res) => {
      this.logger.info('kms: received unbound keys');

      return Promise.all(res.keys.map(this.asKey));
    });
  },

  /**
   * @typedef {Object} FetchPublicKeyResponse
   * @property {number} status 200,400(Bad Request: Request payload missing info),404(Not Found: HSM Public Key not found),501(Not Implemented: This KMS does not support BYOK),502(Bad Gateway: KMS could not communicate with HSM)
   * @property {UUID} requestId this is should be unique, used for debug.
   * @property {string} publicKey
   */
  /**
   * get public key from kms
   * @param {Object} options
   * @param {UUID} options.assignedOrgId the orgId
   * @returns {Promise.<FetchPublicKeyResponse>} response of get public key api
   */
  fetchPublicKey({assignedOrgId}) {
    this.logger.info('kms: fetch public key for byok');

    return this.request({
      method: 'retrieve',
      uri: '/publicKey',
      assignedOrgId,
    }).then((res) => {
      this.logger.info('kms: received public key');

      return res.publicKey;
    });
  },

  /**
   * @typedef {Object} UploadCmkResponse
   * @property {number} status
   * @property {UUID} requestId
   * @property {string} uri
   * @property {string} keysState
   */
  /**
   * upload master key for one org.
   * @param {Object} options
   * @param {UUID} options.assignedOrgId the orgId
   * @param {string} options.customerMasterKey the master key
   * @param {boolean} options.awsKms enable amazon aws keys
   * @returns {Promise.<UploadCmkResponse>} response of upload CMK api
   */
  uploadCustomerMasterKey({assignedOrgId, customerMasterKey, awsKms = false}) {
    this.logger.info('kms: upload customer master key for byok');

    return this.request({
      method: 'create',
      uri: awsKms ? '/awsKmsCmk' : '/cmk',
      assignedOrgId,
      customerMasterKey,
      requestId: uuid.v4(),
    }).then((res) => {
      this.logger.info('kms: finish to upload customer master key');

      return res;
    });
  },

  /**
   * get all customer master keys for one org.
   * @param {Object} options
   * @param {UUID} options.assignedOrgId the orgId
   * @param {boolean} options.awsKms enable amazon aws keys
   * @returns {Promise.<ActivateCmkResponse>} response of list CMKs api
   */
  listAllCustomerMasterKey({assignedOrgId, awsKms = false}) {
    this.logger.info('kms: get all customer master keys for byok');

    return this.request({
      method: 'retrieve',
      uri: awsKms ? '/awsKmsCmk' : '/cmk',
      assignedOrgId,
      requestId: uuid.v4(),
    }).then((res) => {
      this.logger.info('kms: finish to get all customer master keys');

      return res;
    });
  },

  /**
   * @typedef {Object} ActivateCmkResponse
   * @property {number} status
   * @property {UUID} requestId
   * @property {Array<CMK>} customerMasterKeys
   */
  /**
   *
   * @typedef {Object} CMK
   * @property {string} usageState
   * @property {UUID} assignedOrgId
   * @property {string} uri
   * @property {string} source
   * @property {Date | undefined} stateUpdatedOn
   * @property {Date | undefined} rotation
   */
  /**
   * change one customer master key state for one org.
   * delete pending key, then the keyState should be 'removedclean';
   * active pending key, then the keyState should be 'active';
   *
   * @param {Object} options
   * @param {string} options.keyId the id of one customer master key, it should be a url
   * @param {string} options.keyState one of the following: PENDING, RECOVERING,ACTIVE,REVOKED,DEACTIVATED,REENCRYPTING,RETIRED,DELETED,DISABLED,REMOVEDCLEAN,REMOVEDDIRTY;
   * @param {UUID} options.assignedOrgId the orgId
   * @returns {Promise.<ActivateCmkResponse>} response of list CMKs api
   */
  changeCustomerMasterKeyState({keyId, keyState, assignedOrgId}) {
    this.logger.info('kms: change one customer master key state for byok');

    return this.request({
      method: 'update',
      uri: keyId,
      keyState,
      assignedOrgId,
      requestId: uuid.v4(),
    }).then((res) => {
      this.logger.info('kms: finish to change the customer master key state to {}', keyState);

      return res;
    });
  },

  /**
   * this is for test case. it will delete all CMKs, no matter what their status is. This is mainly for test purpose
   * @param {Object} options
   * @param {UUID} options.assignedOrgId the orgId
   * @param {boolean} options.awsKms enable amazon aws keys
   * @returns {Promise.<{status, requestId}>}
   */
  deleteAllCustomerMasterKeys({assignedOrgId, awsKms = false}) {
    this.logger.info('kms: delete all customer master keys at the same time');

    return this.request({
      method: 'delete',
      uri: awsKms ? '/awsKmsCmk' : '/cmk',
      assignedOrgId,
      requestId: uuid.v4(),
    }).then((res) => {
      this.logger.info('kms: finish to delete all customer master keys');

      return res;
    });
  },

  /**
   * return to use global master key for one org.
   * @param {Object} options
   * @param {UUID} options.assignedOrgId the orgId
   * @returns {Promise.<ActivateCmkResponse>} response of activate CMK api
   */
  useGlobalMasterKey({assignedOrgId}) {
    this.logger.info('kms: return to use global master key');

    return this.request({
      method: 'update',
      uri: 'default',
      keyState: 'ACTIVE',
      assignedOrgId,
      requestId: uuid.v4(),
    }).then((res) => {
      this.logger.info('kms: finish to return to global master key');

      return res;
    });
  },

  /**
   * Fetches the specified key from the kms
   * @param {Object} options
   * @param {string} options.uri
   * @param {string} options.onBehalfOf The id of a user, upon whose behalf, the key is to be retrieved or undefined if retrieval is for the active user
   * @returns {Promise<Key>}
   */
  // Ideally, this would be done via the kms batcher, but other than request id,
  // there isn't any other userful key in a kms response to match it to a
  // request. as such, we need the batcher to group requests, but one flight to
  // make sure we don't make the same request multiple times.
  @oneFlight({
    keyFactory: ({uri, onBehalfOf}) => `${uri}/${onBehalfOf}`,
  })
  fetchKey({uri, onBehalfOf}) {
    /* istanbul ignore if */
    if (!uri) {
      return Promise.reject(new Error('`options.uri` is required'));
    }

    this.logger.info('kms: fetching key');

    return this.request(
      {
        method: 'retrieve',
        uri,
      },
      {onBehalfOf}
    ).then((res) => {
      this.logger.info('kms: fetched key');

      return this.asKey(res.key);
    });
  },

  /**
   * Pings the kms. Mostly for testing
   * @returns {Promise}
   */
  ping() {
    return this.request({
      method: 'update',
      uri: '/ping',
    });
  },

  /**
   * Ensures a key obect is Key instance
   * @param {Object} key
   * @returns {Promise<Key>}
   */
  asKey(key) {
    return jose.JWK.asKey(key.jwk).then((jwk) => {
      key.jwk = jwk;

      return key;
    });
  },

  /**
   * Adds appropriate metadata to the KMS request
   * @param {Object} payload
   * @param {Object} onBehalfOf Optional parameter to prepare the request on behalf of another user
   * @returns {Promise<KMS.Request>}
   */
  prepareRequest(payload, onBehalfOf) {
    const isECDHRequest = payload.method === 'create' && payload.uri.includes('/ecdhe');

    return Promise.resolve(isECDHRequest ? partialContexts.get(this) : this._getContext()).then(
      (context) => {
        this.logger.info(`kms: wrapping ${isECDHRequest ? 'ephemeral key' : 'kms'} request`);
        const req = new Request(payload);
        let requestContext = context;

        if (onBehalfOf) {
          requestContext = this._contextOnBehalfOf(context, onBehalfOf);
        }

        return req.wrap(requestContext, {serverKey: isECDHRequest}).then(() => {
          /* istanbul ignore else */
          if (process.env.NODE_ENV !== 'production') {
            this.logger.info(
              'kms: request payload',
              util.inspect(omit(JSON.parse(JSON.stringify(req)), 'wrapped'), {depth: null})
            );
          }

          return req;
        });
      }
    );
  },

  /**
   * Accepts a kms message event, decrypts it, and passes it to the batcher
   * @param {Object} event
   * @returns {Promise<Object>}
   */
  processKmsMessageEvent(event) {
    this.logger.info('kms: received kms message');

    return Promise.all(
      event.encryption.kmsMessages.map((kmsMessage, index) =>
        this._isECDHEMessage(kmsMessage).then((isECDHMessage) => {
          this.logger.info(`kms: received ${isECDHMessage ? 'ecdhe' : 'normal'} message`);
          const res = new Response(kmsMessage);

          return (
            Promise.resolve(isECDHMessage ? partialContexts.get(this) : contexts.get(this))
              // eslint-disable-next-line max-nested-callbacks
              .then((context) => res.unwrap(context))
              // eslint-disable-next-line max-nested-callbacks
              .then(() => {
                if (process.env.NODE_ENV !== 'production') {
                  this.logger.info(
                    'kms: response payload',
                    util.inspect(omit(JSON.parse(JSON.stringify(res)), 'wrapped'), {depth: null})
                  );
                }
              })
              // eslint-disable-next-line max-nested-callbacks
              .then(() => {
                event.encryption.kmsMessages[index] = res;
              })
              // eslint-disable-next-line max-nested-callbacks
              .then(() => res)
          );
        })
      )
    )
      .then(() => this.batcher.processKmsMessageEvent(event))
      .catch((reason) => {
        this.logger.error('kms: decrypt failed', reason.stack);

        return Promise.reject(reason);
      })
      .then(() => event);
  },

  /**
   * Decrypts a kms message
   * @param {Object} kmsMessage
   * @returns {Promise<Object>}
   */
  decryptKmsMessage(kmsMessage) {
    const res = new Response(kmsMessage);

    return contexts
      .get(this)
      .then((context) => res.unwrap(context))
      .then(() => res.body);
  },

  /**
   * Determines if the kms message is an ecdhe message or a normal message
   * @param {Object} kmsMessage
   * @returns {Promise<boolean>}
   */
  _isECDHEMessage(kmsMessage) {
    return this._getKMSStaticPubKey().then((kmsStaticPubKey) => {
      const fields = kmsMessage.split('.');

      if (fields.length !== 3) {
        return false;
      }

      const header = JSON.parse(jose.util.base64url.decode(fields[0]));

      return header.kid === kmsStaticPubKey.kid;
    });
  },

  /**
   * Sends a request to the kms
   * @param {Object} payload
   * @param {Object} options
   * @param {Number} options.timeout (internal)
   * @param {string} options.onBehalfOf Run the request on behalf of another user (UUID), used in compliance scenarios
   * @returns {Promise<Object>}
   */
  request(payload, {timeout, onBehalfOf} = {}) {
    timeout = timeout || this.config.kmsInitialTimeout;

    // Note: this should only happen when we're using the async kms batcher;
    // once we implement the sync batcher, this'll need to be smarter.
    return (
      this.webex.internal.mercury
        .connect()
        .then(() => this.prepareRequest(payload, onBehalfOf))
        .then((req) => {
          req[TIMEOUT_SYMBOL] = timeout;

          return this.batcher.request(req);
        })
        // High complexity is due to attempt at test mode resiliency
        // eslint-disable-next-line complexity
        .catch((reason) => {
          if (
            process.env.NODE_ENV === 'test' &&
            (reason.status === 403 || reason.statusCode === 403) &&
            reason.message.match(
              /Failed to resolve authorization token in KmsMessage request for user/
            )
          ) {
            this.logger.warn('kms: rerequested key due to test-mode kms auth failure');

            return this.request(payload, {onBehalfOf});
          }

          // KMS Error. Notify the user
          if (reason instanceof KMSError) {
            this.webex.trigger('client:InvalidRequestError');

            return Promise.reject(reason);
          }

          // Ideally, most or all of the code below would go in kms-batcher, but
          // but batching needs at least one more round of refactoring for that to
          // work.
          if (!reason.statusCode && !reason.status) {
            /* istanbul ignore else */
            if (process.env.NODE_ENV !== 'production') {
              /* istanbul ignore next: reason.stack vs stack difficult to control in test */
              this.logger.info('kms: request error', reason.stack || reason);
            }

            consoleDebug(`timeout ${timeout}`);
            timeout *= 2;

            if (timeout >= this.config.ecdhMaxTimeout) {
              this.logger.info('kms: exceeded maximum KMS request retries');

              return Promise.reject(reason);
            }

            // Peek ahead to make sure we don't reset the timeout if the next timeout
            // will exceed the maximum timeout for renegotiating ECDH keys.
            const nextTimeout = timeout * 2;

            if (timeout >= this.config.kmsMaxTimeout && nextTimeout < this.config.ecdhMaxTimeout) {
              this.logger.info(
                'kms: exceeded maximum KMS request retries; negotiating new ecdh key'
              );

              /* istanbul ignore else */
              if (process.env.NODE_ENV !== 'production') {
                this.logger.info('kms: timeout/maxtimeout', timeout, this.config.kmsMaxTimeout);
              }

              contexts.delete(this);
              timeout = 0;
            }

            return this.request(payload, {timeout, onBehalfOf});
          }

          return Promise.reject(reason);
        })
    );
  },

  /**
   * @private
   * @returns {Promise<string>}
   */
  _getAuthorization() {
    return this.webex.credentials.getUserToken('spark:kms').then((token) => token.access_token);
  },

  @oneFlight
  /**
   * @private
   * @param {String} onBehalfOf create context on behalf of another user, undefined when this is not necessary
   * @returns {Promise<Object>}
   */
  _getContext() {
    let promise = contexts.get(this);

    if (!promise) {
      promise = this._prepareContext();
      contexts.set(this, promise);
      promise.then((context) => {
        const expiresIn = context.ephemeralKey.expirationDate - Date.now() - 30000;

        safeSetTimeout(() => contexts.delete(this), expiresIn);
      });
    }

    return Promise.all([promise, this._getAuthorization()]).then(([context, authorization]) => {
      context.clientInfo.credential.bearer = authorization;

      return context;
    });
  },

  /**
   * @private
   * @returns {Promise<Object>}
   */
  _getKMSCluster() {
    this.logger.info('kms: retrieving KMS cluster');

    return this._getKMSDetails().then(({kmsCluster}) => kmsCluster);
  },

  /**
   * @private
   * @returns {Promise<Object>}
   */
  _getKMSDetails() {
    let details = kmsDetails.get(this);

    if (!details) {
      this.logger.info('kms: fetching KMS details');
      details = this.webex
        .request({
          service: 'encryption',
          resource: `/kms/${this.webex.internal.device.userId}`,
        })
        .then((res) => {
          this.logger.info('kms: fetched KMS details');
          const {body} = res;

          body.rsaPublicKey = JSON.parse(body.rsaPublicKey);

          return body;
        })
        .catch((reason) => {
          this.logger.error('kms: failed to fetch KMS details', reason);

          return Promise.reject(reason);
        });

      kmsDetails.set(this, details);
    }

    return details;
  },

  /**
   * @private
   * @returns {Promise<Object>}
   */
  _getKMSStaticPubKey() {
    this.logger.info('kms: retrieving KMS static public key');

    return this._getKMSDetails().then(({rsaPublicKey}) => rsaPublicKey);
  },

  /**
   * @private
   * @returns {Promise<Object>}
   */
  _prepareContext() {
    this.logger.info('kms: creating context');
    const context = new Context();

    return Promise.all([
      this._getKMSStaticPubKey().then(validateKMS(this.config.caroots)),
      this._getAuthorization(),
    ])
      .then(([kmsStaticPubKey, authorization]) => {
        context.clientInfo = {
          clientId: this.webex.internal.device.url,
          credential: {
            userId: this.webex.internal.device.userId,
            bearer: authorization,
          },
        };

        context.serverInfo = {
          key: kmsStaticPubKey,
        };

        this.logger.info('kms: creating local ephemeral key');

        return context.createECDHKey();
      })
      .then((localECDHKey) => {
        context.ephemeralKey = localECDHKey;
        partialContexts.set(this, context);

        return Promise.all([localECDHKey.asKey(), this._getKMSCluster()]);
      })
      .then(([localECDHKey, cluster]) => {
        this.logger.info('kms: submitting ephemeral key request');

        return this.request({
          uri: `${cluster}/ecdhe`,
          method: 'create',
          jwk: localECDHKey.toJSON(),
        });
      })
      .then((res) => {
        this.logger.info('kms: deriving final ephemeral key');

        return context.deriveEphemeralKey(res.key);
      })
      .then((key) => {
        context.ephemeralKey = key;
        partialContexts.delete(this);
        this.logger.info('kms: derived final ephemeral key');

        return context;
      })
      .catch((reason) => {
        this.logger.error('kms: failed to negotiate ephemeral key', reason);

        return Promise.reject(reason);
      });
  },

  /**
   * KMS 'retrieve' requests can be made on behalf of another user. This is useful
   * for scenarios such as eDiscovery. i.e. Where an authorized compliance officer is
   * entitled to retrieve content generated by any organisational user.
   * As the KMSContext is cached, updating it will affect separate requests. Hence when
   * making a request onBehalfOf another user create a new context for just this request.
   * However this context will be 'light' as it only needs to change one field.
   * @param {Object} originalContext - The base context to 'copy'
   * @param {String} onBehalfOf - The user specified in the new context
   * @returns {Context} A 'copy' of the existing context with a new user specified
   * @private
   */
  _contextOnBehalfOf(originalContext, onBehalfOf) {
    const context = new Context();

    context.clientInfo = context.clientInfo = {
      clientId: originalContext.clientInfo.clientId,
      credential: {
        userId: onBehalfOf,
        onBehalfOf, // Supports running onBehalfOf self. i.e. A CO which calls onBehalfOf with CO.id.
        bearer: originalContext.clientInfo.credential.bearer,
      },
    };
    context.serverInfo = originalContext.serverInfo;
    context.ephemeralKey = originalContext.ephemeralKey;

    return context;
  },
});

export default KMS;
