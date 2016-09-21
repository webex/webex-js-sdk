/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';

const Team = SparkPlugin.extend({
  namespace: `Team`,

  /**
   * Move an existing group conversation into a team.
   * @param {TeamObject} team
   * @param {ConversationObject} conversation
   * @returns {Promise} Resolves with the add activity
   */
  addConversation(team, conversation) {

  },

  /**
   * Add a member to a team
   * @param {TeamObject} team
   * @param {Object} participant
   * @returns {Promise} Resolves with activity that was posted
   */
  addMember(team, participant, activity) {

  },

  /**
   * Archive a team or team conversation.
   * @param {TeamObject|ConversationObject} target team or team conversation that should be archived
   * @param {Conversation~ActivityObject} activity
   * @returns {Promise} Resolves with the posted activity
   */
  archive(target, activity) {

  },

  /**
   * Create a team
   * @param {NewTeamObject} params
   * @returns {Promise} Resolves with the created team
   */
  create(params) {

  },

  /**
   * Create a conversation within a team. Currently does not support
   * activities besides add (ie no post or share activities).
   * @param {TeamObject} team
   * @param {NewConversationObject} protoConversation
   * @param {Object} options
   * @param {boolean} options.includeAllTeamMembers
   * @returns {Promise} Resolves with the newly created conversation
   */
  createConversation(team, protoConversation, options) {

  },

  /**
   * Retrieve a single team
   * @param {Object|Team~TeamObject} team
   * @param {string} team.id
   * @param {Object} options
   * @param {boolean} options.includeTeamConversations
   * @param {boolean} options.includeTeamMembers
   * @returns {Promise} Resolves with the requested team
   */
  get(team, options) {

  },

  /**
   * Get the list of conversations for a particular team
   * @param {TeamObject} team
   * @returns {Promise} Resolves with a list of conversations
   */
  getConversations(team) {

  },

  /**
   * Join a team conversation
   * @param {TeamObject} team
   * @param {ConversationObject} conversation
   * @returns {Promise}
   */
  joinConversation(team, conversation) {

  },

  /**
   * Retrieve all teams
   * @param {Object} options
   * @param {boolean} options.includeTeamConversations
   * @param {boolean} options.includeTeamMembers
   * @returns {Promise} Resolves with the requested teams
   */
  list() {

  },

  /**
   * Remove a member from a team
   * @param {TeamObject} team
   * @param {Object} participant
   * @param {Object} activty
   * @returns {Promise} Resolves with activity that was posted
   */
  removeMember(team, participant, activity) {

  },

  /**
   * Remove a team conversation from a team.
   * @param {TeamObject} team
   * @param {ConversationObject} conversation to be removed
   * @returns {Promise} Resolves with the leave activity
   */
  removeConversation(team, conversation) {

  },

  /**
   * Update the displayName, summary, or teamColor field for a team.
   * @param {TeamObject} team with updated displayName, summary, or teamColor
   * @returns {Promise} Resolves with posted activity
   */
  update(team) {

  }

});

/**
 * Assign or unassign a team member to be a moderator of a team
 * @param {TeamObject} team
 * @param {Object} participant
 * @param {Object} activity
 * @returns {Promise} Resolves with activity that was posted
 */
[
  `assignModerator`,
  `unassignModerator`
].forEach((verb) => {
  Team.prototype[verb] = function submitObjectActivity(team, moderator, activity) {

  }
})

export default Team;
