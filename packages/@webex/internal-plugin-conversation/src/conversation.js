/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import querystring from 'querystring';
import {EventEmitter} from 'events';

import hmacSHA256 from 'crypto-js/hmac-sha256';
import hex from 'crypto-js/enc-hex';
import {proxyEvents, tap} from '@webex/common';
import {Page, WebexPlugin} from '@webex/webex-core';
import {
  cloneDeep,
  cloneDeepWith,
  defaults,
  isArray,
  isObject,
  isString,
  last,
  map,
  merge,
  omit,
  pick,
  uniq,
} from 'lodash';
import {readExifData} from '@webex/helper-image';
import uuid from 'uuid';

import {InvalidUserCreation} from './convo-error';
import ShareActivity from './share-activity';
import {
  minBatchSize,
  defaultMinDisplayableActivities,
  getLoopCounterFailsafe,
  batchSizeIncrementCount,
  getActivityObjectsFromMap,
  bookendManager,
  noMoreActivitiesManager,
  getQuery,
  rootActivityManager,
  activityManager,
} from './activity-thread-ordering';
import {
  ACTIVITY_TYPES,
  getActivityType,
  isDeleteActivity,
  getIsActivityOrphaned,
  determineActivityType,
  createRootActivity,
  createReplyActivity,
  createEditActivity,
  createReplyEditActivity,
  OLDER,
  MID,
  INITIAL,
  NEWER,
  getPublishedDate,
  sortActivitiesByPublishedDate,
  sanitizeActivity,
} from './activities';
import {ENCRYPTION_KEY_URL_MISMATCH, KEY_ALREADY_ROTATED, KEY_ROTATION_REQUIRED} from './constants';

const idToUrl = new Map();

const getConvoLimit = (options = {}) => {
  let limit;

  if (options.conversationsLimit) {
    limit = {
      value: options.conversationsLimit,
      name: 'conversationsLimit',
    };
  }

  return limit;
};

const Conversation = WebexPlugin.extend({
  namespace: 'Conversation',

  /**
   * @param {String} cluster the cluster containing the id
   * @param {UUID} [id] the id of the conversation.
   *  If empty, just return the base URL.
   * @returns {String} url of the conversation
   */
  getUrlFromClusterId({cluster = 'us', id} = {}) {
    const url = this.webex.internal.services.getServiceUrlFromClusterId(
      {
        cluster,
      },
      this.webex
    );

    return id ? `${url}/conversations/${id}` : url;
  },

  /**
   * @param {Object} conversation
   * @param {Object} object
   * @param {Object} activity
   * @returns {Promise}
   */
  acknowledge(conversation, object, activity) {
    const url = this.getConvoUrl(conversation);
    const convoWithUrl = {...conversation, url};

    if (!isObject(object)) {
      return Promise.reject(new Error('`object` must be an object'));
    }

    return this.prepare(activity, {
      verb: 'acknowledge',
      target: this.prepareConversation(convoWithUrl),
      object: {
        objectType: 'activity',
        id: object.id,
        url: object.url,
      },
    }).then((a) => this.submit(a));
  },

  /**
   * Adds a participant to a conversation
   * @param {Object} conversation
   * @param {Object|string} participant
   * @param {Object} activity Reference to the activity that will eventually be
   * posted. Use this to (a) pass in e.g. clientTempId and (b) render a
   * provisional activity
   * @returns {Promise<Activity>}
   */
  add(conversation, participant, activity) {
    const url = this.getConvoUrl(conversation);
    const convoWithUrl = {...conversation, url};

    return this.webex.internal.user.asUUID(participant, {create: true}).then((id) =>
      this.prepare(activity, {
        verb: 'add',
        target: this.prepareConversation(convoWithUrl),
        object: {
          id,
          objectType: 'person',
        },
        kmsMessage: {
          method: 'create',
          uri: '/authorizations',
          resourceUri: '<KRO>',
          userIds: [id],
        },
      }).then((a) => this.submit(a))
    );
  },

  /**
   * Creates a conversation
   * @param {Object} params
   * @param {Array<Participant>} params.participants
   * @param {Array<File>} params.files
   * @param {string} params.comment
   * @param {string} params.html
   * @param {Object} params.displayName
   * @param {string} params.classificationId
   * @param {string} params.effectiveDate
   * @param {Boolean} params.isDefaultClassification
   * @param {Array<string>} params.tags
   * @param {Boolean} params.favorite
   * @param {Object} options
   * @param {Boolean} options.allowPartialCreation
   * @param {Boolean} options.forceGrouped
   * @param {Boolean} options.skipOneOnOneFetch skips checking 1:1 exists before creating conversation
   * @returns {Promise<Conversation>}
   */
  create(params, options = {}) {
    if (!params.participants || params.participants.length === 0) {
      return Promise.reject(new Error('`params.participants` is required'));
    }

    return Promise.all(
      params.participants.map((participant) =>
        this.webex.internal.user
          .asUUID(participant, {create: true})
          // eslint-disable-next-line arrow-body-style
          .catch((err) => {
            return options.allowPartialCreation ? undefined : Promise.reject(err);
          })
      )
    )
      .then((participants) => {
        participants.unshift(this.webex.internal.device.userId);
        participants = uniq(participants);

        const validParticipants = participants.filter((participant) => participant);

        params.participants = validParticipants;

        // check if original participants list was to create a 1:1
        if (participants.length === 2 && !(options && options.forceGrouped)) {
          if (!params.participants[1]) {
            return Promise.reject(new InvalidUserCreation());
          }

          if (options.skipOneOnOneFetch) {
            return this._createOneOnOne(params);
          }

          return this._maybeCreateOneOnOneThenPost(params, options);
        }

        return this._createGrouped(params, options);
      })
      .then((c) => {
        idToUrl.set(c.id, c.url);

        if (!params.files) {
          return c;
        }

        return this.webex.internal.conversation.share(c, params.files).then((a) => {
          c.activities.items.push(a);

          return c;
        });
      });
  },

  /**
   * @private
   * generate a deterministic HMAC for a reaction
   * @param {Object} displayName displayName of reaction we are sending
   * @param {Object} parent parent activity of reaction
   * @returns {Promise<HMAC>}
   */
  createReactionHmac(displayName, parent) {
    // not using webex.internal.encryption.getKey() because the JWK it returns does not have a 'k'
    // property. we need jwk.k to correctly generate the HMAC

    return this.webex.internal.encryption.unboundedStorage
      .get(parent.encryptionKeyUrl)
      .then((keyString) => {
        const key = JSON.parse(keyString);
        // when we stringify this object, keys must be in this order to generate same HMAC as
        // desktop clients
        const formatjwk = {k: key.jwk.k, kid: key.jwk.kid, kty: key.jwk.kty};

        const source = `${JSON.stringify(formatjwk)}${parent.id}${displayName}`;

        const hmac = hex.stringify(hmacSHA256(source, parent.id));

        return Promise.resolve(hmac);
      });
  },

  /**
   * @typedef {Object} ReactionPayload
   * @property {Object} actor
   * @property {string} actor.objectType
   * @property {string} actor.id
   * @property {string} objectType
   * @property {string} verb will be either add' or 'delete'
   * @property {Object} target
   * @property {string} target.id
   * @property {string} target.objectType
   * @property {Object} object this will change on delete vs. add
   * @property {string} object.id present in delete case
   * @property {string} object.objectType 'activity' in delete case, 'reaction2' in add case
   * @property {string} object.displayName must be 'celebrate', 'heart', 'thumbsup', 'smiley', 'haha', 'confused', 'sad'
   * @property {string} object.hmac
   */

  /**
   * @private
   * send add or delete reaction to convo service
   * @param {Object} conversation
   * The payload to send a reaction
   * @param {ReactionPayload} reactionPayload
   * @returns {Promise<Activity>}
   */
  sendReaction(conversation, reactionPayload) {
    const url = this.getConvoUrl(conversation);
    const convoWithUrl = {...conversation, url};

    if (!isObject(reactionPayload)) {
      return Promise.reject(new Error('`object` must be an object'));
    }

    return this.prepare(reactionPayload, {
      target: this.prepareConversation(convoWithUrl),
      object: pick(reactionPayload, 'id', 'url', 'objectType'),
    }).then((act) => this.submit(act));
  },

  /**
   * delete a reaction
   * @param {Object} conversation
   * @param {Object} reactionId
   * @returns {Promise<Activity>}
   */
  deleteReaction(conversation, reactionId) {
    const deleteReactionPayload = {
      actor: {objectType: 'person', id: this.webex.internal.device.userId},
      object: {
        id: reactionId,
        objectType: 'activity',
      },
      objectType: 'activity',
      target: {
        id: conversation.id,
        objectType: 'conversation',
      },
      verb: 'delete',
    };

    return this.sendReaction(conversation, deleteReactionPayload);
  },

  /**
   * create a reaction
   * @param {Object} conversation
   * @param {Object} displayName must be 'celebrate', 'heart', 'thumbsup', 'smiley', 'haha', 'confused', 'sad'
   * @param {Object} activity activity object from convo we are reacting to
   * @returns {Promise<Activity>}
   */
  addReaction(conversation, displayName, activity) {
    return this.createReactionHmac(displayName, activity).then((hmac) => {
      const addReactionPayload = {
        actor: {objectType: 'person', id: this.webex.internal.device.userId},
        target: {
          id: conversation.id,
          objectType: 'conversation',
        },
        verb: 'add',
        objectType: 'activity',
        parent: {
          type: 'reaction',
          id: activity.id,
        },
        object: {
          objectType: 'reaction2',
          displayName,
          hmac,
        },
      };

      return this.sendReaction(conversation, addReactionPayload);
    });
  },

  /**
   * delete content
   * @param {Object} conversation
   * @param {Object} object
   * @param {Object} activity
   * @returns {Promise}
   */
  delete(conversation, object, activity) {
    const url = this.getConvoUrl(conversation);
    const convoWithUrl = {...conversation, url};

    if (!isObject(object)) {
      return Promise.reject(new Error('`object` must be an object'));
    }

    const request = {
      verb: 'delete',
      target: this.prepareConversation(convoWithUrl),
      object: pick(object, 'id', 'url', 'objectType'),
    };

    // Deleting meeting container requires KMS message
    if (object.object.objectType === 'meetingContainer') {
      // It's building a string uri + "/authorizations?authId=" + id, where uri is the meeting container's KRO URL, and id is the conversation's KRO URL.
      request.target.kmsResourceObjectUrl = object.object.kmsResourceObjectUrl;
      request.kmsMessage = {
        method: 'delete',
        uri: `<KRO>/authorizations?${querystring.stringify({
          authId: convoWithUrl.kmsResourceObjectUrl,
        })}`,
      };
    }

    return this.prepare(activity, request).then((a) => this.submit(a));
  },

  /**
   * Downloads the file specified in item.scr or item.url
   * @param {Object} item
   * @param {Object} item.scr
   * @param {string} item.url
   * @param {Object} options
   * @param {Object} options.headers
   * @param {boolean} options.shouldNotAddExifData
   * @returns {Promise<File>}
   */
  download(item, options = {}) {
    const isEncrypted = Boolean(item.scr && item.scr.key);
    const shunt = new EventEmitter();
    let promise;

    if (isEncrypted) {
      promise = this.webex.internal.encryption.download(item.scr, item.options);
    } else if (item.scr && item.scr.loc) {
      promise = this._downloadUnencryptedFile(item.scr.loc, options);
    } else {
      promise = this._downloadUnencryptedFile(item.url, options);
    }

    promise = promise
      .on('progress', (...args) => shunt.emit('progress', ...args))
      .then((res) => {
        if (options.shouldNotAddExifData) {
          return res;
        }

        return readExifData(item, res);
      })
      .then((file) => {
        this.logger.info('conversation: file downloaded');

        if (item.displayName && !file.name) {
          file.name = item.displayName;
        }

        if (!file.type && item.mimeType) {
          file.type = item.mimeType;
        }

        return file;
      });

    proxyEvents(shunt, promise);

    return promise;
  },

  /**
   * Downloads an unencrypted file
   * @param {string} uri
   * @param {Object} options
   * @param {Object} options.headers
   * @returns {Promise<File>}
   */
  _downloadUnencryptedFile(uri, options = {}) {
    Object.assign(options, {
      uri,
      responseType: 'buffer',
    });

    const promise = this.request(options).then((res) => res.body);

    proxyEvents(options.download, promise);

    return promise;
  },

  /**
   * Helper method that expands a set of parameters into an activty object
   * @param {string} verb
   * @param {Object} object
   * @param {Object} target
   * @param {Object|string} actor
   * @returns {Object}
   */
  expand(verb, object, target, actor) {
    const activity = {
      actor,
      objectType: 'activity',
      verb,
    };

    if (!actor) {
      actor = this.webex.internal.device.userId;
    }

    if (isString(actor)) {
      activity.actor = {
        objectType: 'person',
        id: actor,
      };
    }

    if (object) {
      activity.object = object;
    }

    if (target) {
      activity.target = target;
    }

    return activity;
  },

  /**
   * Gets an array of activities with an array of activity URLS
   * @param {Array} activityUrls
   * @param {Object} options
   * @param {String} options.cluster cluster where the activities are located
   * @param {String} options.url base convo url where the activities are located
   * @returns {Promise<Object>} Resolves with the activities
   */
  bulkActivitiesFetch(activityUrls, options = {}) {
    let cluster;
    let url;

    if (typeof options === 'string') {
      cluster = options;
    } else {
      ({cluster, url} = options);
    }

    const resource = 'bulk_activities_fetch';
    const params = {
      method: 'POST',
      body: {
        activityUrls,
      },
    };

    if (url) {
      const uri = `${url}/${resource}`;

      Object.assign(params, {
        uri,
      });
    } else if (cluster) {
      const uri = `${this.getUrlFromClusterId({cluster})}/${resource}`;

      Object.assign(params, {
        uri,
      });
    } else {
      Object.assign(params, {
        api: 'conversation',
        resource,
      });
    }

    return this.webex.request(params).then((res) => {
      const activitiesArr = [];

      if (res.body.multistatus) {
        res.body.multistatus.forEach((statusData) => {
          if (statusData.status === '200' && statusData.data && statusData.data.activity) {
            activitiesArr.push(statusData.data.activity);
          }
        });
      }

      return activitiesArr;
    });
  },

  /**
   * Fetches a single conversation
   * @param {Object} conversation
   * @param {String} [conversation.url] The URL where the conversation is located.
   * @param {String|UUID} [conversation.user] The user to look up in the conversation service
   *   If specified, the user lookup will take precedence over the url lookup
   * @param {Object} options
   * @returns {Promise<Conversation>}
   */
  get(conversation, options = {}) {
    const {user} = conversation;
    let uri;

    try {
      uri = !user ? this.getConvoUrl(conversation) : '';
    } catch (err) {
      return Promise.reject(Error(err));
    }

    const params = {
      qs: {
        uuidEntryFormat: true,
        personRefresh: true,
        activitiesLimit: 0,
        includeConvWithDeletedUserUUID: false,
        includeParticipants: false,
        ...omit(options, 'id', 'user', 'url'),
      },
      disableTransform: options.disableTransform,
    };

    // Default behavior is to set includeParticipants=false,
    // which makes the payload lighter by removing participant info.
    // If the caller explicitly sets the participantAckFilter or
    // participantsLimit, we don't want that default setting.
    if ('participantAckFilter' in options || 'participantsLimit' in options) {
      delete params.qs.includeParticipants;
    }

    return Promise.resolve(user ? this.webex.internal.user.asUUID(user) : null)
      .then((userId) => {
        if (userId) {
          Object.assign(params, {
            service: 'conversation',
            resource: `conversations/user/${userId}`,
          });
        } else {
          params.uri = uri;
        }

        return this.request(params);
      })
      .then(
        tap(({body}) => {
          const {id, url} = body;

          this._recordUUIDs(body);
          idToUrl.set(id, url);
        })
      )
      .then((res) => res.body);
  },

  /**
   * Leaves the conversation or removes the specified user from the specified
   * conversation
   * @param {Object} conversation
   * @param {Object|string} participant If not specified, defaults to current
   * user
   * @param {Object} activity Reference to the activity that will eventually be
   * posted. Use this to (a) pass in e.g. clientTempId and (b) render a
   * provisional activity
   * @returns {Promise<Activity>}
   */
  leave(conversation, participant, activity) {
    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    return Promise.resolve()
      .then(() => {
        if (!participant) {
          participant = this.webex.internal.device.userId;
        }

        return this.webex.internal.user.asUUID(participant).then((id) =>
          this.prepare(activity, {
            verb: 'leave',
            target: this.prepareConversation(convoWithUrl),
            object: {
              id,
              objectType: 'person',
            },
            kmsMessage: {
              method: 'delete',
              uri: `<KRO>/authorizations?${querystring.stringify({authId: id})}`,
            },
          })
        );
      })
      .then((a) => this.submit(a));
  },

  /**
   * Lists a set of conversations. By default does not fetch activities or
   * participants
   * @param {Object} options
   * @param {boolean} options.summary - when true, use conversationSummary resource
   * @param {Number} options.conversationsLimit - limit the number of conversations fetched
   * @param {boolean} options.deferDecrypt - when true, deferDecrypt tells the
   * payload transformer to normalize (but not decrypt) each received
   * conversation. Instead, the received conversations will each have a bound
   * decrypt method that can be executed at the consumer's leisure
   * @returns {Promise<Array<Conversation>>}
   */
  list(options = {}) {
    return this._list({
      service: 'conversation',
      resource: options.summary ? 'conversationsSummary' : 'conversations',
      qs: omit(options, ['deferDecrypt', 'summary']),
      deferDecrypt: options.deferDecrypt,
      limit: getConvoLimit(options),
    }).then((results) => {
      for (const convo of results) {
        idToUrl.set(convo.id, convo.url);
      }

      return results;
    });
  },

  /**
   * Paginates through a set of conversations. By default does not fetch activities or
   * participants
   * @param {Object} options
   * @param {boolean} options.deferDecrypt - when true, deferDecrypt tells the
   * payload transformer to normalize (but not decrypt) each received
   * conversation. Instead, the received conversations will each have a bound
   * decrypt method that can be executed at the consumer's leisure
   * @param {Page} options.page - After the first result has been returned to a consumer,
   * you can pass the Page back to the sdk to get the next list of results.
   * @returns {Promise<Array<Conversation>>}
   */
  async paginate(options = {}) {
    if (options.page) {
      // We were passed a page but we are out of results
      if (!options.page.links || !options.page.links.next) {
        throw new Error('No link to follow for the provided page');
      }

      // Go get the next page of results
      return this.request({
        url: options.page.links.next,
      }).then((res) => ({page: new Page(res, this.webex)}));
    }

    // No page - so this is the first request to kick off the pagination process
    const queryOptions = {
      personRefresh: true,
      uuidEntryFormat: true,
      activitiesLimit: 0,
      participantsLimit: 0,
      paginate: true,
      ...omit(options, ['deferDecrypt', 'url']),
    };

    const reqOptions = {
      qs: queryOptions,
      deferDecrypt: options.deferDecrypt,
      limit: getConvoLimit(options),
    };

    // if options.url is present we likely received one or more additional urls due to federation. In this case
    // we need to initialize pagination against that url instead of the default home cluster
    if (options.url) {
      reqOptions.uri = `${options.url}/conversations`;
    } else {
      reqOptions.service = 'conversation';
      reqOptions.resource = 'conversations';
    }

    return this.request(reqOptions).then((res) => {
      const response = {
        page: new Page(res, this.webex),
      };

      if (res.body && res.body.additionalUrls) {
        response.additionalUrls = res.body.additionalUrls;
      }

      return response;
    });
  },

  /**
   * Lists the conversations the current user has left. By default does not
   * fetch activities or participants
   * @param {Object} options
   * @returns {Promise<Array<Conversation>>}
   */
  listLeft(options) {
    return this._list({
      service: 'conversation',
      resource: 'conversations/left',
      qs: options,
      limit: getConvoLimit(options),
    }).then((results) => {
      for (const convo of results) {
        idToUrl.set(convo.id, convo.url);
      }

      return results;
    });
  },

  /**
   * List activities for the specified conversation
   * @param {Object} options
   * @param {String} options.conversationUrl URL to the conversation
   * @returns {Promise<Array<Activity>>}
   */
  listActivities(options) {
    return this._listActivities(Object.assign(options, {resource: 'activities'}));
  },

  /**
   * @typedef QueryOptions
   * @param {number} [limit] The limit of child activities that can be returned per request
   * @param {boolean} [latestActivityFirst] Sort order for the child activities
   * @param {boolean} [includeParentActivity] Enables the parent activity to be returned in the activity list
   * @param {string} [sinceDate] Get all child activities after this date
   * @param {string} [maxDate] Get all child activities before this date
   * @param {boolean} [latestActivityFirst] Sort order for the child activities
   * @param {string} [activityType] The type of children to return the parents of, a null value here returns parents of all types of children.
   * The value is one of 'reply', 'edit', 'cardAction', 'reaction', 'reactionSummary', 'reactionSelfSummary'
   */

  /**
   * Get all parent ids for a conversation.
   * @param {string} conversationUrl conversation URL.
   * @param {QueryOptions} [query] object containing query string values to be appended to the url
   * @returns {Promise<Array<String>>}
   */
  async listParentActivityIds(conversationUrl, query) {
    const params = {
      method: 'GET',
      url: `${conversationUrl}/parents`,
      qs: query,
    };

    const response = await this.request(params);

    return response.body;
  },

  /**
   * Returns a list of _all_ child activities for a given parentId within a given conversation
   * @param {object} [options = {}]
   * @param {string} [options.conversationUrl] targeted conversation URL
   * @param {string} [options.activityParentId] parent id of edit activities or thread activities
   * @param {QueryOptions} [options.query] object containing query string values to be appended to the url
   * @returns {Promise<Array>}
   */
  async listAllChildActivitiesByParentId(options = {}) {
    const {conversationUrl, activityParentId, query} = options;
    const {activityType} = query;

    const initialResponse = await this.listChildActivitiesByParentId(
      conversationUrl,
      activityParentId,
      activityType,
      query
    );

    let page = new Page(initialResponse, this.webex);

    const items = [...page.items];

    while (page.hasNext()) {
      // eslint-disable-next-line no-await-in-loop
      page = await page.next();
      for (const activity of page) {
        items.push(activity);
      }
    }

    // reverse list if needed (see _list for precedent)
    if (items.length && last(items).published < items[0].published) {
      items.reverse();
    }

    return items;
  },

  /**
   * Return a list of child activities with a given conversation, parentId and other constraints.
   * @param {string} conversationUrl targeted conversation URL
   * @param {string} activityParentId parent id of edit activities or thread activities
   * @param {string} activityType type of child activity to return
   * The value is one of 'reply', 'edit', 'cardAction', 'reaction', 'reactionSummary', 'reactionSelfSummary'
   * @param {QueryOptions} [query = {}] object containing query string values to be appended to the url
   * @returns {Promise<Array>}
   */
  async listChildActivitiesByParentId(conversationUrl, activityParentId, activityType, query = {}) {
    const finalQuery = {
      ...query,
      activityType,
    };
    const params = {
      method: 'GET',
      url: `${conversationUrl}/parents/${activityParentId}`,
      qs: finalQuery,
    };

    return this.request(params);
  },

  /**
   * Return an array of reactionSummary and reactionSelfSummary objects
   * @param {string} conversationUrl targeted conversation URL
   * @param {string} activityParentId parent id of reaction activities
   * @param {QueryOptions} query object representing query parameters to pass to convo endpoint
   * @returns {Promise<Array>}
   */
  async getReactionSummaryByParentId(conversationUrl, activityParentId, query) {
    const {body} = await this.request({
      method: 'GET',
      url: `${conversationUrl}/activities/${activityParentId}`,
      qs: query,
    });

    const reactionObjects = body.children
      ? body.children.filter(
          (child) => child.type === 'reactionSelfSummary' || child.type === 'reactionSummary'
        )
      : [];

    return reactionObjects;
  },

  /**
   * Lists activities in which the current user was mentioned
   * @param {Object} options
   * @returns {Promise<Array<Activity>>}
   */
  listMentions(options) {
    return this._list({
      service: 'conversation',
      resource: 'mentions',
      qs: omit(options, 'mentions'),
    });
  },

  /**
   * Mutes the mentions of a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @returns {Promise} Resolves with the created activity
   */
  muteMentions(conversation, activity) {
    return this.tag(
      conversation,
      {
        tags: ['MENTION_NOTIFICATIONS_OFF'],
      },
      activity
    );
  },

  /**
   * Mutes the messages of a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @returns {Promise} Resolves with the created activity
   */
  muteMessages(conversation, activity) {
    return this.tag(
      conversation,
      {
        tags: ['MESSAGE_NOTIFICATIONS_OFF'],
      },
      activity
    );
  },

  /**
   * Starts ignoring conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @returns {Promise} Resolves with the created activity
   */
  ignore(conversation, activity) {
    return this.tag(
      conversation,
      {
        tags: ['IGNORED'],
      },
      activity
    );
  },

  /**
   * @param {Object} conversation
   * @param {Object} inputs
   * @param {Object} parentActivity
   * @param {Object} activity
   * @returns {Promise}
   */
  cardAction(conversation, inputs, parentActivity, activity = {}) {
    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    activity.parent = {
      id: parentActivity.id,
      type: 'cardAction',
    };

    return this.prepare(activity, {
      verb: 'cardAction',
      target: this.prepareConversation(convoWithUrl),
      object: {objectType: 'submit', ...inputs},
    }).then((a) => this.submit(a));
  },

  /**
   * Posts a message to a conversation
   * @param {Object} conversation
   * @param {Object|string} message if string, treated as plaintext; if object,
   * assumed to be object property of `post` activity
   * @param {Object} activity Reference to the activity that will eventually be
   * posted. Use this to (a) pass in e.g. clientTempId and (b) render a
   * provisional activity
   * @returns {Promise<Activity>}
   */
  post(conversation, message, activity) {
    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    if (isString(message)) {
      message = {
        displayName: message,
      };
    }

    return this.prepare(activity, {
      verb: 'post',
      target: this.prepareConversation(convoWithUrl),
      object: {objectType: 'comment', ...message},
    }).then((a) => this.submit(a));
  },

  prepareConversation(conversation) {
    return defaults(
      pick(
        conversation,
        'id',
        'url',
        'objectType',
        'defaultActivityEncryptionKeyUrl',
        'kmsResourceObjectUrl'
      ),
      {
        objectType: 'conversation',
      }
    );
  },

  prepare(activity, params) {
    params = params || {};
    activity = activity || {};

    return Promise.resolve(activity.prepare ? activity.prepare(params) : activity).then((act) => {
      defaults(act, {
        verb: params.verb,
        kmsMessage: params.kmsMessage,
        objectType: 'activity',
        clientTempId: uuid.v4(),
        actor: this.webex.internal.device.userId,
      });

      // Workaround because parent is a reserved props in Ampersand
      if (
        (activity.parentActivityId && activity.activityType) ||
        (activity.parent && activity.parent.id && activity.parent.type)
      ) {
        act.parent = {
          id: activity.parentActivityId || activity.parent.id,
          type: activity.activityType || activity.parent.type,
        };
      }

      if (isString(act.actor)) {
        act.actor = {
          objectType: 'person',
          id: act.actor,
        };
      }

      ['actor', 'object'].forEach((key) => {
        if (params[key]) {
          act[key] = act[key] || {};
          defaults(act[key], params[key]);
        }
      });

      if (params.target) {
        merge(act, {
          target: pick(
            params.target,
            'id',
            'url',
            'objectType',
            'kmsResourceObjectUrl',
            'defaultActivityEncryptionKeyUrl'
          ),
        });
      }

      ['object', 'target'].forEach((key) => {
        if (act[key] && act[key].url && !act[key].id) {
          act[key].id = act[key].url.split('/').pop();
        }
      });

      ['actor', 'object', 'target'].forEach((key) => {
        if (act[key] && !act[key].objectType) {
          // Reminder: throwing here because it's the only way to get out of
          // this loop in event of an error.
          throw new Error(`\`act.${key}.objectType\` must be defined`);
        }
      });

      if (act.object && act.object.content && !act.object.displayName) {
        return Promise.reject(
          new Error('Cannot submit activity object with `content` but no `displayName`')
        );
      }

      return act;
    });
  },

  /**
   * Get a subset of threads for a user.
   * @param {Object} options
   * @returns {Promise<Array<Activity>>}
   */
  async listThreads(options) {
    return this._list({
      service: 'conversation',
      resource: 'threads',
      qs: omit(options, 'showAllTypes'),
    });
  },

  /**
   * Handles incoming conversation.activity mercury messages
   * @param {Event} event
   * @returns {Promise}
   */
  processActivityEvent(event) {
    return this.webex.transform('inbound', event).then(() => event);
  },

  /**
   * Handles incoming conversation.inmeetingchat.activity mercury messages
   * @param {Event} event
   * @returns {Promise}
   */
  processInmeetingchatEvent(event) {
    return this.webex.transform('inbound', event).then(() => event);
  },

  /**
   * Removes all mute-related tags
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @returns {Promise} Resolves with the created activity
   */
  removeAllMuteTags(conversation, activity) {
    return this.untag(
      conversation,
      {
        tags: [
          'MENTION_NOTIFICATIONS_OFF',
          'MENTION_NOTIFICATIONS_ON',
          'MESSAGE_NOTIFICATIONS_OFF',
          'MESSAGE_NOTIFICATIONS_ON',
        ],
      },
      activity
    );
  },

  /**
   * Creates a ShareActivty for the specified conversation
   * @param {Object} conversation
   * @param {Object} activity
   * @returns {ShareActivty}
   */
  makeShare(conversation, activity) {
    // if we pass activity as null then it does not take care of the
    // clientTempId created by the web-client while making the provisional
    // activity, hence we need to pass the activity which was created by the
    // web-client. This fixes the issue where the image activities do not come
    // back properly oriented from the server since the clientTempId is missing
    return ShareActivity.create(conversation, activity, this.webex);
  },

  /**
   * Assigns an avatar to a room
   * @param {Object} conversation
   * @param {File} avatar
   * @returns {Promise<Activity>}
   */
  assign(conversation, avatar) {
    const uploadOptions = {role: 'spaceAvatar'};

    if ((avatar.size || avatar.length) > 1024 * 1024) {
      return Promise.reject(new Error('Room avatars must be less than 1MB'));
    }

    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    return Promise.resolve()
      .then(() => {
        const activity = ShareActivity.create(conversation, null, this.webex);

        activity.enableThumbnails = false;
        activity.add(avatar, uploadOptions);

        return this.prepare(activity, {
          target: this.prepareConversation(convoWithUrl),
        });
      })
      .then((a) => {
        // yes, this seems a little hacky; will likely be resolved as a result
        // of #213
        a.verb = 'assign';

        return this.submit(a);
      });
  },

  /**
   * Get url from convo object. If there isn't one, get it from the cache
   *
   * @param {String} url The location of the conversation
   * @param {UUID} id If there is no url, fall back to id to lookup in cache or with cluster
   * @param {String} cluster Used with id to lookup url
   * @param {UUID} generalConversationUuid If this is a team, the id of the general conversation
   * @param {Object} conversations If this is a team, the list of conversations in the team
   * @returns {String} url for the specific convo
   */
  getConvoUrl({id, url, cluster, conversations, generalConversationUuid}) {
    if (generalConversationUuid) {
      // This is a Team
      // Because Convo doesn't have an endpoint for the team URL
      // we have to use the general convo URL.
      const generalConvo = conversations.items.find(
        (convo) => convo.id === generalConversationUuid
      );

      return generalConvo.url;
    }

    if (url) {
      return url;
    }

    if (id) {
      if (cluster) {
        return this.getUrlFromClusterId({cluster, id});
      }
      this.logger.warn('You should be using the `url` instead of the `id` property');
      const relatedUrl = idToUrl.get(id);

      if (!relatedUrl) {
        throw Error('Could not find the `url` from the given `id`');
      }

      return relatedUrl;
    }

    throw Error('The space needs a `url` property');
  },

  /**
   * Sets the typing status of the current user in a conversation
   *
   * @param {Object} conversation
   * @param {Object} options
   * @param {boolean} options.typing
   * @returns {Promise}
   */
  updateTypingStatus(conversation, options) {
    if (!conversation.id) {
      if (conversation.url) {
        conversation.id = conversation.url.split('/').pop();
      } else {
        return Promise.reject(new Error('conversation: could not identify conversation'));
      }
    }

    let eventType;

    if (options.typing) {
      eventType = 'status.start_typing';
    } else {
      eventType = 'status.stop_typing';
    }

    const url = this.getConvoUrl(conversation);
    const resource = 'status/typing';
    const params = {
      method: 'POST',
      body: {
        conversationId: conversation.id,
        eventType,
      },
      url: `${url}/${resource}`,
    };

    return this.request(params);
  },

  /**
   * Shares files to the specified conversation
   * @param {Object} conversation
   * @param {ShareActivity|Array<File>} activity
   * @returns {Promise<Activity>}
   */
  share(conversation, activity) {
    if (isArray(activity)) {
      activity = {
        object: {
          files: activity,
        },
      };
    }

    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    if (!(activity instanceof ShareActivity)) {
      activity = ShareActivity.create(convoWithUrl, activity, this.webex);
    }

    return this.prepare(activity, {
      target: this.prepareConversation(convoWithUrl),
    }).then((a) => this.submit(a));
  },

  /**
   * Submits an activity to the conversation service
   * @param {Object} activity
   * @param {String} [endpoint] endpoint to submit activity. If empty, find in activity
   * @returns {Promise<Activity>}
   */
  submit(activity, endpoint) {
    const url = endpoint || this.getConvoUrl(activity.target);
    const resource = activity.verb === 'share' ? 'content' : 'activities';
    const params = {
      method: 'POST',
      body: activity,
      qs: {
        personRefresh: true,
      },
      url: `${url}/${resource}`,
    };

    if (activity.verb === 'share') {
      Object.assign(params.qs, {
        transcode: true,
        async: false,
      });
    }
    /**
     * helper to cloneDeepWith for copying instance function
     * @param {Object|String|Symbol|Array|Date} value (recursive value to clone from params)
     * @returns {Object|null}
     */
    // eslint-disable-next-line consistent-return
    const customActivityCopy = (value) => {
      const {files} = params.body.object;

      if (
        files &&
        value &&
        files.items.length > 0 &&
        value.constructor === files.items[0].scr.constructor
      ) {
        const copySrc = cloneDeep(value);

        copySrc.toJWE = value.toJWE;
        copySrc.toJSON = value.toJSON;

        return copySrc;
      }
    };
    const cloneActivity = cloneDeepWith(params, customActivityCopy);

    // triggers user-activity to reset logout timer
    this.webex.trigger('user-activity');

    return this.request(params)
      .then((res) => res.body)
      .catch((error) => {
        // handle when key need to rotate
        if (error.body && error.body.errorCode === KEY_ROTATION_REQUIRED) {
          cloneActivity.body.target.defaultActivityEncryptionKeyUrl = null;
          this.request(cloneActivity);
        } else if (
          error.body &&
          (error.body.errorCode === KEY_ALREADY_ROTATED ||
            error.body.errorCode === ENCRYPTION_KEY_URL_MISMATCH)
        ) {
          // handle when key need to update
          this.webex
            .request({
              method: 'GET',
              api: 'conversation',
              resource: `conversations/${params.body.target.id}`,
            })
            .then((res) => {
              cloneActivity.body.target.defaultActivityEncryptionKeyUrl =
                res.body.defaultActivityEncryptionkeyUrl;
              this.request(cloneActivity);
            });
        } else {
          throw error;
        }
      });
  },
  /**
   * Remove the avatar from a room
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @returns {Promise}
   */
  unassign(conversation, activity) {
    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    return this.prepare(activity, {
      verb: 'unassign',
      target: this.prepareConversation(convoWithUrl),
      object: {
        objectType: 'content',
        files: {
          items: [],
        },
      },
    }).then((a) => this.submit(a));
  },

  /**
   * Mutes the mentions of a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @returns {Promise} Resolves with the created activity
   */
  unmuteMentions(conversation, activity) {
    return this.tag(
      conversation,
      {
        tags: ['MENTION_NOTIFICATIONS_ON'],
      },
      activity
    );
  },

  /**
   * Mutes the messages of a conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @returns {Promise} Resolves with the created activity
   */
  unmuteMessages(conversation, activity) {
    return this.tag(
      conversation,
      {
        tags: ['MESSAGE_NOTIFICATIONS_ON'],
      },
      activity
    );
  },

  /**
   * Stops ignoring conversation
   * @param {Conversation~ConversationObject} conversation
   * @param {Conversation~ActivityObject} activity
   * @returns {Promise} Resolves with the created activity
   */
  unignore(conversation, activity) {
    return this.untag(
      conversation,
      {
        tags: ['IGNORED'],
      },
      activity
    );
  },

  /**
   * Update an existing activity
   * @param {Object} conversation
   * @param {Object} object
   * @param {Object} activity
   * @returns {Promise}
   */
  update(conversation, object, activity) {
    if (!isObject(object)) {
      return Promise.reject(new Error('`object` must be an object'));
    }

    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    return this.prepare(activity, {
      verb: 'update',
      target: this.prepareConversation(convoWithUrl),
      object,
    }).then((a) => this.submit(a));
  },

  /**
   * Sets a new key for the conversation
   * @param {Object} conversation
   * @param {Key|string} key (optional)
   * @param {Object} activity Reference to the activity that will eventually be
   * posted. Use this to (a) pass in e.g. clientTempId and (b) render a
   * provisional activity
   * @returns {Promise<Activity>}
   */
  updateKey(conversation, key, activity) {
    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    return this.get(convoWithUrl, {
      activitiesLimit: 0,
      includeParticipants: true,
    }).then((c) => this._updateKey(c, key, activity));
  },

  /**
   * Sets a new key for the conversation
   * @param {Object} conversation
   * @param {Key|string} key (optional)
   * @param {Object} activity Reference to the activity that will eventually be
   * posted. Use this to (a) pass in e.g. clientTempId and (b) render a
   * provisional activity
   * @private
   * @returns {Promise<Activity>}
   */
  _updateKey(conversation, key, activity) {
    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    return Promise.resolve(
      key || this.webex.internal.encryption.kms.createUnboundKeys({count: 1})
    ).then((keys) => {
      const k = isArray(keys) ? keys[0] : keys;
      const params = {
        verb: 'updateKey',
        target: this.prepareConversation(convoWithUrl),
        object: {
          defaultActivityEncryptionKeyUrl: k.uri,
          objectType: 'conversation',
        },
      };

      // Reminder: the kmsResourceObjectUrl is only usable if there is
      // defaultActivityEncryptionKeyUrl.
      // Valid defaultActivityEncryptionKeyUrl start with 'kms:'
      if (
        convoWithUrl.kmsResourceObjectUrl &&
        convoWithUrl.kmsResourceObjectUrl.startsWith('kms:')
      ) {
        params.kmsMessage = {
          method: 'update',
          resourceUri: '<KRO>',
          uri: k.uri,
        };
      } else {
        params.kmsMessage = {
          method: 'create',
          uri: '/resources',
          userIds: map(convoWithUrl.participants.items, 'id'),
          keyUris: [k.uri],
        };
      }

      return this.prepare(activity, params).then((a) => this.submit(a));
    });
  },

  /**
   * @param {Object} payload
   * @param {Object} options
   * @private
   * @returns {Promise<Activity>}
   */
  _create(payload, options = {}) {
    return this.request({
      method: 'POST',
      service: 'conversation',
      resource: 'conversations',
      body: payload,
      qs: {
        forceCreate: options.allowPartialCreation,
      },
    }).then((res) => res.body);
  },

  /**
   * @param {Object} params
   * @param {Object} options
   * @private
   * @returns {Promise}
   */
  _createGrouped(params, options) {
    return this._create(this._prepareConversationForCreation(params), options);
  },

  /**
   * @param {Object} params
   * @param {Object} options
   * @private
   * @returns {Promise}
   */
  _createOneOnOne(params) {
    const payload = this._prepareConversationForCreation(params);

    payload.tags = ['ONE_ON_ONE'];

    return this._create(payload);
  },

  /**
   * Get the current conversation url.
   *
   * @returns {Promise<string>} - conversation url
   */
  getConversationUrl() {
    this.logger.info('conversation: getting the conversation service url');

    const convoUrl = this.webex.internal.services.get('conversation');

    // Validate if the conversation url exists in the services plugin and
    // resolve with its value.
    if (convoUrl) {
      return Promise.resolve(convoUrl);
    }

    // Wait for the postauth catalog to update and then try to retrieve the
    // conversation service url again.
    return this.webex.internal
      .waitForCatalog('postauth')
      .then(() => this.webex.internal.services.get('conversation'))
      .catch((error) => {
        this.logger.warn('conversation: unable to get conversation url', error.message);

        return Promise.reject(error);
      });
  },

  /**
   * @param {Object} conversation
   * @private
   * @returns {Promise}
   */
  _inferConversationUrl(conversation) {
    if (conversation.id) {
      return this.webex.internal.feature
        .getFeature('developer', 'web-high-availability')
        .then((haMessagingEnabled) => {
          if (haMessagingEnabled) {
            // recompute conversation URL each time as the host may have changed
            // since last usage
            return this.getConversationUrl().then((url) => {
              conversation.url = `${url}/conversations/${conversation.id}`;

              return conversation;
            });
          }
          if (!conversation.url) {
            return this.getConversationUrl().then((url) => {
              conversation.url = `${url}/conversations/${conversation.id}`;
              /* istanbul ignore else */
              if (process.env.NODE_ENV !== 'production') {
                this.logger.warn(
                  'conversation: inferred conversation url from conversation id; please pass whole conversation objects to Conversation methods'
                );
              }

              return conversation;
            });
          }

          return Promise.resolve(conversation);
        });
    }

    return Promise.resolve(conversation);
  },

  /**
   * @param {Object} options
   * @param {String} options.conversationUrl URL to the conversation
   * @param {String} options.resource The URL resource to hit for a list of objects
   * @private
   * @returns {Promise<Array<Activity>>}
   */
  _listActivities(options) {
    const id = options.conversationId;
    const url = this.getConvoUrl({url: options.conversationUrl, id});
    const {resource} = options;

    return this._list({
      qs: omit(options, 'resource'),
      url: `${url}/${resource}`,
    });
  },

  /**
   * common interface for facade of generator functions
   * @typedef {object} IGeneratorResponse
   * @param {boolean} done whether there is more to fetch
   * @param {any} value the value yielded or returned by generator
   */

  /**
   * @param {object} options
   * @param {string} options.conversationId
   * @param {string} options.conversationUrl,
   * @param {boolean} options.includeChildren, If set to true, parent activities will be enhanced with child objects
   * @param {number} options.minActivities how many activities to return in first batch
   * @param {?string} [options.queryType] one of older, newer, mid. defines which direction to fetch
   * @param {?object} [options.search] server activity to use as search middle date
   *
   * @returns {object}
   * returns three functions:
   *
   * getOlder - gets older activities than oldest fetched
   *
   * getNewer - gets newer activities than newest fetched
   *
   * jumpToActivity - gets searched-for activity and surrounding activities
   */
  listActivitiesThreadOrdered(options) {
    const {conversationUrl, conversationId} = options;

    if (!conversationUrl && !conversationId) {
      throw new Error('must provide a conversation URL or conversation ID');
    }

    const url = this.getConvoUrl({url: conversationUrl, id: conversationId});

    const baseOptions = {...omit(options, ['conversationUrl', 'conversationId']), url};

    const olderOptions = {...baseOptions, queryType: OLDER};

    let threadOrderer = this._listActivitiesThreadOrdered(baseOptions);

    /**
     * gets queried activity and surrounding activities
     * calling this function creates a new generator instance, losing the previous instance's internal state
     * this ensures that jumping to older and newer activities is relative to a single set of timestamps, not many
     * @param {object} searchObject activity object from convo
     * @returns {IGeneratorResponse}
     */
    const jumpToActivity = async (searchObject) => {
      if (!searchObject) {
        throw new Error('Search must be an activity object from conversation service');
      }
      const newUrl = searchObject.target && searchObject.target.url;

      if (!newUrl) {
        throw new Error('Search object must have a target url!');
      }

      const searchOptions = {
        ...baseOptions,
        url: newUrl,
        queryType: MID,
        search: searchObject,
      };

      threadOrderer = this._listActivitiesThreadOrdered(searchOptions);

      const {value: searchResults} = await threadOrderer.next(searchOptions);

      return {
        done: true,
        value: searchResults,
      };
    };

    /**
     * gets older activities than oldest fetched
     * @returns {IGeneratorResponse}
     */
    const getOlder = async () => {
      const {value = []} = await threadOrderer.next(olderOptions);

      const oldestInBatch = value[0] && value[0].activity;
      const moreActivitiesExist =
        oldestInBatch && getActivityType(oldestInBatch) !== ACTIVITY_TYPES.CREATE;

      return {
        done: !moreActivitiesExist,
        value,
      };
    };

    /**
     * gets newer activities than newest fetched
     * @returns {IGeneratorResponse}
     */
    const getNewer = async () => {
      const newerOptions = {...baseOptions, queryType: NEWER};

      const {value} = await threadOrderer.next(newerOptions);

      return {
        done: !value.length,
        value,
      };
    };

    return {
      jumpToActivity,
      getNewer,
      getOlder,
    };
  },

  /**
   * Represents reactions to messages
   * @typedef {object} Reaction
   * @property {object} activity reaction2summary server activity object
   */

  /**
   * Represents a root (parent, with or without children) activity, along with any replies and reactions
   * @typedef {object} Activity
   * @property {object} activity server activity object
   * @property {Reaction} reactions
   * @property {Reaction} reactionSelf
   */

  /**
   * @generator
   * @method
   * @async
   * @private
   * @param {object} options
   * @param {string} options.url
   * @param {boolean} options.includeChildren, If set to true, parent activities will be enhanced with child objects
   * @param {string} [options.minActivities] how many activities to return in first batch
   * @param {string} [options.queryType] one of older, newer, mid. defines which direction to fetch
   * @param {object} [options.search] server activity to use as search middle date
   *
   * @yields {Activity[]}
   *
   * @returns {void}
   */
  async *_listActivitiesThreadOrdered(options = {}) {
    // ***********************************************
    // INSTANCE STATE VARIABLES
    // variables that will be used for the life of the generator
    // ***********************************************

    let {minActivities = defaultMinDisplayableActivities, queryType = INITIAL} = options;

    // must fetch initially before getting newer activities!
    if (queryType === NEWER) {
      queryType = INITIAL;
    }

    const {url: convoUrl, search = {}, includeChildren} = options;

    // manage oldest, newest activities (ie bookends)
    const {setBookends, getNewestAct, getOldestAct} = bookendManager();

    // default batch should be equal to minActivities when fetching back in time, but halved when fetching newer due to subsequent child fetches filling up the minActivities count
    // reduces server RTs when fetching older activities
    const defaultBatchSize =
      queryType === INITIAL || queryType === OLDER
        ? minActivities
        : Math.max(minBatchSize, Math.ceil(minActivities / 2));
    let batchSize = defaultBatchSize;

    // exposes activity states and handlers with simple getters
    const {getActivityHandlerByKey, getActivityByTypeAndParentId} = activityManager();

    // set initial query
    let query = getQuery(queryType, {activityToSearch: search, batchSize});

    /* eslint-disable no-await-in-loop */
    /* eslint-disable no-loop-func */
    while (true) {
      // ***********************************************
      // EXECUTION STATE VARIABLES
      // variables that will be used for each "batch" of activities asked for
      // ***********************************************

      // stores all "root" activities (activities that are, or could be, thread parents)
      const {getRootActivityHash, addNewRoot} = rootActivityManager();

      // used to determine if we should continue to fetch older activities
      // must be set per iteration, as querying newer activities is still valid when all end of convo has been reached
      const {getNoMoreActs, checkAndSetNoMoreActs, checkAndSetNoOlderActs, checkAndSetNoNewerActs} =
        noMoreActivitiesManager();

      const getActivityHandlerByType = (type) =>
        ({
          [ACTIVITY_TYPES.ROOT]: addNewRoot,
          [ACTIVITY_TYPES.REPLY]: getActivityHandlerByKey(ACTIVITY_TYPES.REPLY),
          [ACTIVITY_TYPES.EDIT]: getActivityHandlerByKey(ACTIVITY_TYPES.EDIT),
          [ACTIVITY_TYPES.REACTION]: getActivityHandlerByKey(ACTIVITY_TYPES.REACTION),
          [ACTIVITY_TYPES.REACTION_SELF]: getActivityHandlerByKey(ACTIVITY_TYPES.REACTION_SELF),
          [ACTIVITY_TYPES.TOMBSTONE]: addNewRoot,
          [ACTIVITY_TYPES.CREATE]: addNewRoot,
        }[type]);

      const handleNewActivity = (activity) => {
        const actType = getActivityType(activity);

        // ignore deletes
        if (isDeleteActivity(activity)) {
          return;
        }

        const activityHandler = getActivityHandlerByType(actType);

        activityHandler(activity);
      };

      const handleNewActivities = (activities) => {
        activities.forEach((act) => {
          handleNewActivity(act);
          checkAndSetNoOlderActs(act);
        });
      };

      const handleOlderQuery = (activities) => {
        setBookends(activities, OLDER);
        handleNewActivities(activities);
      };
      const handleNewerQuery = (activities) => {
        checkAndSetNoNewerActs(activities);
        if (activities.length) {
          setBookends(activities, NEWER);
          handleNewActivities(activities);
        }
      };
      const handleSearch = (activities) => {
        setBookends(activities, MID);
        handleNewActivities(activities);
      };

      const getQueryResponseHandler = (type) =>
        ({
          [OLDER]: handleOlderQuery,
          [NEWER]: handleNewerQuery,
          [MID]: handleSearch,
          [INITIAL]: handleOlderQuery,
        }[type]);

      // ***********************************************
      // INNER LOOP
      // responsible for fetching and building our maps of activities
      // fetch until minActivities is reached, or no more acts to fetch, or we hit our max fetch count
      // ***********************************************

      const incrementLoopCounter = getLoopCounterFailsafe();

      while (!getNoMoreActs()) {
        // count loops and throw if we detect infinite loop
        incrementLoopCounter();

        // configure fetch request. Use a smaller limit when fetching newer or mids to account for potential children fetches
        const allBatchActivitiesConfig = {
          conversationUrl: convoUrl,
          limit: batchSize,
          includeChildren,
          ...query,
        };

        // request activities in batches
        const $allBatchActivitiesFetch = this.listActivities(allBatchActivitiesConfig);

        // contain fetches in array to parallelize fetching as needed
        const $fetchRequests = [$allBatchActivitiesFetch];

        // if query requires recursive fetches for children acts, add the additional fetch
        if (queryType === MID || queryType === NEWER) {
          const params = {activityType: null};

          if (query.sinceDate) {
            params.sinceDate = query.sinceDate;
          }

          const $parentsFetch = this.listParentActivityIds(convoUrl, params);

          $fetchRequests.push($parentsFetch);
        }

        // we dont always need to fetch for parents
        const [allBatchActivities, parents = {}] = await Promise.all($fetchRequests);

        // use query type to decide how to handle response
        const handler = getQueryResponseHandler(queryType);

        handler(allBatchActivities);

        /*
          next we must selectively fetch the children of each of the parents to ensure completeness
          do this by checking the hash for each of the above parent IDs
          fetch children when we have a parent whose ID is represented in the parent ID lists
        */
        const {reply: replyIds = [], edit: editIds = [], reaction: reactionIds = []} = parents;

        // if no parent IDs returned, do nothing
        if (replyIds.length || editIds.length || reactionIds.length) {
          const $reactionFetches = [];
          const $replyFetches = [];
          const $editFetches = [];

          for (const activity of allBatchActivities) {
            const actId = activity.id;

            const childFetchOptions = {
              conversationUrl: convoUrl,
              activityParentId: actId,
            };

            if (reactionIds.includes(actId)) {
              $reactionFetches.push(
                this.getReactionSummaryByParentId(convoUrl, actId, {
                  activityType: 'reactionSummary',
                  includeChildren: true,
                })
              );
            }
            if (replyIds.includes(actId)) {
              childFetchOptions.query = {activityType: 'reply'};
              $replyFetches.push(this.listAllChildActivitiesByParentId(childFetchOptions));
            }
            if (editIds.includes(actId)) {
              childFetchOptions.query = {activityType: 'edit'};
              $editFetches.push(this.listAllChildActivitiesByParentId(childFetchOptions));
            }
          }

          // parallelize fetch for speeedz
          const [reactions, replies, edits] = await Promise.all([
            Promise.all($reactionFetches),
            Promise.all($replyFetches),
            Promise.all($editFetches),
          ]);

          // new reactions may have come in that also need their reactions fetched
          const newReplyReactions = await Promise.all(
            replies
              .filter((reply) => replyIds.includes(reply.id))
              .map((reply) =>
                this.getReactionSummaryByParentId(convoUrl, reply.id, {
                  activityType: 'reactionSummary',
                  includeChildren: true,
                })
              )
          );

          const allReactions = [...reactions, ...newReplyReactions];

          // stick them into activity hashes
          replies.forEach((replyArr) => handleNewActivities(replyArr));
          edits.forEach((editArr) => handleNewActivities(editArr));
          allReactions.forEach((reactionArr) => handleNewActivities(reactionArr));
        }

        const rootActivityHash = getRootActivityHash();
        let visibleActivitiesCount = rootActivityHash.size;

        for (const rootActivity of rootActivityHash.values()) {
          const {id: rootId} = rootActivity;
          const repliesByRootId = getActivityByTypeAndParentId(ACTIVITY_TYPES.REPLY, rootId);

          if (repliesByRootId && repliesByRootId.size) {
            visibleActivitiesCount += repliesByRootId.size || 0;
          }
        }

        // stop fetching if we've reached desired count of visible activities
        if (visibleActivitiesCount >= minActivities) {
          break;
        }

        checkAndSetNoMoreActs(queryType, visibleActivitiesCount, batchSize);

        // batchSize should be equal to minimum activities when fetching older activities
        // covers "best case" when we reach minActivities on the first fetch
        if (queryType === OLDER) {
          batchSize = minActivities;
        }

        // since a MID query can bump the batchSize, we need to reset it _after_ a potential MID query
        // reset batchSize in case of MID queries bumping it up
        if (queryType === NEWER) {
          batchSize = defaultBatchSize;
        }

        const currentOldestPublishedDate = getPublishedDate(getOldestAct());
        const currentNewestPublishedDate = getPublishedDate(getNewestAct());

        // we're still building our activity list - derive new query from prior query and start loop again
        if (queryType === INITIAL) {
          query = getQuery(OLDER, {oldestPublishedDate: currentOldestPublishedDate, batchSize});
        } else {
          query = getQuery(queryType, {
            batchSize,
            activityToSearch: search,
            oldestPublishedDate: currentOldestPublishedDate,
            newestPublishedDate: currentNewestPublishedDate,
          });
        }

        // if we're still building out the midDate search, bump the search limit to include activities on both sides
        if (queryType === MID) {
          batchSize += batchSizeIncrementCount;
        }
      }

      const orderedActivities = [];

      const getRepliesByParentId = (replyParentId) => {
        const replies = [];

        const repliesByParentId = getActivityByTypeAndParentId(ACTIVITY_TYPES.REPLY, replyParentId);

        if (!repliesByParentId) {
          return replies;
        }

        const sortedReplies = sortActivitiesByPublishedDate(
          getActivityObjectsFromMap(repliesByParentId)
        );

        sortedReplies.forEach((replyActivity) => {
          const replyId = replyActivity.id;
          const edit = getActivityByTypeAndParentId(ACTIVITY_TYPES.EDIT, replyId);
          const reaction = getActivityByTypeAndParentId(ACTIVITY_TYPES.REACTION, replyId);
          const reactionSelf = getActivityByTypeAndParentId(ACTIVITY_TYPES.REACTION_SELF, replyId);

          const latestActivity = edit || replyActivity;
          // hash of root activities (in case of plain reply) and the reply activity (in case of edit)
          const allRelevantActivitiesArr = [
            ...getActivityObjectsFromMap(getRootActivityHash()),
            ...getActivityObjectsFromMap(repliesByParentId),
          ];
          const allRelevantActivities = allRelevantActivitiesArr.reduce((hashMap, act) => {
            hashMap[act.id] = act;

            return hashMap;
          }, {});

          const finalReply = this._createParsedServerActivity(
            latestActivity,
            allRelevantActivities
          );

          const fullReply = {
            id: replyId,
            activity: finalReply,
            reaction,
            reactionSelf,
          };

          const sanitizedFullReply = sanitizeActivity(fullReply);

          replies.push(sanitizedFullReply);
        });

        return replies;
      };

      const orderedRoots = sortActivitiesByPublishedDate(
        getActivityObjectsFromMap(getRootActivityHash())
      );

      orderedRoots.forEach((rootActivity) => {
        const rootId = rootActivity.id;
        const replies = getRepliesByParentId(rootId);
        const edit = getActivityByTypeAndParentId(ACTIVITY_TYPES.EDIT, rootId);
        const reaction = getActivityByTypeAndParentId(ACTIVITY_TYPES.REACTION, rootId);
        const reactionSelf = getActivityByTypeAndParentId(ACTIVITY_TYPES.REACTION_SELF, rootId);

        const latestActivity = edit || rootActivity;
        const finalActivity = this._createParsedServerActivity(latestActivity, {
          [rootId]: rootActivity,
        });

        const fullRoot = {
          id: rootId,
          activity: finalActivity,
          reaction,
          reactionSelf,
        };

        const sanitizedFullRoot = sanitizeActivity(fullRoot);

        orderedActivities.push(sanitizedFullRoot);
        replies.forEach((reply) => orderedActivities.push(reply));
      });

      const nextOptions = yield orderedActivities;

      if (nextOptions) {
        minActivities = nextOptions.minActivities || minActivities;

        const currentOldestPublishedDate = getPublishedDate(getOldestAct());
        const currentNewestPublishedDate = getPublishedDate(getNewestAct());

        queryType = nextOptions.queryType;
        query = getQuery(queryType, {
          activityToSearch: search,
          oldestPublishedDate: currentOldestPublishedDate,
          newestPublishedDate: currentNewestPublishedDate,
          batchSize,
        });
      } else {
        return;
      }
    }
  },

  /**
   * @typedef {object} EditActivity
   * @property {object} editParent
   *
   * @typedef {object} ReplyActivity
   * @property {object} replyParent
   *
   * @typedef {object} EditedReplyActivity
   * @property {object} replyParent
   * @property {object} editParent
   *
   * @typedef {EditActivity | ReplyActivity | EditedReplyActivity} ParsedServerActivity
   */

  /**
   * hashmap of server activities, keyed by id
   * @typedef {object} ActivityHash
   * @property {Object}
   */

  /**
   * extends a given server object with fields that point to their parent activities from the hashmap passed in
   * @param {object} activity server activity
   * @param {ActivityHash} allActivitiesHash hashmap of all server activities caller would like to pass in
   * @returns {ParsedServerActivity} server activity extended with edit and reply parent fields
   */
  _createParsedServerActivity(activity, allActivitiesHash = {}) {
    const isOrphan = getIsActivityOrphaned(activity, allActivitiesHash);

    if (isOrphan) {
      throw new Error(
        'activity has a parent that cannot be found in allActivitiesHash! please handle this as necessary'
      );
    }

    const activityType = determineActivityType(activity, allActivitiesHash);

    switch (activityType) {
      case ACTIVITY_TYPES.ROOT: {
        return createRootActivity(activity);
      }
      case ACTIVITY_TYPES.EDIT: {
        // `activities` must also have the original activity
        return createEditActivity(activity, allActivitiesHash);
      }
      case ACTIVITY_TYPES.REPLY: {
        return createReplyActivity(activity);
      }
      case ACTIVITY_TYPES.REPLY_EDIT: {
        // `activities` must also have the reply activity
        return createReplyEditActivity(activity, allActivitiesHash);
      }
      default: {
        return activity;
      }
    }
  },

  /**
   * @param {Object} options
   * @private
   * @returns {Promise<Array<Conversation>>}
   */
  async _list(options) {
    options.qs = {
      personRefresh: true,
      uuidEntryFormat: true,
      activitiesLimit: 0,
      participantsLimit: 0,
      ...options.qs,
    };

    const res = await this.request(options);

    let list;

    if (!res.body || !res.body.items || res.body.items.length === 0) {
      list = [];
    } else {
      list = res.body.items.slice(0);
      if (last(list).published < list[0].published) {
        list.reverse();
      }
    }

    // The user has more data in another cluster.
    // Follow the 'additionalUrls' for that data.
    if (res.body.additionalUrls) {
      let limit = 0;

      // If the user asked for a specific amount of data,
      // don't fetch more than what was asked.
      // Here we figure out how much is left from the original request.
      // Divide that by the number of additional URLS.
      // This won't get us the exact limit but it will retrieve something
      // from every cluster listed.
      if (options.limit) {
        limit = Math.floor((options.limit.value - list.length) / res.body.additionalUrls.length);
      }

      // If the limit is 0 for some reason,
      // don't bother requesting from other clusters
      if (!options.limit || limit !== 0) {
        const results = await Promise.all(
          res.body.additionalUrls.map((host) => {
            const url = `${host}/${options.resource}`;
            const newOptions = {...options, uri: url, url};

            if (options.limit) {
              newOptions.qs[newOptions.limit.name] = limit;
            }

            return this.request(newOptions);
          })
        );

        for (const result of results) {
          if (result.body && result.body.items && result.body.items.length) {
            const {items} = result.body;

            if (last(items).published < items[0].published) {
              items.reverse();
            }
            list = list.concat(items);
          }
        }
      }
    }

    await Promise.all(list.map((item) => this._recordUUIDs(item)));

    return list;
  },

  /**
   * @param {Object} params
   * @param {Object} options
   * @private
   * @returns {Promise<Conversation>}
   */
  _maybeCreateOneOnOneThenPost(params, options) {
    return this.get(
      defaults({
        // the use of uniq in Conversation#create guarantees participant[1] will
        // always be the other user
        user: params.participants[1],
      }),
      Object.assign(options, {includeConvWithDeletedUserUUID: true, includeParticipants: true})
    )
      .then((conversation) => {
        if (params.comment || params.html) {
          return this.post(conversation, {content: params.html, displayName: params.comment}).then(
            (activity) => {
              conversation.activities.items.push(activity);

              return conversation;
            }
          );
        }

        return conversation;
      })
      .catch((reason) => {
        if (reason.statusCode !== 404) {
          return Promise.reject(reason);
        }

        return this._createOneOnOne(params);
      });
  },

  /**
   * @param {Object} params
   * @private
   * @returns {Object}
   */
  _prepareConversationForCreation(params) {
    const payload = {
      activities: {
        items: [this.expand('create')],
      },
      objectType: 'conversation',
      kmsMessage: {
        method: 'create',
        uri: '/resources',
        userIds: cloneDeep(params.participants),
        keyUris: [],
      },
    };

    if (params.displayName) {
      payload.displayName = params.displayName;
    }

    if (params.tags) {
      payload.tags = params.tags;
    }

    params.participants.forEach((participant) => {
      payload.activities.items.push(
        this.expand('add', {
          objectType: 'person',
          id: participant,
        })
      );
    });

    if (params.comment) {
      payload.activities.items.push(
        this.expand('post', {
          objectType: 'comment',
          content: params.html,
          displayName: params.comment,
        })
      );
    }

    if (!params.isDefaultClassification && params.classificationId) {
      payload.activities.items.push(
        this.expand('update', {
          objectType: 'classification',
          classificationId: params.classificationId,
          effectiveDate: params.effectiveDate,
        })
      );
    }

    if (params.favorite) {
      payload.activities.items.push(
        this.expand('favorite', {
          objectType: 'conversation',
        })
      );
    }

    return payload;
  },

  /**
   * @param {Object} conversation
   * @private
   * @returns {Promise}
   */
  _recordUUIDs(conversation) {
    if (!conversation.participants || !conversation.participants.items) {
      return Promise.resolve(conversation);
    }

    return Promise.all(
      conversation.participants.items.map((participant) => {
        // ROOMs or LYRA_SPACEs do not have email addresses, so there's no point attempting to
        // record their UUIDs.
        if (participant.type === 'ROOM' || participant.type === 'LYRA_SPACE') {
          return Promise.resolve();
        }

        return this.webex.internal.user
          .recordUUID(participant)
          .catch((err) => this.logger.warn('Could not record uuid', err));
      })
    );
  },
});

['favorite', 'hide', 'lock', 'mute', 'unfavorite', 'unhide', 'unlock', 'unmute'].forEach((verb) => {
  Conversation.prototype[verb] = function submitSimpleActivity(conversation, activity) {
    const convoWithUrl = this.prepareConversation({
      ...conversation,
      url: this.getConvoUrl(conversation),
    });

    return this.prepare(activity, {
      verb,
      object: convoWithUrl,
      target: convoWithUrl,
    }).then((a) => this.submit(a));
  };
});

['assignModerator', 'unassignModerator'].forEach((verb) => {
  Conversation.prototype[verb] = function submitModerationChangeActivity(
    conversation,
    moderator,
    activity
  ) {
    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    return Promise.all([
      convoWithUrl,
      moderator ? this.webex.internal.user.asUUID(moderator) : this.webex.internal.device.userId,
    ])
      .then(([c, userId]) =>
        this.prepare(activity, {
          verb,
          target: this.prepareConversation(c),
          object: {
            id: userId,
            objectType: 'person',
          },
        })
      )
      .then((a) => this.submit(a));
  };
});

/**
 * Sets/unsets space property for convo
 * @param {Object} conversation
 * @param {string} tag
 * @param {Activity} activity
 * @returns {Promise<Activity>}
 */
['setSpaceProperty', 'unsetSpaceProperty'].forEach((fnName) => {
  const verb = fnName.startsWith('set') ? 'set' : 'unset';

  Conversation.prototype[fnName] = function submitSpacePropertyActivity(
    conversation,
    tag,
    activity
  ) {
    if (!isString(tag)) {
      return Promise.reject(new Error('`tag` must be a string'));
    }

    const convoWithUrl = {...conversation, url: this.getConvoUrl(conversation)};

    return this.prepare(activity, {
      verb,
      target: this.prepareConversation(convoWithUrl),
      object: {
        tags: [tag],
        objectType: 'spaceProperty',
      },
    }).then((a) => this.submit(a));
  };
});

['tag', 'untag'].forEach((verb) => {
  Conversation.prototype[verb] = function submitObjectActivity(conversation, object, activity) {
    if (!isObject(object)) {
      return Promise.reject(new Error('`object` must be an object'));
    }

    const c = this.prepareConversation({...conversation, url: this.getConvoUrl(conversation)});

    return this.prepare(activity, {
      verb,
      target: c,
      object: Object.assign(c, object),
    }).then((a) => this.submit(a));
  };
});

export default Conversation;
