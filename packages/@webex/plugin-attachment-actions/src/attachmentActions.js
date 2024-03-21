/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';
import {
  SDK_EVENT,
  createEventEnvelope,
  constructHydraId,
  getHydraClusterString,
  hydraTypes,
} from '@webex/common';
import {cloneDeep} from 'lodash';

const debug = require('debug')('attachmentActions');

/**
 * @typedef {Object} AttachmentActionObject
 * @property {string} id - (server generated) Unique identifier for the attachment action
 * @property {string} messageId - The ID of the message in which attachment action is to be performed
 * @property {string} type - The type of attachment action eg., submit
 * @property {Object} inputs - The inputs for form fields in attachment message
 * @property {string} personId - (server generated) The ID for the author of the attachment action
 * @property {string} roomId - (server generated) The ID for the room of the message
 * @property {isoDate} created - (server generated) The date and time that the message was created
 */

/**
 * AttachmentActions are events that communicate information when a user clicks on an
 * Action.Submit button in a card displayed in Webex
 * Information conveyed in an AttachmentAction includes details about the user that
 * clicked the button along with any card specific inputs. See the
 * {@link https://developer.webex.com/docs/api/v1/attachment-actions|Attachments Actions API Documentation}
 * for more details
 * @class
 */
const AttachmentActions = WebexPlugin.extend({
  /**
   * Initializer used to generate AttachmentActions
   * as a plugin wrapped around the provided arguments.
   * @private
   * @see WebexPlugin.initialize
   * @param  {...any} args
   * @returns {undefined}
   */
  initialize(...args) {
    Reflect.apply(WebexPlugin.prototype.initialize, this, args);
  },

  /**
   * Register to listen for incoming attachmentAction events
   * This is an alternate approach to registering for attachmentAction webhooks.
   * The events passed to any registered handlers will be similar to the webhook JSON,
   * but will omit webhook specific fields such as name, secret, url, etc.
   * The attachmentActions.listen() event objects can also include additional fields not
   * available in the webhook's JSON payload, specifically: `inputs`.
   * To utilize the `listen()` method, the authorization token used
   * will need to have `spark:all` and `spark:kms` scopes enabled.
   * Note that by configuring your application to enable or disable `spark:all`
   * via its configuration page will also enable or disable `spark:kms`.
   * See the <a href="https://webex.github.io/webex-js-sdk/samples/browser-socket/">Sample App</a>
   * for more details.
   * @instance
   * @memberof Messages
   * @returns {Promise}
   * @example
   * webex.attachmentActions.listen()
   *   .then(() => {
   *     console.log('listening to attachmentActions events');
   *     webex.attachmentActions.on('created', (event) => console.log(`Got an attachmentActions:created event:\n${event}`));
   *   })
   *   .catch((e) => console.error(`Unable to register for attachmentAction events: ${e}`));
   * // Some app logic...
   * // WHen it is time to cleanup
   * webex.attachmentActions.stopListening();
   * webex.attachmentActions.off('created');
   */
  listen() {
    // Create a common envelope that we will wrap all events in
    return createEventEnvelope(this.webex, SDK_EVENT.EXTERNAL.RESOURCE.ATTACHMENT_ACTIONS).then(
      (envelope) => {
        this.eventEnvelope = envelope;

        // Register to listen to events
        return this.webex.internal.mercury.connect().then(() => {
          this.listenTo(this.webex.internal.mercury, SDK_EVENT.INTERNAL.WEBEX_ACTIVITY, (event) =>
            this.onWebexApiEvent(event)
          );
        });
      }
    );
  },

  /**
   * Post a new attachment action for a message with attachment.
   * @instance
   * @memberof AttachmentActions
   * @param {AttachmentActionObject} attachmentAction
   * @returns {Promise<AttachmentActionObject>}
   * @example
   * webex.rooms.create({title: 'Create Message with card Example'})
   *   .then(function(room) {
   *     return webex.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id,
   *       attachments:[ {
   *          contentType: 'application/vnd.microsoft.card.adaptive',
   *         content: {
   *           type: 'AdaptiveCard',
   *           version: '1.0',
   *           body: [
   *            {
   *             type: 'TextBlock',
   *             text: '',
   *             size: 'large'
   *             },
   *           {
   *             type: 'TextBlock',
   *             text: 'Adaptive Cards',
   *             separation: 'none'
   *           }
   *           {
   *           type: 'Input.Date',
   *           id: 'dueDate'
   *           }
   *       ],
   *     actions: [
   *         {
   *             type: 'Action.Submit',
   *             title: 'Due Date'
   *         }
   *     ]
   *   }
   *  }]
   *     });
   *   })
   *   .then(function(message) {
   *    return webex.attachmentActions.create({
   *      type: 'submit',
   *      messageId: message.id,
   *      inputs:{
   *        dueDate: '26/06/1995'
   *      }
   *    })
   *    .then(function(attachmentAction)){
   *      var assert = require('assert');
   *      assert(attachmentAction.id);
   *      assert(attachmentAction.type);
   *      assert(attachmentAction.personId);
   *      assert(attachmentAction.inputs);
   *      assert(attachmentAction.messageId);
   *      assert(attachmentAction.roomId);
   *      assert(attachmentAction.created);
   *      return 'success';
   *     }
   *   });
   *   // => success
   */
  create(attachmentAction) {
    return this.request({
      method: 'POST',
      service: 'hydra',
      resource: 'attachment/actions',
      body: attachmentAction,
    }).then((res) => res.body);
  },

  /**
   * Returns a single attachment action.
   * @instance
   * @memberof AttachmentActions
   * @param {string} attachmentAction
   * @returns {Promise<AttachmentActionObject>}
   * @example
   * var attachmentAction;
   * webex.rooms.create({title: 'Get Message Example'})
   *   .then(function(room) {
   *     return webex.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id,
   *       attachments:[ {
   *          contentType: 'application/vnd.microsoft.card.adaptive',
   *         content: {
   *           type: 'AdaptiveCard',
   *           version: '1.0',
   *           body: [
   *            {
   *             type: 'TextBlock',
   *             text: '',
   *             size: 'large'
   *             },
   *           {
   *             type: 'TextBlock',
   *             text: 'Adaptive Cards',
   *             separation: 'none'
   *           },
   *           {
   *           type: 'Input.Date',
   *           id: 'dueDate'
   *           }
   *       ],
   *     actions: [
   *         {
   *             type: 'Action.Submit',
   *             title: 'Due Date'
   *         }
   *     ]
   *   }
   *  }]
   *     });
   *   })
   *   .then(function(message) {
   *     return webex.attachmentActions.create({
   *      type: 'submit',
   *      messageId: message.id,
   *      inputs:{
   *        dueDate: '26/06/1995'
   *      });
   *   })
   *   .then(function(attachmentAction) {
   *     return webex.attachmentActions.get(attachmentAction.id)
   *   })
   *    .then(function(attachmentAction){
   *        var assert = require('assert');
   *        assert.deepEqual(attachmentAction, attachmentAction);
   *        return 'success';
   *      })
   *   // => success
   */
  get(attachmentAction) {
    const id = attachmentAction.id || attachmentAction;

    return this.request({
      service: 'hydra',
      resource: `attachment/actions/${id}`,
    }).then((res) => res.body.items || res.body);
  },

  /**
   * This function is called when an internal mercury events fires,
   * if the user registered for these events with the listen() function.
   * External users of the SDK should not call this function
   * @private
   * @memberof AttachmentAction
   * @param {Object} event
   * @returns {void}
   */
  onWebexApiEvent(event) {
    const {activity} = event.data;

    /* eslint-disable no-case-declarations */
    switch (activity.verb) {
      case SDK_EVENT.INTERNAL.ACTIVITY_VERB.CARD_ACTION:
        const createdEvent = this.getattachmentActionEvent(
          activity,
          SDK_EVENT.EXTERNAL.EVENT_TYPE.CREATED
        );

        if (createdEvent) {
          debug(`attachmentAction "created" payload: \
            ${JSON.stringify(createdEvent)}`);
          this.trigger(SDK_EVENT.EXTERNAL.EVENT_TYPE.CREATED, createdEvent);
        }
        break;

      default: {
        break;
      }
    }
  },

  /**
   * Constructs the data object for an event on the attachmentAction resource,
   * adhering to Hydra's Webhook data structure messages.
   * External users of the SDK should not call this function
   * @private
   * @memberof AttachmentAction
   * @param {Object} activity from mercury
   * @param {Object} event type of "webhook" event
   * @returns {Object} constructed event
   */
  getattachmentActionEvent(activity, event) {
    try {
      const sdkEvent = cloneDeep(this.eventEnvelope);
      const cluster = getHydraClusterString(this.webex, activity.target.url);

      sdkEvent.event = event;
      sdkEvent.data.created = activity.published;
      sdkEvent.actorId = constructHydraId(hydraTypes.PEOPLE, activity.actor.entryUUID, cluster);
      sdkEvent.data.roomId = constructHydraId(hydraTypes.ROOM, activity.target.id, cluster);
      sdkEvent.data.messageId = constructHydraId(hydraTypes.MESSAGE, activity.parent.id, cluster);
      sdkEvent.data.personId = constructHydraId(
        hydraTypes.PEOPLE,
        activity.actor.entryUUID,
        cluster
      );
      // Seems like it would be nice to have this, but its not in the hydra webhook
      // sdkEvent.data.personEmail =
      //   activity.actor.emailAddress || activity.actor.entryEmail;

      sdkEvent.data.id = constructHydraId(hydraTypes.ATTACHMENT_ACTION, activity.id, cluster);
      if (activity.object.inputs) {
        sdkEvent.data.inputs = activity.object.inputs;
      }
      sdkEvent.data.type = activity.object.objectType;

      return sdkEvent;
    } catch (e) {
      this.webex.logger.error(`Unable to generate SDK event from mercury \
'socket activity for attachmentAction:${event} event: ${e.message}`);

      return null;
    }
  },
});

export default AttachmentActions;
