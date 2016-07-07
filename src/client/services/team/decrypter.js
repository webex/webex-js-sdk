/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var base64 = require('../../../util/base64');
var decrypter = require('../conversation/decrypter');

/**
 * Decrypts a team
 * @param {Object} team
 * @param {Encryption~Key|string} key
 * @param {Object} options
 * @param {Object} parentObject
 * @private
 */
decrypter.prototype._decryptTeam = function _decryptTeam(team, key, options, parentObject) {
  var promises = [];
  if (team.conversations.items) {
    promises = team.conversations.items.map(function processItem(item) {
      return this.decryptObject(item, options);
    }.bind(this));
  }

  var usableKey = key || team.encryptionKeyUrl;

  if (usableKey && team.displayName) {
    try {
      var parts = team.displayName.split('.');
      if (parts.length === 5) {
        JSON.parse(base64.decode(parts[0]));

        // Much like a conversation, a team can be the object of update, add or leave activities.
        // If this is the case we measure decryption of parent object
        this.spark.encryption.metrics.startDecryptionMetrics(parentObject || team);

        promises.push(this.decryptProperty(team, 'displayName', usableKey, function decryptDisplayNameFailureCallback() {
          team.displayName = this.spark.encryption.config.decryptionFailureMessage;
        }.bind(this)));
        promises.push(this.decryptProperty(team, 'summary', usableKey, function decryptSummaryFailureCallback() {
          team.summary = this.spark.encryption.config.decryptionFailureMessage;
        }.bind(this)));
      }
    }
    catch (error) {
      delete team.encryptionKeyUrl;
    }
  }

  return Promise.all(promises);
};


/**
 * Decrypts a Summary property
 * @param {string} encryptedSummary
 * @param {Encryption~Key|string} key
 * @private
 * @return {Promise}
 */
decrypter.prototype._decryptPropSummary = function _decryptPropSummary(encryptedSummary, key) {
  return this.spark.encryption.decryptText(encryptedSummary, key);
};
