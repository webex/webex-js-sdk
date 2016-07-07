/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var normalizer = require('../conversation/normalizer');
var resolveWith = require('../../../util/resolve-with');

/**
 * @param {Team~TeamObject} team
 * @private
 * @return {Promise}
 */
normalizer.prototype._normalizeTeam = function _normalizeTeam(team) {
  team.conversations = team.conversations || {};
  team.conversations.items = team.conversations.items || [];
  team.teamMembers = team.teamMembers || {};
  team.teamMembers.items = team.teamMembers.items || [];

  return Promise.all([
    Promise.all(team.conversations.items.map(this.normalize, this)),
    Promise.all(team.teamMembers.items.map(this.normalize, this))
  ])
    .then(resolveWith(team));
};
