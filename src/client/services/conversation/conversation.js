/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var cloneDeep = require('lodash.clonedeep');
var Decrypter = require('./decrypter');
var defaults = require('lodash.defaults');
var Encrypter = require('./encrypter');
var EventEmitter = require('events').EventEmitter;
var FileCache = require('./file-cache');
var forEach = require('lodash.foreach');
var isObject = require('lodash.isobject');
var isFunction = require('lodash.isfunction');
var last = require('lodash.last');
var merge = require('lodash.merge');
var noop = require('lodash.noop');
var InboundNormalizer = require('./inbound-normalizer');
var OutboundNormalizer = require('./outbound-normalizer');
var omit = require('lodash.omit');
var pick = require('lodash.pick');
var pluck = require('lodash.pluck');
var querystring = require('querystring');
var reduce = require('lodash.reduce');
var resolveWith = require('../../../util/resolve-with');
var ShareActivity = require('./share-activity');
var SparkBase = require('../../../lib/spark-base');
var uniq = require('lodash.uniq');
var uuid = require('uuid');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Conversation
 */
var ConversationService = SparkBase.extend(
  /** @lends Conversation.ConversationService.prototype */
  {
  children: {
    decrypter: Decrypter,
    encrypter: Encrypter,
    filecache: FileCache,
    inboundNormalizer: InboundNormalizer,
    outboundNormalizer: OutboundNormalizer
  },

  namespace: 'Conversation',

  session: {
    encryptionDisabled: {
      type: 'boolean',
      default: false
    }
  },

  // Event Processors
  // ----------------

  processActivityEvent: function processActivityEvent(message) {
    return this.decrypter.decryptObject(message.activity)
      .then(function normalize(activity) {
        return this.inboundNormalizer.normalize(activity);
      }.bind(this))
      .then(function assignActivity(activity) {
        message.activity = activity;
        return message;
      });
  },

  // Settings
  // --------

  disableEncryption: function disableEncryption() {
    /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Encryption can only be disabled in test environments');
    }
    this.encryptionDisabled = true;
  },

  enableEncryption: function enableEncryption() {
    /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Encryption can only be disabled in test environments');
    }
    this.encryptionDisabled = false;
  },

  // Retrievers
  // ----------

  download: function download(item, options) {
    options = options || {};

    var isEncrypted = !!item.scr;
    var url = isEncrypted ? item.scr.loc : item.url;

    this.logger.info('conversation: retrieving file from the cache');
    var promise;
    if (options.preferBlob || typeof window === 'undefined') {
      promise = this.filecache.getFile(url);
    }
    else {
      promise = this.filecache.getObjectURL(url);
    }

    var emitter = new EventEmitter();

    promise = promise
      .then(function logCacheHit(file) {
        this.logger.info('conversation: retrieved file from the cache');
        return file;
      }.bind(this))
      .catch(function downloadFile() {
        this.logger.info('conversation: file not found in cache');

        var promise;
        if (isEncrypted) {
          promise = this.spark.encryption.download(item.scr)
            .on('progress', emitter.emit.bind(emitter, 'progress'))
            .then(function ensureBlob(res) {
              if (typeof window === 'undefined') {
                return res;
              }
              else {
                /* eslint-env browser */
                return new Blob([res.buffer], {type: item.mimeType});
              }
            });
        }
        else {
          promise = this.request({
            uri: item.url,
            responseType: 'blob'
          })
            .on('download-progress', emitter.emit.bind(emitter, 'progress'))
            .then(function processResponse(res) {
              return res.body;
            });
        }

        return promise
          .then(function assignMetadata(file) {
            this.logger.info('conversation: file downloaded');
            if (item.displayName && !file.name) {
              file.name = item.displayName;
            }

            if (!file.type && item.mimeType && typeof window === 'undefined') {
              file.type = item.mimeType;
            }

            this.logger.info('conversation: storing file in the cache');

            this.filecache.add({
              file: file,
              url: url
            });

            this.logger.info('conversation: stored file in the cache');

            // Call the method a second time to avoid repeating the blob/url
            // logic.
            return this.download(item, options);
          }.bind(this));
      }.bind(this));

    promise.on = function on(key, callback) {
      emitter.on(key, callback);
      return promise;
    };

    return promise;
  },

  /**
   * Retrieves a conversation or set of conversations
   * @param {Object|Conversation~ConversationObject} options
   * @param {string} options.url
   * @param {string|Object} options.url
   * @param {string} options.id
   * @param {string} options.activitiesAfter
   * @param {string} options.sinceDate
   * @param {string} options.lastActivityBefore
   * @param {string} options.maxDate
   * @param {string} options.favorites
   * @param {string} options.isFavorite
   * @param {string} options.activitiesLimit
   * @param {string} options.conversationsLimit
   * @param {string} options.participantsLimit
   * @param {string} options.ackFilter, one of 'noack' (default), 'all', 'myack'
   * @param {string} options.participantAckFilter, one of 'all', 'noack'
   * (default), 'myack'
   * @param {boolean} options.startUxTimers If true, related decryptions will
   * submit metrics
   * @returns {Promise} Resolves with the requested conversation or conversations
   */
  get: function get(options) {
    options = options || {};
    return (options.user ? this.spark.user.getUUID(options.user) : Promise.resolve())
      .then(function _get(uuid) {
        // FIXME refactor so that we don't need to release a new patch version to
        // support new querystring options
        // Note: options may be a {@link Conversation~ConversationObject}, so it
        // shouldn't be modified
        options = options || {};
        var params = {
          qs: {
            uuidEntryFormat: true,
            personRefresh: true,
            latestActivity: options.latestActivity
          }
        };

        if (options.url || options.id) {
          options = this._inferConversationUrl(options);
          assign(params, pick(options, 'url'));
        }
        else {
          assign(params, {
            api: 'conversation'
          });

          if (uuid) {
            params.resource = 'conversations/user/' + uuid;
          }
          else if (options.relevant) {
            params.resource = 'conversations/relevant';
          }
          else {
            params.resource = 'conversations';
          }
        }

        assign(params.qs, pick(options, 'sinceDate', 'maxDate', 'conversationsLimit', 'participantAckFilter', 'activitiesLimit', 'participantsLimit', 'isFavorite', 'ackFilter', 'lastViewableActivityOnly'));

        // TODO deprecate aliases
        var aliases = {
          activitiesAfter: 'sinceDate',
          lastActivityBefore: 'maxDate',
          favorites: 'isFavorite'
        };

        forEach(aliases, function processAliases(value, key) {
          if (key in options) {
            params.qs[value] = options[key];
          }
        });

        return this.request(params);
      }.bind(this))
      .then(function processResponse(res) {
        // If the consuming code expects an array but there are no results, make
        // sure we send back an empty array.
        if (Object.keys(res.body).length === 0 && !options.url && !options.user) {
          return [];
        }

        if (res.body.items) {
          return Promise.all(res.body.items.map(function processItem(conversation) {
            return this.decrypter.decryptObject(conversation, options)
              .then(this._recordUUIDs.bind(this))
              .then(this.inboundNormalizer.normalize.bind(this.inboundNormalizer));
          }.bind(this)))
            .then(resolveWith(res.body.items));
        }
        else {
          return this.decrypter.decryptObject(res.body, options)
            .then(this._recordUUIDs.bind(this))
            .then(this.inboundNormalizer.normalize.bind(this.inboundNormalizer));
        }
      }.bind(this));
  },

  /**
   * Issues a PUT to the conversation/meetme endpoint to create
   * or fetch an existing personal conversation for a user.
   *
   * @param {User~UserObject|string} user object containing email attribute or email string
   * @param {Object} options
   * @param {number} options.activitiesLimit
   * @param {string} options.participantAckFilter
   * @returns {Promise} Resolves with a conversation.
   */
  getPersonalConversation: function getPersonalConversation(user, options) {
    return this.spark.user.getUUID(user)
      .then(function getConversation(uuid) {
        return this.request({
          method: 'PUT',
          api: 'conversation',
          resource: 'meetme/' + uuid,
          qs: pick(options, 'activitiesLimit', 'participantAckFilter')
        })
        .then(function processConversation(res) {
          return this.decrypter.decryptObject(res.body)
          .then(this._recordUUIDs.bind(this))
          .then(this.inboundNormalizer.normalize.bind(this.inboundNormalizer));
        }.bind(this));
      }.bind(this));
  },

  /**
   * Lists the current user's unread conversations
   * @returns {Array<Promise>} Resolves with an array of the current user's unread
   * conversations
   */
  listUnread: function listUnread(options) {
    options = options ? pick(options, 'includeMutedConversation') : {};

    return this.request({
      api: 'conversation',
      resource: 'conversations/unread',
      qs: options
    })
      .then(function processResponse(res) {
        return res.body.items || [];
      })
      .then(this.inboundNormalizer.normalize.bind(this.inboundNormalizer));
  },

  /**
   * Lists the conversations the current user has left
   * @param {Object} options
   * @param {integer} options.maxDate
   * @param {integer} options.sinceDate
   * @param {integer} options.conversationsLimit
   * @returns {Promise} Resolves with an array of the conversations the current
   * user has left
   */
  listLeft: function listLeft(options) {
    options = options ? pick(options, 'maxDate', 'sinceDate', 'conversationsLimit') : {};

    return this.request({
      api: 'conversation',
      resource: 'conversations/left',
      qs: options
    })
      .then(function processResponse(res) {
        var items = res.body.items || [];

        return items;
      })
      .then(this.inboundNormalizer.normalize.bind(this.inboundNormalizer));
  },

  /**
   * Requests activities for a conversation
   * @param {Object} options
   * @param {string} options.conversationId
   * @param {boolean} options.mentions activities in which the user was mentioned are fetch if true
   * @param {string} options.sinceDate activities with published date after this date
   * @param {string} options.maxDate activities with published date before this date
   * @param {number} options.limit Max number of activities to return
   * @returns {Promise} Resolves with an array of Activity items with the beginning with the most recent item
   */
  getActivities: function getActivities(options) {
    options = options || {};

    var params = {
      api: 'conversation',
      resource: (options.mentions) ? 'mentions' : 'activities',
      qs: {
        personRefresh: true,
        uuidEntryFormat: true
      }
    };

    assign(params.qs, pick(options, 'lastActivityFirst', 'conversationId', 'sinceDate', 'maxDate', 'limit', 'midDate'));

    return this.request(params)
      .then(function processResponse(res) {
        var items = res.body.items || [];
        if (items.length && last(items).published < items[0].published) {
          items.reverse();
        }

        return Promise.all(res.body.items.map(function processItem(activity) {
          return this.decrypter.decryptObject(activity, options)
            .then(this.inboundNormalizer.normalize.bind(this.inboundNormalizer));
        }.bind(this)))
          .then(resolveWith(res.body.items));
      }.bind(this));
  },

  // Verbs
  // -----

  /**
   * Acknowledges an activity
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} object activity to acknowledge
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  acknowledge: function acknowledge(conversation, object, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'acknowledge',
      target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
        objectType: 'conversation'
      }),
      object: defaults({}, pick(object, 'id', 'url', 'objectType'), {
        objectType: 'activity'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Adds a user to a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ParticipantObject} participant
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  add: function add(conversation, participant, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'add',
      target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
        objectType: 'conversation'
      }),
      object: defaults({}, pick(participant, 'id', 'objectType'), {
        objectType: 'person'
      }),
      kmsMessage: {
        method: 'create',
        uri: '/authorizations',
        resourceUri: '<KRO>',
        userIds: [
          participant.id
        ]
      }
    };

    return this._prepareActivity(activity, properties, options)
      .then(function ensureUUIDs(activity) {
        return Promise.all([
          this.spark.user.getUUID(activity.actor.id, {create: true}),
          this.spark.user.getUUID(activity.object.id, {create: true})
        ])
        .then(function applyUUIDs(uuids) {
          activity.actor.id = uuids[0];
          activity.object.id = uuids[1];
          activity.kmsMessage.userIds[0] = uuids[1];
          return activity;
        }.bind(this));
      }.bind(this))
      .then(function callEncryptActivity(activity) {
        return this._encryptActivity(activity, conversation.defaultActivityEncryptionKeyUrl);
      }.bind(this))
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this))
      .then(this.decrypter.decryptObject.bind(this.decrypter));
  },

  /**
   * Assigns an avatar to a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ContentObject} object
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  assign: function assign(conversation, object, activity, options) {
    activity = activity || {};
    return this.createAssignActivity(conversation, activity)
      .then(function uploadFiles(assignActivity) {
        activity = assignActivity;
        return Promise.all(object.files.items.map(function uploadFile(file) {
          return activity.addAvatarFile(file);
        }, this));
      }.bind(this))
      .then(function callPrepareActivity() {
        return this._prepareActivity(activity, activity.object);
      }.bind(this))
      .then(function callSubmitActivity(preppedAct) {
        if (!preppedAct.object.files || !preppedAct.object.files.items.length) {
          return Promise.reject(new Error('`activity.object.files` or `activity.object.files.items` is required'));
        }

        if (preppedAct.object.files.items.length !== 1) {
          return Promise.reject(new Error('only one file item is supported'));
        }

        if (preppedAct.object.files.items[0].fileSize > 1024*1024) {
          return Promise.reject(new Error('`activity.object.files[0].fileSize` must be less than 1mb'));
        }

        if (preppedAct.object.contentCategory !== 'images') {
          return Promise.reject(new Error('`activity.object.contentCategory` must be `images`'));
        }

        return this._submitContentActivity(conversation, activity.object, preppedAct, options);
      }.bind(this));
  },

  /**
   * Unassigns an avatar from a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ContentObject} object
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  unassign: function unassign(conversation, object, activity, options) {
    var properties = {
      verb: 'unassign',
      target: defaults({}, pick(conversation, 'id', 'objectType'), {
        objectType: 'conversation'
      }),
      object: defaults({}, pick(object, 'objectType'), {
        objectType: 'content',
        files: {
          items: []
        }
      })
    };

    return this._prepareActivity(activity, properties)
      .then(function callSubmitActivity(preparedActivity) {
        preparedActivity.object.files.items = [];
        return this._submitActivity(preparedActivity, options);
      }.bind(this));
  },

  /**
   * Assign a moderator to a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ParticipantObject} participant (if not specified, current user will be assigned as a moderator)
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @return {Promise} Resolves with the created activity
   */
  assignModerator: function assignModerator(conversation, participant, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    if (!participant) {
      participant = {
        id: this.spark.device.userId
      };
    }

    if (!isObject(participant)) {
      participant = {
        id: participant
      };
    }

    var properties = {
      verb: 'assignModerator',
      target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
        objectType: 'conversation'
      }),
      object: defaults({}, pick(participant, 'id', 'objectType'), {
        objectType: 'person'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Creates a new conversation
   * @param {NewConversationObject} protoConversation
   * @param {Object} options
   * @param {Object} options.forceGrouped set to true to create a grouped
   * conversation with only one other user
   * @returns {Promise} Resolves with the created conversation
   */
  create: function create(protoConversation, options) {
    options = options || {};

    if (!protoConversation.participants) {
      return Promise.reject(new Error('`conversation.participants` is required'));
    }

    if (protoConversation.participants.length === 0) {
      return Promise.reject(new Error('`conversation.participants` cannot be empty'));
    }

    return this._ensureCreatableUsers(protoConversation, options)
      .then(function _create(protoConversation) {
        // We've already guaranteed that the current user has been added to the
        // participants list, so any valid 1:1 will have exactly two
        // participants (or, if it has only one participant, that error will be
        // detected in _maybeCreateOneOnOneThenPost()).
        if (protoConversation.participants.length < 3 && !options.forceGrouped) {
          return this._maybeCreateOneOnOneThenPost(protoConversation, options);
        }
        else {
          return this._createGrouped(protoConversation, options);
        }
      }.bind(this))
      .then(function shareFiles(conversation) {
        var files = protoConversation.files;
        if (!files || files.length === 0) {
          return conversation;
        }

        return this.share(conversation, {
          displayName: protoConversation.comment,
          files: files
        })
          .then(function attachActivity(activity) {
            conversation.activities.items.push(activity);
            return conversation;
          });
      }.bind(this));
  },

  _create: function _create(payload, options) {
    return this._encryptConversation(payload)
      .then(function submitConversation(payload) {
        return this.request({
          method: 'POST',
          api: 'conversation',
          resource: 'conversations',
          qs: pick(options, 'compact', 'latestActivity', 'participantAckFilter'),
          body: payload
        });
      }.bind(this))
      .then(function decryptBody(res) {
        return this.decrypter.decryptObject(res.body);
      }.bind(this));
  },

  _ensureCreatableUsers: function _ensureCreatableUsers(protoConversation) {
    return this.spark.user.getUUID(protoConversation.participants, {create: true})
      .then(function pruneParticipants(participants) {
        return participants.map(function pruneParticipants(participant) {
          return participant.id || participant.entryUUID || participant.email || participant.emailAddress || participant.entryEmail || participant;
        });
      })
      .then(function filterParticipants(participants) {
        participants.push(this.spark.device.userId);
        protoConversation.participants = uniq(participants);

        return protoConversation;
      }.bind(this));
  },

  _maybeCreateOneOnOneThenPost: function _maybeCreateOneOnOneThenPost(protoConversation, options) {
    if (protoConversation.participants.length === 1 && protoConversation.participants[0] === this.spark.device.userId) {
      return Promise.reject(new Error('cannot create conversation with self as only participant'));
    }

    return this.get(defaults({
      user: protoConversation.participants[0]
    }, options))
      // we only want to post a comment if the conversation exists...
      .then(function postComment(conversation) {
        if (protoConversation.comment && !protoConversation.files) {
          // TODO allow conversation.comment to be an object (and therefore
          // support mentions).
          return this.post(conversation, {displayName: protoConversation.comment})
            .then(function attachActivity(activity) {
              conversation.activities.items.push(activity);
              return conversation;
            });
        }

        return conversation;
      }.bind(this))
      // ...otherwise, it'll be part of the create payload.
      .catch(function createConveration(res) {
        if (res.statusCode !== 404) {
          return Promise.reject(res);
        }

        var conversation = this._prepareConversation(protoConversation);
        conversation.tags = ['ONE_ON_ONE'];
        return this._create(conversation, options);
      }.bind(this));
  },

  _createGrouped: function _createGrouped(protoConversation, options) {
    return this._create(this._prepareConversation(protoConversation), options);
  },

  _prepareConversation: function _prepareConversation(protoConversation) {
    var payload = {
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

    if (protoConversation.displayName) {
      payload.displayName = protoConversation.displayName;
    }

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

    // Create a post activity if we have a comment but no files.
    // If both are provided, a share activity will be created after
    // the creation of the conversation.
    if (protoConversation.comment && (!protoConversation.files || protoConversation.files.length === 0)) {
      payload.activities.items.push({
        verb: 'post',
        objectType: 'activity',
        object: {
          objectType: 'comment',
          displayName: protoConversation.comment
        },
        actor: {
          objectType: 'person',
          id: this.spark.device.userId
        }
      });
    }

    assign(payload, {
      kmsMessage: {
        method: 'create',
        uri: '/resources',
        userIds: protoConversation.participants,
        keyUris: []
      }
    });

    return payload;
  },

  /**
   * Deletes an activity
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} object activity to delete
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  delete: function deleteContent(conversation, object, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'delete',
      target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
        objectType: 'conversation'
      }),
      object: defaults({}, pick(object, 'id', 'url', 'objectType'), {
        objectType: 'activity'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Favorites a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  favorite: function favorite(conversation, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'favorite',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Hide a conversation of the current user
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  hide: function hide(conversation, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'hide',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Kicks a user from or leaves the current this._ Note: arguments are
   * positional: to include `activity`, you must include a null `participant`.
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ParticipantObject} participant  (optional) if not specified, the current user will leave the conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  leave: function leave(conversation, participant, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    if (!participant) {
      participant = {
        id: this.spark.device.userId
      };
    }

    if (!isObject(participant)) {
      participant = {
        id: participant
      };
    }

    var properties = {
      verb: 'leave',
      target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
        objectType: 'conversation'
      }),
      object: defaults({}, pick(participant, 'id', 'objectType'), {
        objectType: 'person'
      }),
      kmsMessage: {
        method: 'delete',
        uri: '<KRO>/authorizations?' + querystring.stringify({
          authId: participant.id
        })
      }
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callEncryptActivity(activity) {
        return this._encryptActivity(cloneDeep(activity), conversation.defaultActivityEncryptionKeyUrl)
          .then(function callSubmitActivity(activity) {
            return this._submitActivity(activity, options);
          }.bind(this));
      }.bind(this))
      .then(this.decrypter.decryptObject.bind(this.decrypter));
  },

  /**
   * Lock a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @return {Promise} Resolves with the created activity
   */
  lock: function lock(conversation, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'lock',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Mutes a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  mute: function mute(conversation, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'mute',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Mutes the messages of a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  muteMessages: function muteMessages(conversation, activity, options) {
    return this.tag(conversation,  {tags: ['MESSAGE_NOTIFICATIONS_OFF']}, activity, options);
  },

  /**
   * Mutes the messages of a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  unmuteMessages: function unmuteMessages(conversation, activity, options) {
    return this.tag(conversation, {tags: ['MESSAGE_NOTIFICATIONS_ON']}, activity, options);
  },

  /**
   * Mutes the mentions of a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  muteMentions: function muteMentions(conversation, activity, options) {
    return this.tag(conversation, {tags: ['MENTION_NOTIFICATIONS_OFF']}, activity, options);
  },

  /**
   * Mutes the mentions of a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  unmuteMentions: function unmuteMentions(conversation, activity, options) {
    return this.tag(conversation, {tags: ['MENTION_NOTIFICATIONS_ON']}, activity, options);
  },

  /**
   * Prepares the Tag property to make it easier to call
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~CommentObject} object
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created property
   */
  tag: function tag(conversation, object, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var property = {
      verb: 'tag',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        tags: object.tags,
        objectType: 'conversation'
      }),
      target: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, property, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Prepares the Untag property to make it easier to call
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~CommentObject} object
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created property
   */
  untag: function untag(conversation, object, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var property =  {
      verb: 'untag',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        tags: object.tags,
        objectType: 'conversation'
      }),
      target: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, property, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Removes all mute-related tags
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  removeAllMuteTags: function removeAllMuteTags(conversation, activity, options) {
    return this.untag(conversation, {tags: ['MENTION_NOTIFICATIONS_OFF', 'MENTION_NOTIFICATIONS_ON', 'MESSAGE_NOTIFICATIONS_OFF', 'MESSAGE_NOTIFICATIONS_ON']}, activity, options);
  },

  /**
   * Posts a comment to a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~CommentObject} object
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  post: function post(conversation, object, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties;
    if (object.objectType === 'imageURI') {
      properties = {
        verb: 'post',
        target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
          objectType: 'conversation'
        }),
        object: defaults({}, pick(object, 'location', 'objectType'), {
          objectType: 'imageURI'
        })
      };
    }
    else {
      properties = {
        verb: 'post',
        target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
          objectType: 'conversation'
        }),
        object: defaults({}, pick(object, 'displayName', 'objectType', 'content', 'mentions'), {
          objectType: 'comment'
        })
      };
    }

    return this._prepareActivity(activity, properties, options)
      .then(function normalize(activity) {
        return this.outboundNormalizer.normalize(activity);
      }.bind(this))
      .then(function callEncryptActivity(activity) {
        object.displayName = activity.object.displayName;
        object.content = activity.object.content;
        object.location  = activity.object.location;
        return this._encryptActivity(cloneDeep(activity), conversation.defaultActivityEncryptionKeyUrl);
      }.bind(this))
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this))
      .then(function unencryptProperties(activity) {
        if (this.config.keepEncryptedProperties) {
          activity.object.encryptedDisplayName = activity.object.displayName;
          activity.object.encryptedContent = activity.object.content;
          activity.object.encryptedLocation = activity.object.location;
        }
        activity.object.displayName = object.displayName;
        activity.object.content = object.content;
        activity.object.location  = object.location;
        return activity;
      }.bind(this));
  },

  /**
   * Prepares an activity to be use the ShareActivity interface by
   * decorating it with methods for uploading files.
   * @param {Conversation~ConversationObect} conversation
   * @param {Conversation~ActivityObject} activity that will be be converted to
   * a {@link Conversation.ShareActivity}.
   * @return {Promise} Resolves with {@link <Conversation.ShareActivity>}
   */
  createShareActivity: function prepare(conversation, activity) {
    conversation = this._inferConversationUrl(conversation);

    var props = defaults({
      target: conversation,
      verb: 'share'
    }, omit(activity, 'target'));

    activity = new ShareActivity(props, {
      parent: this.parent,
      parse: true
    });

    return Promise.resolve(activity);
  },

  createAssignActivity: function prepare(conversation, activity) {
    conversation = this._inferConversationUrl(conversation);

    var props = defaults({
      target: defaults({}, pick(conversation, 'id', 'objectType', 'url'), {
        objectType: 'conversation'
      }),
      verb: 'assign'
    }, omit(activity, 'target'));

    activity = new ShareActivity(props, {
      parent: this.parent,
      parse: true
    });

    return Promise.resolve(activity);
  },

  /**
   * Shares a file or files to a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ContentObject} object
   * @param {Conversation~ShareActivity} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  share: function share(conversation, object, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    if (this.encryptionDisabled) {
      throw new Error('At this time, encryption cannot be disabled for the share activity');
    }

    activity = activity || {};
    var promise;
    if (!isFunction(activity.prepare)) {
      if (!object.files || !object.files.length) {
        return Promise.reject(new Error('`object.files` is required'));
      }

      promise = this.createShareActivity(conversation, activity)
        .then(function uploadFiles(shareActivity) {
          activity = shareActivity;

          return Promise.all(object.files.map(function uploadFile(file) {
            return activity.addFile(file);
          }, this))
          .then(function callPrepareActivity() {
            return this._prepareActivity(activity, object);
          }.bind(this));
        }.bind(this));
    }

    else if (conversation.url !== activity.target.url) {
      throw new Error('Cannot share to a different conversation than ShareActivity target');
    }
    else {
      promise = this._prepareActivity(activity, object);
    }

    return promise
      .then(function callSubmitActivity(activity) {
        return this._submitContentActivity(conversation, object, activity, options);
      }.bind(this));
  },

  _submitContentActivity: function _submitContentActivity(conversation, object, activity, options) {
    return this.outboundNormalizer.normalize(activity)
      .then(function prepareEncryption(preppedAct) {
        activity = preppedAct;
        object.displayName = activity.object.displayName;
        object.content = activity.object.content;
        object.location  = activity.object.location;
        var items = preppedAct.object.files.items;
        var displayNames = pluck(items, 'displayName');
        var scrs = pluck(items, 'scr');

        // Need to use an object because not every item has a thumbnailScr (there may be holes).
        var thumbnailScrs = reduce(items, function saveThumbnailScr(thumbnailScrs, item, index) {
          if (item.image && item.image.scr) {
            thumbnailScrs[index] = item.image.scr;
          }
          return thumbnailScrs;
        }, {});

        activity = cloneDeep(activity);

        // After doing a cloneDeep, we need to restore the SCRs; cloneDeep
        // clones them as an object instead of an instance
        for (var i = 0; i < activity.object.files.items.length; i++) {
          activity.object.files.items[i].scr = scrs[i];
          if (thumbnailScrs[i]) {
            activity.object.files.items[i].image.scr = thumbnailScrs[i];
          }
        }
        return this._encryptActivity(activity, conversation.defaultActivityEncryptionKeyUrl)
          .then(function callSubmitActivity(activity) {
            return this._submitActivity(activity, options);
          }.bind(this))
          .then(function unencryptProperties(activity) {
            for (var i = 0; i < activity.object.files.items.length; i++) {
              if (this.config.keepEncryptedProperties) {
                activity.object.files.items[i].encryptedDisplayName = activity.object.files.items[i].displayName;
                activity.object.files.items[i].encryptedScr = activity.object.files.items[i].scr;
              }

              activity.object.files.items[i].displayName = displayNames[i];
              activity.object.files.items[i].scr = scrs[i];

              if (thumbnailScrs[i]) {
                activity.object.files.items[i].image.scr = thumbnailScrs[i];
              }
            }

            if (this.config.keepEncryptedProperties) {
              activity.object.encryptedDisplayName = activity.object.displayName;
              activity.object.encryptedContent = activity.object.content;
            }

            activity.object.displayName = preppedAct.object.displayName;
            activity.object.content = preppedAct.object.content;

            return activity;
          }.bind(this));
      }.bind(this));
  },

  /**
   * Unassign a moderator of a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ParticipantObject} participant (if not specified, current user will be unassigned as a moderator)
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @return {Promise} Resolves with the created activity
   */
  unassignModerator: function unassignModerator(conversation, participant, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    if (!participant) {
      participant = {
        id: this.spark.device.userId
      };
    }

    if (!isObject(participant)) {
      participant = {
        id: participant
      };
    }

    var properties = {
      verb: 'unassignModerator',
      target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
        objectType: 'conversation'
      }),
      object: defaults({}, pick(participant, 'id', 'objectType'), {
        objectType: 'person'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Unfavorites a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  unfavorite: function unfavorite(conversation, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'unfavorite',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Unhide a conversation of the current user
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  unhide: function unhide(conversation, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'unhide',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Unlock a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @return {Promise} Resolves with the created activity
   */
  unlock: function unlock(conversation, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'unlock',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Unmutes a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  unmute: function unmute(conversation, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'unmute',
      object: defaults({}, pick(conversation, 'id', 'url', 'objectType'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this));
  },

  /**
   * Renames a conversation
   * @param {Conversation~NamedConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  update: function update(conversation, activity, options) {
    conversation = this._inferConversationUrl(conversation);

    var properties = {
      verb: 'update',
      target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
        objectType: 'conversation'
      }),
      object: defaults({}, pick(conversation, 'objectType', 'displayName', 'summary'), {
        objectType: 'conversation'
      })
    };

    return this._prepareActivity(activity, properties, options)
      .then(function callEncryptActivity(activity) {
        return this._encryptActivity(cloneDeep(activity), conversation.defaultActivityEncryptionKeyUrl);
      }.bind(this))
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this))
      .then(function unenecryptProperties(activity) {
        if (this.config.keepEncryptedProperties) {
          activity.object.encryptedDisplayName = activity.object.displayName;
          conversation.encryptedDisplayName = activity.object.encryptedDisplayName;
        }

        activity.object.displayName = conversation.displayName;

        return activity;
      }.bind(this));
  },

  /**
   * Changes the conversations encryption key
   * @param {Conversation~ConversationObject} conversation
   * @param {Encryption~Key|string} key          (optional) if omitted, the next
   * unused key will be used (recommended)
   * @param {Conversation~ActivityObject} activity
   * @param {Object} options
   * @returns {Promise} Resolves with the created activity
   */
  updateKey: function updateKey(conversation, key, activity, options) {
    options = options || {};
    conversation = this._inferConversationUrl(conversation);
    return this.get({
      url: conversation.url,
      activitiesLimit: 0
    })
      .then(function doKeyUpdate(conversation) {
        return this._updateKey(conversation, key, activity, options);
      }.bind(this));
  },

  _updateKey: function _updateKey(conversation, key, activity, options) {
    // TODO consider proactively retrieving conversation participants
    if (!conversation.participants && !options.allowEmptyParticipants) {
      throw new Error('`conversation.participants` is required');
    }

    var properties = {
      verb: 'updateKey',
      target: defaults({}, pick(conversation, 'id', 'kmsResourceObjectUrl', 'url', 'objectType'), {
        objectType: 'conversation'
      }),
      object: defaults({}, pick(conversation, 'objectType'), {
        objectType: 'conversation'
      })
    };

    if (conversation.defaultActivityEncryptionKeyUrl) {
      properties.kmsMessage = {
        method: 'update',
        resourceUri: '<KRO>',
        uri: '<KEYURL>'
      };
    }
    else {
      properties.kmsMessage = {
        method: 'create',
        uri: '/resources',
        userIds: pluck(conversation.participants.items, 'id'),
        keyUris: []
      };
    }

    return this._prepareActivity(activity, properties, options)
      .then(function getKey(activity) {
        return Promise.resolve(key || this.spark.encryption.getUnusedKey())
          .then(function assignDefaultActivityEncryptionKeyUrl(key) {
            properties.object.defaultActivityEncryptionKeyUrl = activity.object.defaultActivityEncryptionKeyUrl = key.keyUrl;
            return this._encryptActivity(activity, key);
          }.bind(this));
      }.bind(this))
      .then(function callSubmitActivity(activity) {
        return this._submitActivity(activity, options);
      }.bind(this))
      .then(this.decrypter.decryptObject.bind(this.decrypter));
  },

  /**
   * Encrypts a conversation object and its activities
   * @param {Object} conversation
   * @private
   * @returns {Promise} Resolves when the conversation has been encrypted
   */
  _encryptConversation: function _encryptConversation(conversation) {
    if (this.encryptionDisabled) {
      return Promise.resolve(conversation);
    }

    return this.encrypter.encryptObject(conversation);
  },

  _encryptActivity: function _encryptActivity(activity, key) {
    if (this.encryptionDisabled) {
      return Promise.resolve(activity);
    }

    return this.encrypter.encryptObject(activity, key);
  },

  /**
   * Iterates over a conversation's participants array and records the email
   * address to uuid mapping
   * @param {Object} conversation
   * @returns {Promise} Resolves when the mapping is complete
   * @private
   */
  _recordUUIDs: function _recordUUIDs(conversation) {
    if (!conversation.participants || !conversation.participants.items) {
      return Promise.resolve(conversation);
    }

    return Promise.all(conversation.participants.items.map(function processItem(participant) {
      return new Promise(function executor(resolve) {
        // I'm on the fence as to whether nextTick belongs here or in recordUUID
        process.nextTick(function resolveOnNextTick() {
          // Suppress errors. We can't assume participants will have an email
          // address
          resolve(this.spark.user.recordUUID(participant).catch(noop));
        }.bind(this));
      }.bind(this));
    }.bind(this)))
      .then(resolveWith(conversation));
  },

  /**
   * Posts an activity to the /activities endpoint
   * @param {Object} activity
   * @returns {Promise}
   * @private
   */
  _submitActivity: function _submitActivity(activity, options) {
    if (activity.published && !(options && options.includePublished)) {
      // Filter out any properties that begin wth an underscore
      activity = omit(activity, function omitPrivateKeys(value, key) {
        return key.indexOf('_') === 0;
      });
      // This is a stopgap to avoid sending displayNameHTML over the wire.
      // The long-term solution will involve using the Cloudapps DTOs to
      // whitelist properties.
      activity.object = omit(activity.object, 'displayNameHTML', 'displayNameHtml');
      delete activity.published;
    }

    var params = {
      method: 'POST',
      api: 'conversation',
      resource: (activity.verb === 'share') ? 'content' : 'activities',
      body: activity,
      qs: {
        personRefresh: true
      }
    };

    if (activity.verb === 'share') {
      assign(params.qs, {
        transcode: true,
        async: false
      });
    }

    return this.request(params)
      .then(function processResponse(res) {
        this.trigger('activity:sent');
        return this.outboundNormalizer.normalize(res.body);
      }.bind(this));
  },

  /**
   * Ensures an activity has all the requisite parameters
   * @param {Object} activity
   * @param {Object} properties
   * @returns {Promise}
   * @private
   */
  _prepareActivity: function _prepareActivity(activity, properties) {
    activity = activity || {};

    if (!activity.verb && !properties.verb) {
      throw new Error('`activity.verb` or `properties.verb` is required');
    }

    var promise;
    if (isFunction(activity.prepare)) {
      promise = activity.prepare(properties);
    }
    else {
      promise = Promise.resolve(activity);
    }

    return promise
      .then(function completePreparation(activity) {
        activity.clientTempId = activity.clientTempId || uuid.v4();
        // Make sure the activity's objectType is always defined (needed for
        // Encrypter).
        defaults(activity, {
          objectType: 'activity',
          verb: properties.verb
        });

        activity.actor = defaults(activity.actor || {}, {
          objectType: 'person',
          id: this.spark.device.userId
        });

        activity.kmsMessage = properties.kmsMessage;

        // Need to use lodash.forEach because array.forEach was having weird side
        // effects
        forEach(['object', 'actor'], function assignDefaults(key) {
          if (properties[key]) {
            activity[key] = activity[key] || {};
            defaults(activity[key], properties[key]);
          }
        });

        if (properties.target) {
          merge(activity, {
            target: pick(properties.target, 'id', 'url', 'objectType', 'kmsResourceObjectUrl')
          });
        }

        // Infer id until cloudapps uses urls correctly
        forEach(['object', 'target'], function inferIds(key) {
          if (activity[key] && activity[key].url && !activity[key].id) {
            activity[key].id = activity[key].url.split('/').pop();
          }
        });

        forEach(['actor', 'object', 'target'], function requireActivityObject(key) {
          if (activity[key] && !activity[key].objectType) {
            // Note: we need to throw this instead of returning a rejected
            // promise in order to escape the loop with the error (or refactor a
            // lot more of this method).
            throw new Error('`activity.' + key + '.objectType` must be defined');
          }
        });

        if (activity.object && activity.object.content && !activity.object.displayName) {
          return Promise.reject(new Error('Cannot submit activity object with `content` but no `displayName`'));
        }

        return activity;
      }.bind(this));
  },

  _inferConversationUrl: function _inferConversationUrl(conversation) {
    if (!conversation.url && conversation.id) {
      conversation.url = this.spark.device.getServiceUrl('conversation') + '/conversations/' + conversation.id;
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn('conversation: inferred conversation url from conversation id; please pass whole conversation objects to Conversation methods');
      }
    }

    return conversation;
  }
});

module.exports = ConversationService;
