/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var base64 = require('../../../../util/base64');
var jose = require('node-jose');
var kms = require('node-kms');
var KmsRequestBatcher = require('./kms-request-batcher');
var oneFlight = require('../../../../util/one-flight');
var resolveWith = require('../../../../util/resolve-with');
var SparkBase = require('../../../../lib/spark-base');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Encryption
 */
var KMS = SparkBase.extend(
  /** @lends Encryption.KMS.prototype */
  {
  children: {
    _batcher: KmsRequestBatcher
  },

  namespace: 'Encryption',

  decryptKmsMessage: function decryptKmsMessage(kmsMessage) {
    return this._decryptNormalMessage(kmsMessage)
      .then(function resolveWithBody(res) {
        return res.body;
      });
  },

  _decryptECDHMessage: function _decryptECDHMessage(kmsMessage) {
    var res = new kms.Response(kmsMessage);
    return res.unwrap(this._partialContext)
      .then(resolveWith(res));
  },

  _decryptNormalMessage: function _decryptNormalMessage(kmsMessage) {
    var res = new kms.Response(kmsMessage);
    return this._getContext()
      .then(function unwrap(context) {
        return res.unwrap(context);
      })
      .then(resolveWith(res));
  },

  _isECDHEMessage: function _isECDHEMessage(kmsMessage) {
    return this._getKMSStaticPubKey()
      .then(function withKmsStaticPubKey(kmsStaticPubKey) {
        var fields = kmsMessage.split('.');

        // ECDHE messages are known to have only three fields
        if (fields.length !== 3) {
          return false;
        }

        var header = JSON.parse(jose.util.base64url.decode(fields[0]));

        return header.kid === kmsStaticPubKey.kid;
      });
  },

  processKmsMessageEvent: function processKmsMessageEvent(event) {
    this.logger.debug('kms: received kms message');
    this.logger.debug('kms: partial context available', !!this._partialContext);

    return Promise.all(event.encryption.kmsMessages.map(unwrap, this))
      .then(function delegateEventProcessing() {
        return this._batcher.processKmsMessageEvent(event);
      }.bind(this))
      .catch(function logKmsError(reason) {
        this.logger.error('kms: decrypt failed', reason);
        throw reason;
      }.bind(this))
      .then(resolveWith(event));

    function unwrap(kmsMessage, index) {
      return this._isECDHEMessage(kmsMessage)
        .then(function chooseDecryptionPath(isECDHMessage) {
          if (isECDHMessage) {
            this.logger.info('kms: received ecdhe message');
            return this._decryptECDHMessage(kmsMessage);
          }

          this.logger.info('kms: received normal kms message');
          return this._decryptNormalMessage(kmsMessage);
        }.bind(this))
        .then(function assignUnwrappedResponse(res) {
          if (process.env.NODE_ENV !== 'production') {
            this.logger.debug('kms: kms response', JSON.stringify(res.body, null, 2));
          }
          event.encryption.kmsMessages[index] = res;
        }.bind(this));
    }
  },

  prepareRequest: function prepareRequest(payload) {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug('kms: request payload', payload);
    }

    if (payload.method === 'create' && payload.uri.indexOf('/ecdhe') !== -1) {
      return this._prepareECDHERequest(payload);
    }

    return this._getContext()
      .then(function prepare(context) {
        var req = new kms.Request(payload);
        return req.wrap(context)
          .then(resolveWith(req));
      });
  },

  request: function request(req, timeout) {
    timeout = timeout || this.config.kmsInitialTimeout;

    return this._batcher.fetch(req, timeout)
      .catch(function processFailure(res) {
        if (!res.statusCode && !res.status) {
          /* istanbul ignore else */
          if (process.env.NODE_ENV === 'test') {
            this.logger.debug('kms: request error', res.stack || res);
          }
          timeout *= 2;

          if (timeout >= this.config.kmsMaxTimeout) {
            this.logger.info('kms: exceeded maximum KMS request retries; retrieving new ephemeral key');
            /* istanbul ignore else */
            if (process.env.NODE_ENV === 'test') {
              this.logger.debug('kms: timeout/maxtimeout', timeout, this.config.kmsMaxTimeout);
            }
            delete this._context;
            timeout = 0;
          }

          return this.prepareRequest(req.body)
            .then(function sendRequest(req) {
              return this.request(req, timeout);
            }.bind(this));
        }

        return Promise.reject(res);
      }.bind(this));
  },

  _prepareECDHERequest: function _prepareECDHERequest(body) {
    var req = new kms.Request(body);

    this.logger.info('kms: wrapping ephemeral key request');
    return Promise.resolve(this._partialContext || this._context)
      .then(function wrap(context) {
        return req.wrap(context, {serverKey: true});
      }.bind(this))
      .then(resolveWith(req));
  },

  _prepareContext: oneFlight('_prepareContext', function _prepareContext() {
    this.logger.info('kms: creating context');

    var context = new kms.Context();

    return Promise.all([
      this._getKMSStaticPubKey(),
      this._getAuthorization()
    ])
      .then(function prepareContext(results) {
        var kmsStaticPubKey = results[0];
        var authorization = results[1];

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

        this.logger.info('kms: creating local ephemeralKey');
        return context.createECDHKey();
      }.bind(this))
      .then(function processLocalECDHKey(localECDHKey) {
        context.ephemeralKey = localECDHKey;
        this._partialContext = context;

        return localECDHKey.asKey();
      }.bind(this))
      .then(function prepareServerECDHRequest(localECDHKey) {
        return this._getKMSCluster()
          .then(function setCluster(cluster) {
            return this._prepareECDHERequest({
              uri: cluster + '/ecdhe',
              method: 'create',
              jwk: localECDHKey.toJSON()
            });
          }.bind(this));
      }.bind(this))
      .then(function enqueueServerECDHRequest(req) {
        this.logger.info('kms: submitting ephemeral key request');
        return this.request(req);
      }.bind(this))
      .then(function deriveEphemeralKey(res) {
        this.logger.info('kms: deriving final ephemeralKey');
        return context.deriveEphemeralKey(res.key);
      }.bind(this))
      .then(function storeEphemeralKey(ecdh) {
        context.ephemeralKey = ecdh;
        delete this._partialContext;
        this.logger.info('kms: derived final ephemeralKey');
        return context;
      }.bind(this))
      .catch(function logError(reason) {
        // TODO fail all outstanding KMS requests
        this.logger.error('kms: failed to retrieve ephemeralKey', reason);
        throw reason;
      }.bind(this));
  }),

  _getAuthorization: function _getAuthorization() {
    // Remove the "Bearer " string from the auth token. We'll do this better
    // once CI's endpoint for downscoping a token is finished.
    return this.spark.credentials.getAuthorization('spark:kms')
      .then(function removeTokenType(header) {
        return header.replace(/[bB]earer\s?/, '');
      });
  },

  _getContext: function _getContext(options) {
    options = options || {};
    if (options.force || !this._context) {
      this._context = this._prepareContext();

      this._context.then(function setExpiration(context) {
        // Subtract an extra 30 seconds to account for drift
        var expiresIn = context.ephemeralKey.expirationDate - (new Date()) - 30000;
        setTimeout(function func() {
          delete this._context;
        }.bind(this), expiresIn);

      }.bind(this));
    }

    return Promise.all([
      this._context,
      this._getAuthorization()
    ])
      .then(function updateCredential(args) {
        var context = args[0];
        var auth = args[1];
        context.clientInfo.credential.bearer = auth;
        return context;
      });
  },

  _getKMSDetails: function _getKMSDetails() {
    if (this._kmsDetails) {
      return Promise.resolve(this._kmsDetails);
    }

    return this.spark.request({
      api: 'encryption',
      resource: '/kms/' + this.spark.device.userId
    })
      .then(function resolveWithBody(res) {
        this._kmsDetails = res.body;
        this._kmsDetails.rsaPublicKey = JSON.parse(this._kmsDetails.rsaPublicKey);
        return this._kmsDetails;
      }.bind(this));
  },

  _getKMSCluster: function _getKMSCluster() {
    return this._getKMSDetails()
      .then(function getCluster(details) {
        return details.kmsCluster;
      });
  },

  _getKMSStaticPubKey: function _getKMSStaticPubKey() {
    return this._getKMSDetails()
      .then(function getStaticKey(details) {
        return details.rsaPublicKey;
      });
  },

  /**
   * Get unused keys from the KMS for encrypting new activities
   * @param {Object} options
   * @param {integer} options.count
   * @todo move to {Encryption.EncryptionService}
   */
  createUnboundKeys: function createUnboundKeys(options) {
    options = options || {};
    if (!options.count) {
      return Promise.reject(new Error('`options.count` is required'));
    }

    this.logger.info('kms: requesting unbound keys');
    return this.prepareRequest({
      method: 'create',
      uri: '/keys',
      count: options.count
    })
      .then(this.request.bind(this))
      .then(function processResponse(res) {
        this.logger.info('kms: received unbound keys');
        return Promise.all(res.keys.map(this._asKey, this));
      }.bind(this));
  },

  ping: function ping() {
    return this.prepareRequest({
      method: 'update',
      uri: '/ping'
    })
      .then(this.request.bind(this));
  },

  /**
   * [retrieveKeys description]
   * @method retrieveKeys
   * @param {Object}     options
   * @todo move to {Encryption.EncryptionService}
   */
  retrieveKeys: function retrieveKeys(options) {
    options = options || {};
    if (!options.uri) {
      return Promise.reject(new Error('`options.uri` is required'));
    }

    return this.prepareRequest({
      method: 'retrieve',
      uri: options.uri
    })
    .then(this.request.bind(this))
      .then(function processResponse(res) {
        return this._asKey(res.key);
      }.bind(this));
  },

  _asKey: function _asKey(key) {
    return jose.JWK.asKey(key.jwk)
      .then(function assignJwk(jwk) {
        key.jwk = jwk;
        return key;
      })
      .then(this._reformatKey);
  },

  _reformatKey: function _reformatKey(key) {
    var reformedKey = {
      keyUrl: key.uri,
      keyValue: key.jwk
    };

    var resourceUri;
    if (key.resourceUri && key.resourceUri.indexOf('/resources/') !== 0) {
      resourceUri = '/resources/' + base64.toBase64Url(key.resourceUri);
    }
    else {
      resourceUri = key.resourceUri;
    }

    if (resourceUri) {
      reformedKey.resourceUri = resourceUri;
    }

    return reformedKey;
  }
});

module.exports = KMS;
