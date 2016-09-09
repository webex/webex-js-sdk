/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {Context, Request, Response} from 'node-kms';
import KMSBatcher, {TIMEOUT_SYMBOL} from './kms-batcher';
import jose from 'node-jose';
import {omit} from 'lodash';

const contexts = new WeakMap();
const kmsDetails = new WeakMap();
const partialContexts = new WeakMap();

/**
 * @class
 */
const KMS = SparkPlugin.extend({
  namespace: `Encryption`,

  children: {
    batcher: KMSBatcher
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

    this.logger.info(`kms: binding key to resource`);

    /* istanbul ignore if */
    if (!kroUri) {
      return Promise.reject(new Error(`\`kro\` or \`kroUri\` is required`));
    }

    /* istanbul ignore if */
    if (!keyUri) {
      return Promise.reject(new Error(`\`key\` or \`keyUri\` is required`));
    }

    return this.request({
      method: `update`,
      resourceUri: kroUri,
      uri: keyUri
    })
      .then((res) => {
        this.logger.info(`kms: bound key to resource`);
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
      return Promise.reject(new Error(`Cannot create KMS Resource without at least one keyUri`));
    }

    this.logger.info(`kms: creating resource`);

    return this.request({
      method: `create`,
      uri: `/resources`,
      userIds,
      keyUris
    })
      .then((res) => {
        this.logger.info(`kms: created resource`);
        return res.resource;
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
      return Promise.reject(new Error(`\`options.count\` is required`));
    }

    return this.request({
      method: `create`,
      uri: `/keys`,
      count
    })
      .then((res) => {
        this.logger.info(`kms: received unbound keys`);
        return Promise.all(res.keys.map(this.asKey));
      });
  },

  /**
   * Fetches the specified key from the kms
   * @param {Object} options
   * @param {string} options.uri
   * @returns {Promise<Key>}
   */
  fetchKey({uri}) {
    /* istanbul ignore if */
    if (!uri) {
      return Promise.reject(new Error(`\`options.uri\` is required`));
    }

    this.logger.info(`kms: fetching key`);

    return this.request({
      method: `retrieve`,
      uri
    })
      .then((res) => {
        this.logger.info(`kms: fetched key`);
        return this.asKey(res.key);
      });
  },

  /**
   * Pings the kms. Mostly for testing
   * @returns {Promise}
   */
  ping() {
    return this.request({
      method: `update`,
      uri: `/ping`
    });
  },

  /**
   * Ensures a key obect is Key instance
   * @param {Object} key
   * @returns {Promise<Key>}
   */
  asKey(key) {
    return jose.JWK.asKey(key.jwk)
      .then((jwk) => {
        key.jwk = jwk;
        return key;
      });
  },

  /**
   * Adds appropriate metadata to the KMS request
   * @param {Object} payload
   * @returns {Promise<KMS.Request>}
   */
  prepareRequest(payload) {
    const isECDHRequest = payload.method === `create` && payload.uri.includes(`/ecdhe`);
    return Promise.resolve(isECDHRequest ? partialContexts.get(this) : this._getContext())
      .then((context) => {
        this.logger.info(`kms: wrapping ${isECDHRequest ? `ephemeral key` : `kms`} request`);
        const req = new Request(payload);
        return req.wrap(context, {serverKey: isECDHRequest})
          .then(() => {
            /* istanbul ignore else */
            if (process.env.NODE_ENV !== `production`) {
              this.logger.info(`kms: request payload`, omit(JSON.parse(JSON.stringify(req)), `wrapped`));
            }
            return req;
          });
      });
  },

  /**
   * Accepts a kms message event, decrypts it, and passes it to the batcher
   * @param {Object} event
   * @returns {Promise<Object>}
   */
  processKmsMessageEvent(event) {
    this.logger.info(`kms: received kms message`);
    return Promise.all(event.encryption.kmsMessages.map((kmsMessage, index) => this._isECDHEMessage(kmsMessage)
      .then((isECDHMessage) => {
        this.logger.info(`kms: received ${isECDHMessage ? `ecdhe` : `normal`} message`);
        const res = new Response(kmsMessage);
        return Promise.resolve(isECDHMessage ? partialContexts.get(this) : contexts.get(this))
          // eslint-disable-next-line max-nested-callbacks
          .then((context) => res.unwrap(context))
          // eslint-disable-next-line max-nested-callbacks
          .then(() => {event.encryption.kmsMessages[index] = res;})
          // eslint-disable-next-line max-nested-callbacks
          .then(() => res);
      })
    ))
      .then(() => this.batcher.processKmsMessageEvent(event))
      .catch((reason) => {
        this.logger.error(`kms: decrypt failed`, reason.stack);
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
    return contexts.get(this)
      .then((context) => res.unwrap(context))
      .then(() => res.body);
  },

  /**
   * Determines if the kms message is an ecdhe message or a normal message
   * @param {Object} kmsMessage
   * @returns {Promise<boolean>}
   */
  _isECDHEMessage(kmsMessage) {
    return this._getKMSStaticPubKey()
      .then((kmsStaticPubKey) => {
        const fields = kmsMessage.split(`.`);

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
   * @param {Number} timeout (internal)
   * @returns {Promise<Object>}
   */
  request(payload, timeout) {
    timeout = timeout || this.config.kmsInitialTimeout;

    // Note: this should only happen when we're using the async kms batcher;
    // once we implement the sync batcher, this'll need to be smarter.
    return this.spark.mercury.connect()
      .then(() => this.prepareRequest(payload))
      .then((req) => {
        req[TIMEOUT_SYMBOL] = timeout;
        return this.batcher.request(req);
      })
      .catch((reason) => {
        // Ideally, most or all of the code below would go in kms-batcher, but
        // but batching needs at least one more round of refactoring for that to
        // work.
        if (!reason.statusCode && !reason.status) {
          /* istanbul ignore else */
          if (process.env.NODE_ENV !== `production`) {
            /* istanbul ignore next: reason.stack vs stack difficult to control in test */
            this.logger.info(`kms: request error`, reason.stack || reason);
          }

          timeout = timeout * 2;

          if (timeout >= this.config.kmsMaxTimeout) {
            this.logger.info(`kms: exceeded maximum KMS request retries; negotiating new ecdh key`);

            /* istanbul ignore else */
            if (process.env.NODE_ENV !== `production`) {
              this.logger.info(`kms: timeout/maxtimeout`, timeout, this.config.kmsMaxTimeout);
            }

            contexts.delete(this);
            timeout = 0;
          }

          return this.request(payload, timeout);
        }

        return Promise.reject(reason);
      });
  },

  /**
   * @private
   * @returns {Promise<string>}
   */
  _getAuthorization() {
    // Remove the `Bearer` prefix from the token; we'll improve this when we add
    // token downscoping.
    return this.spark.credentials.getAuthorization()
      .then((authorization) => authorization.replace(/[Bb]earer\s+/, ``));
  },

  /**
   * @private
   * @returns {Promise<Object>}
   */
  _getContext() {
    let promise = contexts.get(this);
    if (!promise) {
      promise = this._prepareContext();
      contexts.set(this, promise);
      promise.then((context) => {
        const expiresIn = context.ephemeralKey.expirationDate - Date.now() - 30000;
        setTimeout(() => contexts.unset(this), expiresIn);
      });
    }

    return Promise.all([
      promise,
      this._getAuthorization()
    ])
      .then(([context, authorization]) => {
        context.clientInfo.credential.bearer = authorization;
        return context;
      });
  },

  /**
   * @private
   * @returns {Promise<Object>}
   */
  _getKMSCluster() {
    this.logger.info(`kms: retrieving KMS cluster`);
    return this._getKMSDetails()
      .then(({kmsCluster}) => kmsCluster);
  },

  /**
   * @private
   * @returns {Promise<Object>}
   */
  _getKMSDetails() {
    let details = kmsDetails.get(this);
    if (!details) {
      this.logger.info(`kms: fetching KMS details`);
      details = this.spark.request({
        service: `encryption`,
        resource: `/kms/${this.spark.device.userId}`
      })
        .then((res) => {
          this.logger.info(`kms: fetched KMS details`);
          const body = res.body;
          body.rsaPublicKey = JSON.parse(body.rsaPublicKey);
          return body;
        })
        .catch((reason) => {
          this.logger.error(`kms: failed to fetch KMS details`, reason);
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
    this.logger.info(`kms: retrieving KMS static public key`);
    return this._getKMSDetails()
      .then(({rsaPublicKey}) => rsaPublicKey);
  },

  /**
   * @private
   * @returns {Promise<Object>}
   */
  _prepareContext() {
    this.logger.info(`kms: creating context`);
    const context = new Context();

    return Promise.all([
      this._getKMSStaticPubKey(),
      this._getAuthorization()
    ])
      .then(([kmsStaticPubKey, authorization]) => {
        context.clientInfo = {
          clientId: this.spark.device.url,
          credential: {
            userId: this.spark.device.userId,
            bearer: authorization
          }
        };

        context.serverInfo = {
          key: kmsStaticPubKey
        };

        this.logger.info(`kms: creating local ephemeral key`);
        return context.createECDHKey();
      })
      .then((localECDHKey) => {
        context.ephemeralKey = localECDHKey;
        partialContexts.set(this, context);
        return Promise.all([localECDHKey.asKey(), this._getKMSCluster()]);
      })
      .then(([localECDHKey, cluster]) => {
        this.logger.info(`kms: submitting ephemeral key request`);
        return this.request({
          uri: `${cluster}/ecdhe`,
          method: `create`,
          jwk: localECDHKey.toJSON()
        });
      })
      .then((res) => {
        this.logger.info(`kms: deriving final ephemeral key`);
        return context.deriveEphemeralKey(res.key);
      })
      .then((key) => {
        context.ephemeralKey = key;
        partialContexts.delete(this);
        this.logger.info(`kms: derived final ephemeral key`);
        return context;
      })
      .catch((reason) => {
        this.logger.error(`kms: failed to negotiate ephemeral key`, reason);
        return Promise.reject(reason);
      });
  }
});

export default KMS;
