/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/plugin-logger';
import '@webex/plugin-people';
import '@webex/plugin-messages';
import '@webex/plugin-attachment-actions';
import {SDK_EVENT} from '@webex/common';
import {assert} from '@webex/test-helper-chai';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';

const debug = require('debug')('attachmentActions');

describe('plugin-attachment-actions', function () {
  this.timeout(60000);

  let creator, spock;
  let messageSender, buttonPusher;

  before(() =>
    testUsers.create({count: 2}).then((users) => {
      [creator, spock] = users;

      // Creator will create the cards
      creator.webex = new WebexCore({
        credentials: {
          authorization: users[0].token,
        },
      });

      // Spock is the actor who will hit the Action.Submit button
      spock.webex = new WebexCore({
        credentials: {
          authorization: users[1].token,
        },
      });
      spock.webex.people
        .get('me')
        .then((person) => {
          buttonPusher = person;

          return creator.webex.people.get('me');
        })
        .then((person) => {
          messageSender = person;
        });
    })
  );

  // Stop listening for websocket events
  afterEach(() => {
    creator.webex.attachmentActions.stopListening();
    creator.webex.attachmentActions.off('created');
  });

  describe('#attachmentActions', () => {
    describe('#create()', () => {
      it('creates an attachment action and validates the attachment action created', () => {
        let message;
        const inputs = {
          formInput: 'test',
        };

        // "Block" this test with a promise that will
        // resolve after the attachmentAction:created arrives.
        const created = new Promise((resolve) => {
          creator.webex.attachmentActions.on('created', (event) => {
            debug('attachmentAction created event called');
            resolve(event);
          });
        });

        return (
          creator.webex.attachmentActions
            .listen()
            // As the creator, send the card
            .then(() =>
              creator.webex.messages
                .create({
                  toPersonId: spock.id,
                  text: 'Message',
                  attachments: [
                    {
                      contentType: 'application/vnd.microsoft.card.adaptive',
                      content: {
                        type: 'AdaptiveCard',
                        version: '1.0',
                        body: [
                          {
                            type: 'Input.Text',
                            id: 'formInput',
                            title: 'New Input.Toggle',
                            placeholder: 'Placeholder text',
                          },
                          {
                            type: 'TextBlock',
                            text: 'Adaptive Cards',
                            separation: 'none',
                          },
                        ],
                        actions: [
                          {
                            type: 'Action.OpenUrl',
                            url: 'http://adaptivecards.io',
                            title: 'Learn More',
                          },
                        ],
                      },
                    },
                  ],
                })
                .then((m) => {
                  message = m;

                  return spock.webex.attachmentActions.create({
                    // As the other user emulate an Action.Submit button press
                    type: 'submit',
                    messageId: message.id,
                    inputs,
                  });
                })
                .then(async (attachmentAction) => {
                  try {
                    validateAttachmentAction(attachmentAction, message, buttonPusher, inputs);
                    const event = await created;

                    return validateAttachmentActionEvent(
                      event,
                      attachmentAction,
                      messageSender,
                      buttonPusher
                    );
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error(`Failed validating attachmentAction: ${e.message}`);

                    return Promise.reject(e);
                  }
                })
            )
        );
      });
    });
  });

  describe('#get()', () => {
    let attachmentAction0;
    let message;
    const inputs = {
      formInput: 'test',
    };

    beforeEach(() => {
      // "Block" this test with a promise that will
      // resolve after the attachmentAction:created arrives.
      const created = new Promise((resolve) => {
        creator.webex.attachmentActions.on('created', (event) => {
          debug('attachmentAction created event called');
          resolve(event);
        });
      });

      return (
        creator.webex.attachmentActions
          .listen()
          // As the creator, send the card
          .then(() =>
            creator.webex.messages
              .create({
                toPersonId: spock.id,
                text: 'Message',
                attachments: [
                  {
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: {
                      type: 'AdaptiveCard',
                      version: '1.0',
                      body: [
                        {
                          type: 'Input.Text',
                          id: 'formInput',
                          title: 'New Input.Toggle',
                          placeholder: 'Placeholder text',
                        },
                        {
                          type: 'TextBlock',
                          text: 'Adaptive Cards',
                          separation: 'none',
                        },
                      ],
                      actions: [
                        {
                          type: 'Action.OpenUrl',
                          url: 'http://adaptivecards.io',
                          title: 'Learn More',
                        },
                      ],
                    },
                  },
                ],
              })
              .then((m) => {
                message = m;

                return spock.webex.attachmentActions.create({
                  type: 'submit',
                  messageId: message.id,
                  inputs,
                });
              })
              .then(async (attachmentAction) => {
                try {
                  attachmentAction0 = attachmentAction;
                  validateAttachmentAction(attachmentAction, message, buttonPusher, inputs);
                  const event = await created;

                  return validateAttachmentActionEvent(
                    event,
                    attachmentAction,
                    messageSender,
                    buttonPusher
                  );
                } catch (e) {
                  // eslint-disable-next-line no-console
                  console.error(`Failed validating attachmentAction: ${e.message}`);

                  return Promise.reject(e);
                }
              })
          )
      );
    });

    it('retrieves a specific attachment action', () =>
      spock.webex.attachmentActions.get(attachmentAction0).then((attachmentAction) => {
        validateAttachmentAction(attachmentAction, message, buttonPusher, inputs);
      }));
  });
});

/**
 * Validate an AttachmentAction object.
 * @param {Object} attachmentAction - object to validate
 * @param {Object} message - parent message object
 * @param {Object} actor - person object who created the attachmentAction
 * @param {Object} data - optional inputs object to check against
 * @returns {void}
 */
function validateAttachmentAction(attachmentAction, message, actor, data) {
  assert.isNotNull(attachmentAction.id);
  assert.isNotNull(attachmentAction.created);
  assert.equal(attachmentAction.type, 'submit');
  assert.equal(attachmentAction.messageId, message.id);
  assert.isObject(attachmentAction.inputs);
  assert.equal(attachmentAction.personId, actor.id);

  if (data && typeof data === 'object') {
    Object.entries(data).forEach((entry) => {
      assert.propertyVal(attachmentAction.inputs, entry[0], entry[1]);
    });
  }
}

/**
 * Validate an AttachmentAction event.
 * @param {Object} event - attachmentAction event
 * @param {Object} attachmentAction - return from the API that generate this event
 * @param {Object} messageSender - person object for user who posted the card
 * @param {Object} buttonPusher - person object for user who pushed the Action.Submit button
 * @returns {void}
 */
function validateAttachmentActionEvent(event, attachmentAction, messageSender, buttonPusher) {
  assert.isTrue(
    event.resource === SDK_EVENT.EXTERNAL.RESOURCE.ATTACHMENT_ACTIONS,
    'not an attachmentAction event'
  );
  assert.isDefined(event.event, 'attachmentAction event type not set');
  assert.isDefined(event.created, 'event listener created date not set');
  assert.equal(
    event.createdBy,
    messageSender.id,
    'event listener createdBy not set to our messageSender'
  );
  assert.equal(
    event.orgId,
    messageSender.orgId,
    "event listener orgId not === to our messageSender's"
  );
  assert.equal(event.ownedBy, 'creator', 'event listener not owned by creator');
  assert.equal(event.status, 'active', 'event listener status not active');
  assert.equal(event.actorId, buttonPusher.id, "event actorId not equal to our buttonPusher's id");

  // Ensure event data matches data returned from function call
  assert.equal(event.data.id, attachmentAction.id, 'event/attachmentAction.id not equal');
  assert.equal(
    event.data.roomId,
    attachmentAction.roomId,
    'event/attachmentAction.roomId not equal'
  );
  assert.equal(
    event.data.personId,
    attachmentAction.personId,
    'event/attachmentAction.personId not equal'
  );
  assert.equal(
    event.data.personEmail,
    attachmentAction.personEmail,
    'event/attachmentAction.personEmail not equal'
  );
  assert.equal(
    event.data.roomType,
    attachmentAction.roomType,
    'event/attachmentAction.roomType not equal'
  );

  if (event.data.inputs && typeof event.data.inputs === 'object') {
    assert.isObject(attachmentAction.inputs);
    Object.entries(event.data.inputs).forEach((entry) => {
      assert.propertyVal(attachmentAction.inputs, entry[0], entry[1]);
    });
  }
}
