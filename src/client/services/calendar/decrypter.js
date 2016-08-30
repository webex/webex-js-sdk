/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var base64 = require('../../../util/base64');
var decrypter = require('../conversation/decrypter');

/**
 * Decrypts a meeting subject
 * @param {string} subject
 * @param {Encryption~Key|string} key
 * @private
 */
decrypter.prototype._decryptPropTitle = function(encryptedSubject, key) {
  return this.spark.encryption.decryptText(encryptedSubject, key);
};

decrypter.prototype._decryptPropLocation = function(encryptedLocation, key) {
  return this.spark.encryption.decryptText(encryptedLocation, key);
};

decrypter.prototype._decryptPropAgenda = function(encryptedAgenda, key) {
  return this.spark.encryption.decryptText(encryptedAgenda, key);
};
