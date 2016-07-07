/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var encrypter = require('../conversation/encrypter');

/**
 * Encrypts a team
 * @param {Object} team
 * @param {Encryption~Key|string} key
 * @returns {Promise} Resolves with the encrypted team
 * @private
 */
encrypter.prototype._encryptTeam = function _encryptTeam(team, key) {
  return Promise.resolve(key || this.spark.encryption.getUnusedKey())
    .then(function encryptTeamWithKey(key) {
      var promises = [];

      if (team.displayName) {
        promises.push(this.encryptProperty(team, 'displayName', key)
          // TODO can assignEncryptionKeyUrl be done inside encryptProperty? (
          .then(function assignEncryptionKeyUrl() {
            team.encryptionKeyUrl = key.keyUrl;
          }));
      }

      if (team.summary) {
        promises.push(this.encryptProperty(team, 'summary', key)
          // TODO can assignEncryptionKeyUrl be done inside encryptProperty? (
          .then(function assignEncryptionKeyUrl() {
            team.encryptionKeyUrl = key.keyUrl;
          }));
      }

      if (team.kmsMessage) {
        promises.push(this.encryptProperty(team, 'kmsMessage', key));
      }

      return Promise.all(promises)
        .then(function assignDefaultActivityEncryptionKeyUrl() {
          team.defaultActivityEncryptionKeyUrl = key.keyUrl;
        });
    }.bind(this));
};

/**
 * Encrypts a summary
 * @param {string} summary
 * @param {Encryption~Key|string} key
 * @private
 */
encrypter.prototype._encryptPropSummary = function _encryptPropSummary(summary, key) {
  return this.spark.encryption.encryptText(summary, key);
};
