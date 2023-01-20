/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';
import url from 'url';

import {WebexPlugin} from '@webex/webex-core';
import {proxyEvents, tap, transferEvents} from '@webex/common';
import jose from 'node-jose';
import SCR from 'node-scr';

import ensureBuffer from './ensure-buffer';
import KMS from './kms';

const Encryption = WebexPlugin.extend({
  children: {
    kms: KMS,
  },

  namespace: 'Encryption',

  processKmsMessageEvent(event) {
    return this.kms.processKmsMessageEvent(event);
  },

  decryptBinary(scr, buffer) {
    return ensureBuffer(buffer).then((b) => {
      /* istanbul ignore if */
      if (buffer.length === 0 || buffer.byteLength === 0) {
        return Promise.reject(new Error('Attempted to decrypt zero-length buffer'));
      }

      return scr.decrypt(b);
    });
  },

  /**
   * Decrypt a SCR (Secure Content Resource) using the supplied key uri.
   *
   * @param {string} key - The uri of a key stored in KMS
   * @param {Object} cipherScr - An encrypted SCR
   * @param {Object} options
   * @param {string} options.onBehalfOf - Fetch the KMS key on behalf of another user (using the user's UUID), active user requires the 'spark.kms_orgagent' role
   * @returns {Object} Decrypted SCR
   */
  decryptScr(key, cipherScr, options) {
    return this.getKey(key, options).then((k) => SCR.fromJWE(k.jwk, cipherScr));
  },

  /**
   * Decrypt text using the supplied key uri.
   *
   * @param {string} key - The uri of a key stored in KMS
   * @param {string} ciphertext - Encrypted text
   * @param {Object} options
   * @param {string} options.onBehalfOf - Fetch the KMS key on behalf of another user (using the user's UUID), active user requires the 'spark.kms_orgagent' role
   * @returns {string} Decrypted plaintext
   */
  decryptText(key, ciphertext, options) {
    return this.getKey(key, options).then((k) =>
      jose.JWE.createDecrypt(k.jwk)
        .decrypt(ciphertext)
        .then((result) => result.plaintext.toString())
    );
  },

  /**
   * Validate and initiate a Download request for requested file
   *
   * @param {Object} scr - Plaintext
   * @param {Object} options - optional parameters to download a file
   * @returns {promise}
   */
  download(scr, options) {
    /* istanbul ignore if */
    if (!scr.loc) {
      return Promise.reject(new Error('`scr.loc` is required'));
    }

    const shunt = new EventEmitter();
    const promise = this._fetchDownloadUrl(scr, options)
      .then((uri) => {
        // eslint-disable-next-line no-shadow
        const options = {
          method: 'GET',
          uri,
          responseType: 'buffer',
        };

        const ret = this.request(options);

        transferEvents('progress', options.download, shunt);

        return ret;
      })
      .then((res) => this.decryptBinary(scr, res.body));

    proxyEvents(shunt, promise);

    return promise;
  },

  /**
   * Fetch Download URL for the requested file
   *
   * @param {Object} scr - Plaintext
   * @param {Object} options - optional parameters to download a file
   * @returns {promise} url of the downloadable file
   */
  _fetchDownloadUrl(scr, options) {
    this.logger.info('encryption: retrieving download url for encrypted file');

    if (process.env.NODE_ENV !== 'production' && scr.loc.includes('localhost')) {
      this.logger.info(
        'encryption: bypassing webex files because this looks to be a test file on localhost'
      );

      return Promise.resolve(scr.loc);
    }

    const inputBody = {
      endpoints: [scr.loc],
    };
    const endpointUrl = url.parse(scr.loc);

    // hardcode the url to use 'https' and the file service '/v1/download/endpoints' api
    endpointUrl.protocol = 'https';
    endpointUrl.pathname = '/v1/download/endpoints';

    return this.request({
      method: 'POST',
      uri: url.format(endpointUrl),
      body: options
        ? {
            ...inputBody,
            allow: options.params.allow,
          }
        : inputBody,
    }).then((res) => {
      // eslint-disable-next-line no-shadow
      const url = res.body.endpoints[scr.loc];

      if (!url) {
        this.logger.warn(
          'encryption: could not determine download url for `scr.loc`; attempting to download `scr.loc` directly'
        );

        return scr.loc;
      }
      this.logger.info('encryption: retrieved download url for encrypted file');

      return url;
    });
  },

  encryptBinary(file) {
    return ensureBuffer(file).then((buffer) =>
      SCR.create().then((scr) =>
        scr
          .encrypt(buffer)
          .then(ensureBuffer)
          // eslint-disable-next-line max-nested-callbacks
          .then((cdata) => ({scr, cdata}))
      )
    );
  },

  /**
   * Encrypt a SCR (Secure Content Resource) using the supplied key uri.
   *
   * @param {string} key - The uri of a key stored in KMS
   * @param {Object} scr - Plaintext
   * @param {Object} options
   * @param {string} options.onBehalfOf - Fetch the KMS key on behalf of another user (using the user's UUID), active user requires the 'spark.kms_orgagent' role
   * @returns {string} Encrypted SCR
   */
  encryptScr(key, scr, options) {
    /* istanbul ignore if */
    if (!scr.loc) {
      return Promise.reject(new Error('Cannot encrypt `scr` without first setting `loc`'));
    }

    return this.getKey(key, options).then((k) => scr.toJWE(k.jwk));
  },

  /**
   * Encrypt plaintext using the supplied key uri.
   *
   * @param {string} key - The uri of a key stored in KMS
   * @param {string} plaintext
   * @param {Object} options
   * @param {string} options.onBehalfOf - Fetch the KMS key on behalf of another user (using the user's UUID), active user requires the 'spark.kms_orgagent' role
   * @returns {string} Encrypted text
   */
  encryptText(key, plaintext, options) {
    return this.getKey(key, options).then((k) =>
      jose.JWE.createEncrypt(this.config.joseOptions, {
        key: k.jwk,
        header: {
          alg: 'dir',
        },
        reference: null,
      }).final(plaintext, 'utf8')
    );
  },

  /**
   * Fetch the key associated with the supplied KMS uri.
   *
   * @param {string} uri - The uri of a key stored in KMS
   * @param {Object} options
   * @param {string} options.onBehalfOf - Fetch the KMS key on behalf of another user (using the user's UUID), active user requires the 'spark.kms_orgagent' role
   * @returns {string} Key
   */
  getKey(uri, {onBehalfOf} = {}) {
    if (uri.jwk) {
      return this.kms.asKey(uri);
    }

    let storageKey = uri;

    if (onBehalfOf) {
      storageKey += `/onBehalfOf/${onBehalfOf}`;
    }

    return this.unboundedStorage
      .get(storageKey)
      .then((keyString) => JSON.parse(keyString))
      .then((keyObject) => this.kms.asKey(keyObject))
      .catch(() =>
        this.kms
          .fetchKey({uri, onBehalfOf})
          .then(tap((key) => this.unboundedStorage.put(storageKey, JSON.stringify(key, replacer))))
      );
  },
});

/**
 * JSON.stringify replacer that ensures private key data is serialized.
 * @param {string} k
 * @param {mixed} v
 * @returns {mixed}
 */
function replacer(k, v) {
  if (k === 'jwk') {
    // note: this[k] and v may be different representations of the same value
    // eslint-disable-next-line no-invalid-this
    const json = this[k].toJSON(true);

    return json;
  }

  return v;
}

export default Encryption;
