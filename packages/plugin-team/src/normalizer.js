/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Normalizer} from '@ciscospark/plugin-conversation';


Object.assign(Normalizer.prototype, {

  /**
   * Normalizes a team object returned from the API
   * @param {Object} team
   * @returns {TeamObject} team
   */
  normalizeTeam(team) {
    team.conversations = team.conversations || {};
    team.conversations.items = team.conversations.items || [];
    team.teamMembers = team.teamMembers || {};
    team.teamMembers.items = team.teamMembers.items || [];

    return Promise.all([
      Promise.all(team.conversations.items.map((item) => this.normalize(item))),
      Promise.all(team.teamMembers.items.map((item) => this.normalize(item)))
    ])
      .then(() => team);
  }

});
