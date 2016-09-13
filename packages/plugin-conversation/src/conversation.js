/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {defaults, isString, omit, uniq} from 'lodash';
import Decrypter from './decrypter';
import Encrypter from './encrypter';
import Normalizer from './normalizer';

const Conversation = SparkPlugin.extend({
  namespace: `Conversation`,

  children: {
    decrypter: Decrypter,
    encrypter: Encrypter,
    normalizer: Normalizer
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

export default Conversation;
