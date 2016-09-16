/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {defaults, isArray, isObject, isString, last, map, merge, omit, pick, uniq} from 'lodash';
import Decrypter from './decrypter';
import Encrypter from './encrypter';
import Normalizer from './normalizer';
import uuid from 'uuid';
import querystring from 'querystring';

const Conversation = SparkPlugin.extend({
  namespace: `Conversation`,

  children: {
    decrypter: Decrypter,
    encrypter: Encrypter,
    normalizer: Normalizer
  },

  add(conversation, object, activity) {
    return this._inferConversationUrl(conversation)
      .then(() => this.spark.user.asUUID(object, {create: true}))
      .then((id) => this.prepare(activity, {
        verb: `add`,
        target: this.prepareConversation(conversation),
        object: {
          id,
          objectType: `person`
        },
        kmsMessage: {
          method: `create`,
          uri: `/authorizations`,
          resourceUri: `<KRO>`,
          userIds: [
            id
          ]
        }
      })
      .then((a) => this.submit(a)));
  },

  create(params, options) {
    if (!params.participants || params.participants.length === 0) {
      return Promise.reject(new Error(`\`params.participants\` is required`));
    }

    return Promise.all(params.participants.map((participant) => this.spark.user.asUUID(participant, {create: true})))
      .then((participants) => {
        participants.unshift(this.spark.device.userId);
        params.participants = uniq(participants);

        if (participants.length === 2 && !(options && options.forceGrouped)) {
          return this._maybeCreateOneOnOneThenPost(params);
        }

        return this._createGrouped(params);
      });
  },

  expand(verb, object, target, actor) {
    const activity = {
      actor,
      objectType: `activity`,
      verb
    };

    if (!actor) {
      actor = this.spark.device.userId;
    }

    if (isString(actor)) {
      activity.actor = {
        objectType: `person`,
        id: actor
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

  get(conversation, options) {
    return this._inferConversationUrl(conversation)
      .then(() => {
        const {user, url} = conversation;

        options = options || {};

        const params = {
          qs: Object.assign({
            uuidEntryFormat: true,
            personRefresh: true,
            activitiesLimit: 0,
            includeParticipants: false
          }, omit(options, `id`, `user`, `url`))
        };

        return Promise.resolve(user ? this.spark.user.asUUID(user) : null)
          .then((userId) => {
            if (userId) {
              Object.assign(params, {
                api: `conversation`,
                resource: `conversations/user/${userId}`
              });
            }
            else {
              params.uri = url;
            }
            return this.request(params);
          });
      })
      .then((res) => this._recordUUIDs(res.body)
      .then(() => res.body));
  },

  leave(conversation, object, activity) {
    return this._inferConversationUrl(conversation)
      .then(() => {
        if (!object) {
          object = this.spark.device.userId;
        }

        return this.spark.user.asUUID(object)
          .then((id) => this.prepare(activity, {
            verb: `leave`,
            target: this.prepareConversation(conversation),
            object: {
              id,
              objectType: `person`
            },
            kmsMessage: {
              method: `delete`,
              uri: `<KRO>/authorizations?${querystring.stringify({authId: id})}`
            }
          }));
      })
      .then((a) => this.submit(a));
  },

  list(options) {
    return this._list({
      api: `conversation`,
      resource: `conversations`,
      qs: options
    });
  },

  listLeft(options) {
    return this._list({
      api: `conversation`,
      resource: `conversations/left`,
      qs: options
    });
  },

  listActivities(options) {
    return this._listActivities(Object.assign(options, {mentions: false}));
  },

  listMentions(options) {
    return this._listActivities(Object.assign(options, {mentions: true}));
  },

  post(conversation, object, activity) {
    return this._inferConversationUrl(conversation)
      .then(() => this.prepare(activity, {
        verb: `post`,
        target: this.prepareConversation(conversation),
        object: defaults(object, {objectType: `comment`})
      }))
      .then((a) => this.submit(a));
  },

  prepareConversation(conversation) {
    const c = defaults(pick(conversation, `id`, `url`, `objectType`, `kmsResourceObjectUrl`, `defaultActivityEncryptionKeyUrl`), {
      objectType: `conversation`
    });
    return c;
  },

  prepare(activity, params) {
    params = params || {};
    activity = activity || {};
    return Promise.resolve(activity.prepare ? activity.prepare(params) : activity)
      .then((act) => {
        defaults(act, {
          verb: params.verb,
          kmsMessage: params.kmsMessage,
          objectType: `activity`,
          clientTempId: uuid.v4(),
          actor: this.spark.device.userId
        });

        if (isString(act.actor)) {
          act.actor = {
            objectType: `person`,
            id: act.actor
          };
        }

        [`actor`, `object`].forEach((key) => {
          if (params[key]) {
            act[key] = act[key] || {};
            defaults(act[key], params[key]);
          }
        });

        if (params.target) {
          merge(act, {
            target: pick(params.target, `id`, `url`, `objectType`, `kmsResourceObjectUrl`, `defaultActivityEncryptionKeyUrl`)
          });
        }

        [`object`, `target`].forEach((key) => {
          if (act[key] && act[key].url && !act[key].id) {
            act[key].id = act[key].url.split(`/`).pop();
          }
        });

        [`actor`, `object`, `target`].forEach((key) => {
          if (act[key] && !act[key].objectType) {
            // Reminder: throwing here because it's the only way to get out of
            // this loop in event of an error.
            throw new Error(`\`act.${key}.objectType\` must be defined`);
          }
        });

        if (act.object && act.object.content && !act.object.displayName) {
          return Promise.reject(new Error(`Cannot submit activity object with \`content\` but no \`displayName\``));
        }

        return act;
      });
  },

  submit(activity) {
    const params = {
      method: `POST`,
      service: `conversation`,
      resource: activity.verb === `share` ? `content` : `activities`,
      body: activity,
      qs: {
        personRefresh: true
      }
    };

    if (activity.verb === `share`) {
      Object.assign(params.qs, {
        transcode: true,
        async: false
      });
    }

    return this.request(params)
      .then((res) => res.body);
  },

  updateKey(conversation, object, activity) {
    return this._inferConversationUrl(conversation)
      .then(() => this.get(conversation, {
        activitiesLimit: 0,
        includeParticipants: true
      }))
      .then((c) => this._updateKey(c, object, activity));
  },

  _updateKey(conversation, key, activity) {
    return Promise.resolve(key || this.spark.encryption.kms.createUnboundKeys({count: 1}))
      .then((keys) => {
        const k = isArray(keys) ? keys[0] : keys;
        const params = {
          verb: `updateKey`,
          target: this.prepareConversation(conversation),
          object: {
            defaultActivityEncryptionKeyUrl: k.uri,
            objectType: `conversation`
          }
        };

        // Reminder: the kmsResourceObjectUrl is only usable if there is
        // defaultActivityEncryptionKeyUrl.
        if (conversation.defaultActivityEncryptionKeyUrl) {
          params.kmsMessage = {
            method: `update`,
            resourceUri: `<KRO>`,
            uri: k.uri
          };
        }
        else {
          params.kmsMessage = {
            method: `create`,
            uri: `/resources`,
            userIds: map(conversation.participants.items, `id`),
            keyUris: [
              k.uri
            ]
          };
        }

        return this.prepare(activity, params)
          .then((a) => this.submit(a));
      });
  },

  _create(payload) {
    return this.request({
      method: `POST`,
      service: `conversation`,
      resource: `conversations`,
      body: payload
    })
      .then((res) => res.body);
  },

  _createGrouped(params) {
    return this._create(this._prepareConversationForCreation(params));
  },

  _inferConversationUrl(conversation) {
    if (!conversation.url && conversation.id) {
      return this.spark.device.getServiceUrl(`conversation`)
        .then((url) => {
          conversation.url = `${url}/conversations/${conversation.id}`;
          /* istanbul ignore else */
          if (process.env.NODE_ENV !== `production`) {
            this.logger.warn(`conversation: inferred conversation url from conversation id; please pass whole conversation objects to Conversation methods`);
          }
          return conversation;
        });
    }

    return Promise.resolve(conversation);
  },

  _listActivities(options) {
    return this._list({
      api: `conversation`,
      resource: options.mentions ? `mentions` : `activities`,
      qs: omit(options, `mentions`)
    });
  },

  _list(options) {
    options.qs = Object.assign({
      personRefresh: true,
      uuidEntryFormat: true,
      activitiesLimit: 0,
      participantsLimit: 0
    }, options.qs);

    return this.request(options)
      .then((res) => {
        if (!res.body || !res.body.items || res.body.items.length === 0) {
          return [];
        }

        const items = res.body.items;
        if (last(items).published < items[0].published) {
          items.reverse();
        }

        return Promise.all(items.map((item) => this.decrypter.decryptObject(item)
          // eslint-disable-next-line max-nested-callbacks
          .then((i) => this._recordUUIDs(i))
          // eslint-disable-next-line max-nested-callbacks
          .then((i) => this.normalizer.normalize(i))))
          .then(() => items);
      });
  },

  _maybeCreateOneOnOneThenPost(params) {
    return this.get(defaults({
      // the use of uniq in Conversation#create guarantees participant[1] will
      // always be the other user
      user: params.participants[1]
    }))
      .then((conversation) => {
        if (params.comment) {
          return this.post(conversation, {displayName: params.comment})
            .then((activity) => {
              conversation.activities.push(activity);
              return conversation;
            });
        }

        return conversation;
      })
      .catch((reason) => {
        if (reason.statusCode !== 404) {
          return Promise.reject(reason);
        }

        const payload = this._prepareConversationForCreation(params);
        payload.tags = [`ONE_ON_ONE`];
        return this._create(payload);
      });
  },

  _prepareConversationForCreation(params) {
    const payload = {
      activities: {
        items: [
          this.expand(`create`)
        ]
      },
      objectType: `conversation`,
      kmsMessage: {
        method: `create`,
        uri: `/resources`,
        userIds: params.participants,
        keyUris: []
      }
    };

    if (params.displayName) {
      payload.displayName = params.displayName;
    }

    params.participants.forEach((participant) => {
      payload.activities.items.push(this.expand(`add`, {
        objectType: `person`,
        id: participant
      }));
    });

    if (params.comment) {
      payload.activities.items.push(this.expand(`post`, {
        objectType: `comment`,
        displayName: params.comment
      }));
    }

    return payload;
  },

  _recordUUIDs(conversation) {
    if (!conversation.participants || !conversation.participants.items) {
      return Promise.resolve(conversation);
    }

    return Promise.all(conversation.participants.items.map((participant) => this.spark.user.recordUUID(participant)));
  }
});

[
  `update`
].forEach((verb) => {
  Conversation.prototype[verb] = function submitObjectActivity(conversation, object, activity) {
    if (!isObject(object)) {
      return Promise.reject(new Error(`\`object\` must be an object`));
    }

    return this._inferConversationUrl(conversation)
      .then(() => this.prepare(activity, {
        verb,
        target: this.prepareConversation(conversation),
        object
      }))
      .then((a) => this.submit(a));
  };
});

export default Conversation;
