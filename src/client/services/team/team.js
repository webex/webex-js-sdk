/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var cloneDeep = require('lodash.clonedeep');
var find = require('lodash.find');
var noop = require('lodash.noop');
var pick = require('lodash.pick');
var querystring = require('querystring');
var resolveWith = require('../../../util/resolve-with');
var SparkBase = require('../../../lib/spark-base');

/**
 * @class
 * @extends {SparkBase}
 * @memberof {Team}
 */
var TeamService = SparkBase.extend(
  {
  namespace: 'Team',

  /**
   * Get all teams for a user or get data about a single team
   * @param {Object|Team~TeamObject} options
   * @param {string} options.id
   * @param {boolean} options.includeTeamConversations
   * @param {boolean} options.includeTeamMembers
   * @returns {Promise} Resolves with the requested team or teams
   */
  get: function get(options) {
    options = options || {};

    var params = {
      api: 'conversation',
      qs: pick(options, 'includeTeamConversations', 'includeTeamMembers')
    };

    if (options.id) {
      params.resource = 'teams/' + options.id;
    }
    else {
      params.resource = 'teams';
    }

    return this.request(params)
      .then(function processResponse(res) {
        if (res.body.items) {
          return Promise.all(res.body.items.map(function processItem(team) {
            return this.spark.conversation.decrypter.decryptObject(team, options)
              .then(this._recordUUIDs.bind(this))
              .then(this.spark.conversation.inboundNormalizer.normalize.bind(this.spark.conversation.inboundNormalizer));
          }.bind(this)))
            .then(resolveWith(res.body.items));
        }
        else {
          return this.spark.conversation.decrypter.decryptObject(res.body, options)
            .then(this._recordUUIDs.bind(this))
            .then(this.spark.conversation.inboundNormalizer.normalize.bind(this.spark.conversation.inboundNormalizer));
        }
      }.bind(this));
  },

  /**
   * Archive a team or team conversation.
   * @param {TeamObject|ConversationObject} target team or team conversation that should be archived
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the posted activity
   */
  archive: function archive(target, activity, options) {
    if (!target.objectType) {
      return Promise.reject(new Error('`target.objectType` is required'));
    }

    var properties = {
      verb: 'archive',
      object: pick(target, 'id', 'url', 'objectType'),
      target: pick(target, 'id', 'url', 'objectType')
    };

    return this.spark.conversation._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this.spark.conversation._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Create a team
   * @param {NewTeamObject} protoTeam
   * @returns {Promise} Resolves with the created team
   */
  create: function create(protoTeam) {

    if (!protoTeam.displayName) {
      return Promise.reject(new Error('`team.displayName` is required'));
    }

    if (!protoTeam.participants) {
      return Promise.reject(new Error('`team.participants` is required'));
    }

    if (protoTeam.participants.length === 0) {
      return Promise.reject(new Error('`team.participants` cannot be empty'));
    }

    return this.spark.conversation.encrypter.encryptObject(this._prepareTeam(protoTeam))
      .then(function submitTeam(payload) {
        return this.request({
          method: 'post',
          api: 'conversation',
          resource: 'teams',
          body: payload
        });
      }.bind(this))
        .then(function decryptTeam(res) {
          return this.spark.conversation.decrypter.decryptObject(res.body)
            .then(this.spark.conversation.inboundNormalizer.normalize.bind(this.spark.conversation.inboundNormalizer));
        }.bind(this));
  },

  /**
   * Add a member to a team
   * @param {TeamObject} team
   * @param {Object} participant
   * @returns {Promise} Resolves with activity that was posted
   */
  addMember: function addMember(team, participant) {
    return this._ensureGeneralConversation(team)
      .then(function submit(teamConversation) {
        return this.spark.conversation.add(teamConversation, participant, {});
      }.bind(this));
  },

  /**
   * Remove a member from a team
   * @param {TeamObject} team
   * @param {Object} participant
   * @returns {Promise} Resolves with activity that was posted
   */
  removeMember: function removeMember(team, participant) {
    return this._ensureGeneralConversation(team)
      .then(function submit(teamConversation) {
        return this.spark.conversation.leave(teamConversation, participant, {});
      }.bind(this));
  },

  /**
   * Assign a team member to be a moderator of a team
   * @param {TeamObject} team
   * @param {Object} participant
   * @returns {Promise} Resolves with activity that was posted
   */
  assignModerator: function assignModerator(team, participant) {
    return this._ensureGeneralConversation(team)
      .then(function submit(teamConversation) {
        return this.spark.conversation.assignModerator(teamConversation, participant, {});
      }.bind(this));
  },

  /**
   * Unassign a team moderator
   * @param {TeamObject} team
   * @param {Object} participant
   * @returns {Promise} Resolves with activity that was posted
   */
  unassignModerator: function unassignModerator(team, participant) {
    return this._ensureGeneralConversation(team)
      .then(function submit(teamConversation) {
        return this.spark.conversation.unassignModerator(teamConversation, participant, {});
      }.bind(this));
  },

  /**
   * Update the displayName, summary, or teamColor field for a team.
   * @param {TeamObject} team with updated displayName or summary
   * @returns {Promise} Resolves with posted activity
   */
  update: function update(team) {
    if (!team.displayName) {
      return Promise.reject(new Error('`team.displayName` is required'));
    }

    return this.spark.conversation.update(team, {})
    .then(function unenecryptProperties(activity) {
      if (this.spark.conversation.config.keepEncryptedProperties) {
        activity.object.encryptedSummary = activity.object.summary;
        team.encryptedSummary = activity.object.encryptedSummary;
      }

      activity.object.summary = team.summary;

      return activity;
    }.bind(this));
  },

  /**
   * Unarchive a team or team conversation.
   * @param {TeamObject|ConversationObject} target team or team conversation that should be unarchived
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the posted activity
   */
  unarchive: function unarchive(target, activity, options) {
    if (!target.objectType) {
      return Promise.reject(new Error('`target.objectType` is required'));
    }

    var properties = {
      verb: 'unarchive',
      object: pick(target, 'id', 'url', 'objectType'),
      target: pick(target, 'id', 'url', 'objectType')
    };

    return this.spark.conversation._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this.spark.conversation._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Get the list of conversations for a particular team
   * @param {TeamObject} team
   * @returns {Promise} Resolves with a list of conversations
   */
  getConversations: function getConversations(team) {
    var params = {
      api: 'conversation',
      resource: 'teams/' + team.id + '/conversations'
    };

    return this.request(params)
      .then(function processResponse(res) {
        if (res.body.items) {
          return Promise.all(res.body.items.map(function processItem(conversation) {
            return this.spark.conversation.decrypter.decryptObject(conversation)
              .then(this.spark.conversation.inboundNormalizer.normalize.bind(this.spark.conversation.inboundNormalizer));
          }.bind(this)))
            .then(resolveWith(res.body.items));
        }
        else {
          return this.spark.conversation.decrypter.decryptObject(res.body)
            .then(this.spark.conversation.inboundNormalizer.normalize.bind(this.spark.conversation.inboundNormalizer));
        }
      }.bind(this));
  },

  /**
   * Join a team conversation
   * @param {TeamObject} team
   * @param {ConversationObject} conversation
   * @returns {Promise}
   */
  joinConversation: function joinConversation(team, conversation) {
    var params = {
      api: 'conversation',
      method: 'post',
      resource: 'teams/' + team.id + '/conversations/' + conversation.id + '/participants'
    };

    return this.request(params)
      .then(function processResponse(res) {
        return this.spark.conversation.decrypter.decryptObject(res.body)
          .then(this.spark.conversation.inboundNormalizer.normalize.bind(this.spark.conversation.inboundNormalizer));
      }.bind(this));
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
  createConversation: function createConversation(team, protoConversation, options) {
    options = options || {};

    if (!protoConversation.displayName) {
      return Promise.reject(new Error('`conversation.displayName` is required'));
    }

    return this.spark.conversation._ensureCreatableUsers(protoConversation)
      .then(function prepareConversation(protoConversation) {
        return this._ensureGeneralConversation(team)
          .then(function encryptConversation(teamConversation) {
            return this._prepareTeamConversation(teamConversation, protoConversation)
              .then(this.spark.conversation._encryptConversation.bind(this.spark.conversation));
          }.bind(this));
      }.bind(this))
      .then(function submitConversation(payload) {
        return this.request({
          method: 'POST',
          api: 'conversation',
          resource: 'teams/' + team.id + '/conversations',
          qs: pick(options,'includeAllTeamMembers'),
          body: payload
        });
      }.bind(this))
      .then(function decryptBody(res) {
        return this.spark.conversation.decrypter.decryptObject(res.body);
      }.bind(this));
  },

  /**
   * Move an existing group conversation into a team.
   * @param {TeamObject} team
   * @param {ConversationObject} conversation
   * @returns {Promise} Resolves with the add activity
   */
  addConversation: function addConversation(team, conversation) {
    return this._ensureGeneralConversation(team)
      .then(function prepareActivity(generalConversation) {
        return this.spark.conversation._prepareActivity({}, {
          verb: 'add',
          target: pick(generalConversation, 'objectType', 'id', 'url', 'kmsResourceObjectUrl', 'defaultActivityEncryptionKeyUrl'),
          object: {
            id: conversation.id,
            objectType: 'conversation'
          },
          kmsMessage: {
            method: 'create',
            uri: '/authorizations',
            resourceUri: conversation.kmsResourceObjectUrl,
            userIds: [generalConversation.kmsResourceObjectUrl]
          }
        })
        .then(function callEncryptActivity(activity) {
          return this.spark.conversation._encryptActivity(activity, generalConversation.defaultActivityEncryptionKeyUrl);
        }.bind(this))
      }.bind(this))
      .then(function submitActivity(activity) {
        return this.spark.conversation._submitActivity(activity);
      }.bind(this));
  },

  /**
   * Remove a team conversation from a team.
   * @param {TeamObject} team
   * @param {ConversationObject} conversation to be removed
   * @param {Object} options
   * @returns {Promise} Resolves with the leave activity
   */
  removeConversation: function removeConversation(team, conversation, options) {
    options = options || {};

    return this._ensureGeneralConversation(team)
      .then(function submit(teamConversation) {

        var properties = {
          verb: 'remove',
          object: pick(conversation, 'id', 'url', 'objectType'),
          target: pick(teamConversation, 'id', 'url', 'objectType'),
          kmsMessage: {
            method: 'delete',
            uri: '<KRO>/authorizations?' + querystring.stringify({
              authId: conversation.id
            })
          }
        };

        return this.spark.conversation._prepareActivity({}, properties, options)
          .then(function callEncryptActivity(activity) {
            return this.spark.conversation._encryptActivity(cloneDeep(activity), teamConversation.defaultActivityEncryptionKeyUrl);
          }.bind(this))
          .then(function callSubmitActivity(activity) {
            return this.spark.conversation._submitActivity(activity, options);
          }.bind(this));
      }.bind(this));
  },

  _prepareTeam: function _prepareTeam(protoTeam) {
    var payload = {
      displayName: protoTeam.displayName,
      activities: {
        items: [{
          actor: {
            objectType: 'person',
            id: this.spark.device.userId
          },
          objectType: 'activity',
          verb: 'create'
        }]
      },
      objectType: 'team'
    };

    if (protoTeam.summary) {
      payload.summary = protoTeam.summary;
    }

    protoTeam.participants.forEach(function mapParticipantToAddActivity(participant) {
      var id = participant;

      payload.activities.items.push({
        verb: 'add',
        objectType: 'activity',
        object: {
          objectType: 'person',
          id: id
        },
        actor: {
          objectType: 'person',
          id: this.spark.device.userId
        }
      });
    }, this);

    assign(payload, {
      kmsMessage: {
        method: 'create',
        uri: '/resources',
        userIds: protoTeam.participants,
        keyUris: []
      }
    });

    return payload;
  },

  _prepareTeamConversation: function _prepareTeamConversation(teamConversation, protoConversation) {
    var payload = {
      displayName: protoConversation.displayName,
      activities: {
        items: [{
          actor: {
            objectType: 'person',
            id: this.spark.device.userId
          },
          objectType: 'activity',
          verb: 'create'
        }]
      },
      objectType: 'conversation'
    };

    protoConversation.participants.forEach(function mapParticipantToAddActivity(participant) {
      var id = participant;

      payload.activities.items.push({
        verb: 'add',
        objectType: 'activity',
        object: {
          objectType: 'person',
          id: id
        },
        actor: {
          objectType: 'person',
          id: this.spark.device.userId
        }
      });
    }, this);

    assign(payload, {
      kmsMessage: {
        method: 'create',
        uri: '/resources',
        userIds: cloneDeep(protoConversation.participants),
        keyUris: []
      }
    });

    if (!teamConversation.kmsResourceObjectUrl) {
      return Promise.reject(new Error('Team general conversation must have a KRO'));
    }

    payload.kmsMessage.userIds.push(teamConversation.kmsResourceObjectUrl);

    return Promise.resolve(payload);
  },

  _ensureGeneralConversation: function _ensureGeneralConversation(team) {

    if (!team.generalConversationUuid) {
      return Promise.reject(new Error('`team.generalConversationUuid` must be present'));
    }

    // fetch the general convo
    var teamConversation;
    if (team.conversations.items.length) {
      teamConversation = find(team.conversations.items, {id: team.generalConversationUuid});

      if (teamConversation) {
        return Promise.resolve(teamConversation);
      }
    }

    return this.spark.conversation.get({id: team.generalConversationUuid});
  },

  _recordUUIDs: function _recordUUIDs(team) {
    if (!team.teamMembers || !team.teamMembers.items) {
      return Promise.resolve(team);
    }

    return Promise.all(team.teamMembers.items.map(function processItem(participant) {
      return new Promise(function executor(resolve) {
        process.nextTick(function resolveOnNextTick() {
          // Suppress errors. We can't assume participants will have an email
          // address
          resolve(this.spark.user.recordUUID(participant).catch(noop));
        }.bind(this));
      }.bind(this));
    }.bind(this)))
      .then(resolveWith(team));
  }

});

module.exports = TeamService;
