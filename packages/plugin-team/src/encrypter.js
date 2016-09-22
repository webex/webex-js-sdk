/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Encrypter} from '@ciscospark/plugin-conversation';
import {isArray} from 'lodash';

Object.assign(Encrypter.prototype, {
  /**
   * Encrypts a team
   * @param {Encryption~Key|string} key
   * @param {Object} team
   * @returns {Promise} Resolves with the encrypted team
   * @private
   */
  encryptTeam(key, team) {
    return Promise.resolve(key || this.spark.encryption.kms.createUnboundKeys({count: 1}))
      .then((keys) => {
        const k = isArray(keys) ? keys[0] : keys;

        if (team.kmsMessage && team.kmsMessage.keyUris && !team.kmsMessage.keyUris.includes(k.uri)) {
          team.kmsMessage.keyUris.push(k.uri);
        }

        const promises = [];

        if (team.displayName) {
          promises.push(this.encryptProperty(`displayName`, k, team)
            .then(() => {
              team.encryptionKeyUrl = k.uri;
            }));
        }

        if (team.summary) {
          promises.push(this.encryptProperty(`summary`, k, team)
            .then(() => {
              team.encryptionKeyUrl = k.uri;
            }));
        }

        return Promise.all(promises)
          .then(() => {
            if (!team.defaultActivityEncryptionKeyUrl) {
              team.defaultActivityEncryptionKeyUrl = k.uri;
            }
          });
      });
  },

  /**
   * Encrypts a summary
   * @param {Encryption~Key|string} key
   * @param {string} summary
   * @private
   * @returns {Promise} Resolves with the encrypted string
   */
  encryptPropSummary(key, summary) {
    return this.spark.encryption.encryptText(key, summary);
  }
});
