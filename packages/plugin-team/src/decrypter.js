/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Decrypter} from '@ciscospark/plugin-conversation';

Object.assign(Decrypter.prototype, {
  /**
   * Decrypts a team
   * @param {Encryption~Key|string} key
   * @param {Object} team
   * @returns {Promise} Resolves with the decrypted team
   * @private
   */
  decryptTeam(key, team) {
    let promises = [];
    if (team.conversations.items) {
      promises = team.conversations.items.map((item) => this.decryptObject(item));
    }

    const usableKey = key || team.encryptionKeyUrl;

    if (usableKey) {
      promises.push(this.decryptProperty(`displayName`, usableKey, team));
      promises.push(this.decryptProperty(`summary`, usableKey, team));
    }

    return Promise.all(promises);
  },

  /**
   * Decrypts a Summary property
   * @param {Encryption~Key|string} key
   * @param {string} summary
   * @returns {Promise} Resolves with decypted string
   * @private
   */
  decryptPropSummary(key, summary) {
    return this.spark.encryption.decryptText(key, summary);
  }
});
