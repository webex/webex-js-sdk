/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';

/**
 * Interacts with the deprecated /bots API on the conversation service. *THESE
 * ARE NOT THE BOTS YOU'RE LOOKING FOR*. This package is only for helping with
 * tests and should not/cannot be used to create production bots
 */
const MachineAccount = SparkPlugin.extend({
  namespace: `MachineAccount`,

  /**
   * Creates a machine account
   * @param {Object} options
   * @param {string} options.name
   * @param {string} options.contactEmail
   * @returns {Promise<MachineAccount>}
   */
  create(options) {
    options = options || {};

    if (!options.name) {
      return Promise.reject(new Error(`\`options.name\` is required`));
    }

    if (!options.contactEmail) {
      return Promise.reject(new Error(`\`options.contactEmail\` is required`));
    }

    return this.request({
      method: `POST`,
      api: `conversation`,
      resource: `bots`,
      body: options
    })
      .then((res) => res.body);
  },

  /**
   * deletes a machine account
   * @param {MachineAccount} bot
   * @returns {Promse}
   */
  delete(bot) {
    let id;
    if (bot) {
      id = bot.id || bot;
      if (typeof id !== `string`) {
        return Promise.reject(new Error(`\`bot.id\` is required`));
      }
    }
    else {
      id = this.spark.device.userId;
    }

    return this.request({
      method: `DELETE`,
      api: `conversation`,
      resource: `bots/${id}`
    })
      .then((res) => res.body);
  }
});

export default MachineAccount;
