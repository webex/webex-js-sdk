/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/plugin-logger';
import '@webex/plugin-rooms';
import '@webex/plugin-people';
import '@webex/plugin-messages';
import WebexCore, { WebexHttpError } from '@webex/webex-core';
import { SDK_EVENT } from '@webex/common';
import { assert } from '@webex/test-helper-chai';
import sinon from 'sinon';
import testUsers from '@webex/test-helper-test-users';
import fh from '@webex/test-helper-file';
import { browserOnly, flaky, nodeOnly } from '@webex/test-helper-mocha';

const debug = require('debug')('messages');

const KNOWN_HOSTED_IMAGE_URL = 'https://download.ciscospark.com/test/photo.png';

describe('plugin-messages', function () {
  this.timeout(60000);

  let webex;
  let webexEU;
  let actor;
  let actorEU;

  before(() =>
    Promise.all([
      testUsers.create({ count: 1 }),
      testUsers.create({ count: 1, config: { orgId: process.env.EU_PRIMARY_ORG_ID } }),
    ]).then(([user, usersEU]) => {
      [actor] = user;
      [actorEU] = usersEU;

      webex = new WebexCore({ credentials: actor.token });
      webexEU = new WebexCore({ credentials: actorEU.token });

      webex.people.get('me').then((person) => {
        actor = person;
      });

      webexEU.people.get('me').then((person) => {
        actorEU = person;
      });
    })
  );

  describe('#messages', () => {
    let room;
    let roomEU;

    before(() =>
      Promise.all([
        webex.rooms.create({ title: 'Webex Test Room' }),
        webexEU.rooms.create({ title: 'Webex Test Room for EU' }),
      ]).then(([r, rEU]) => {
        room = r;
        roomEU = rEU;
        const text = 'First Message';

        webex.messages
          .create({
            roomId: room.id,
            text,
          })
          .then((message) => {
            validateMessage(message, text);
          });

        webexEU.messages
          .create({
            roomId: roomEU.id,
            text,
          })
          .then((message) => {
            validateMessage(message, text);
          });
      })
    );

    // eslint-disable-next-line consistent-return
    after(() => Promise.all([webex.rooms.remove(room), webexEU.rooms.remove(roomEU)]));

    afterEach(() => webex.messages.stopListening());

    describe('#create()', () => {
      it('posts a message in a room and validates the messages:created event', () => {
        let message;

        // "Block" this test with a promise that will
        // resolve after the messages:created arrives.
        const created = new Promise((resolve) => {
          webex.messages.on('created', (event) => {
            debug('message created event called');
            resolve(event);
          });
        });

        const text = 'A test message';

        return webex.messages.listen().then(() =>
          webex.messages
            .create({
              roomId: room.id,
              text,
            })
            .then(async (m) => {
              message = m;
              validateMessage(message, text);
              const event = await created;

              validateMessageEvent(event, message, actor);
            })
        );
      });

      it('posts a message by an EU user in a room and validates the messages:created event', () => {
        let message;

        // "Block" this test with a promise that will
        // resolve after the messages:created arrives.
        const created = new Promise((resolve) => {
          webexEU.messages.on('created', (event) => {
            debug('message created event called');
            resolve(event);
          });
        });

        const text = 'A test message';

        return webexEU.messages.listen().then(() =>
          webexEU.messages
            .create({
              roomId: roomEU.id,
              text,
            })
            .then(async (m) => {
              message = m;
              validateMessage(message, text);
              const event = await created;

              validateMessageEvent(event, message, actorEU);
            })
        );
      });

      it("posts a file to a room by specifying the file's url and validates the event", () => {
        const created = new Promise((resolve) => {
          webex.messages.on('created', (event) => {
            debug('message created event called');
            resolve(event);
          });
        });

        return webex.messages.listen().then(() =>
          webex.messages
            .create({
              roomId: room.id,
              files: [KNOWN_HOSTED_IMAGE_URL],
            })
            .then(async (message) => {
              validateMessage(message);
              const event = await created;

              validateMessageEvent(event, message, actor);
            })
        );
      });

      let blob, buffer;
      const text = 'A File';

      browserOnly(before)(() =>
        fh.fetch('sample-image-small-one.png').then((file) => {
          blob = file;

          return new Promise((resolve) => {
            /* global FileReader */
            const fileReader = new FileReader();

            fileReader.onload = function () {
              buffer = this.result;
              resolve();
            };
            fileReader.readAsArrayBuffer(blob);
          });
        })
      );

      nodeOnly(before)(() =>
        fh.fetchWithoutMagic('sample-image-small-one.png').then((file) => {
          buffer = file;
        })
      );

      browserOnly(it)(
        'posts a file to a room by directly supplying its blob and validates the event',
        () => {
          const created = new Promise((resolve) => {
            webex.messages.on('created', (event) => {
              debug('message created event called');
              resolve(event);
            });
          });

          return webex.messages.listen().then(() =>
            webex.messages
              .create({
                roomId: room.id,
                files: [blob],
                text,
              })
              .then(async (message) => {
                validateMessage(message);
                const event = await created;

                validateMessageEvent(event, message, actor);
              })
          );
        }
      );

      // Disabling it gating pipelines because it failes a lot and we get
      // mostly adequate coverage via blob upload
      flaky(it, process.env.SKIP_FLAKY_TESTS)(
        'posts a file to a room by directly supplying its buffer and validates the event',
        () =>
          webex.messages
            .create({
              roomId: room.id,
              files: [buffer],
            })
            .then((message) => {
              validateMessage(message, '', 1);
            })
      );

      it("posts a file with a message to a room by specifying the file's url and validates the event", () => {
        const created = new Promise((resolve) => {
          webex.messages.on('created', (event) => {
            debug('message created event called');
            resolve(event);
          });
        });

        return webex.messages.listen().then(() =>
          webex.messages
            .create({
              roomId: room.id,
              files: [KNOWN_HOSTED_IMAGE_URL],
              text,
            })
            .then(async (message) => {
              validateMessage(message);
              let event = await created;

              // When using this method to attach a file to
              // a message, sometimes, the first event does not
              // include all the data included in the message.
              // kms then triggers a second event that includes
              // all of the data in the message object.
              if (event.data.id !== message.id) {
                const createdCombined = new Promise((resolve) => {
                  webex.messages.on('created', (e) => {
                    debug('message created event called');
                    resolve(e);
                  });
                });

                event = await createdCombined;
              }

              validateMessageEvent(event, message, actor);
            })
        );
      });

      it('posts a message to a card to a room validates the event', () => {
        const created = new Promise((resolve) => {
          webex.messages.on('created', (event) => {
            debug('message created event called');
            resolve(event);
          });
        });
        const attachment = {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            version: '1.0',
            body: [
              {
                type: 'TextBlock',
                text: 'Here is an image',
              },
              {
                type: 'Image',
                url: KNOWN_HOSTED_IMAGE_URL,
                size: 'small',
              },
            ],
          },
        };

        return webex.messages.listen().then(() =>
          webex.messages
            .create({
              roomId: room.id,
              text,
              attachments: [attachment],
            })
            .then(async (message) => {
              // // Assert that the message shape is valid and contains attachment data.
              validateMessage(message, text, 0, attachment);
              let event = await created;

              // When using this method to attach a file to
              // a message, sometimes, the first event does not
              // include all the data included in the message.
              // kms then triggers a second event that includes
              // all of the data in the message object.
              if (event.data.id !== message.id) {
                const createdCombined = new Promise((resolve) => {
                  webex.messages.on('created', (e) => {
                    debug('message created event called');
                    resolve(e);
                  });
                });

                event = await createdCombined;
              }

              validateMessageEvent(event, message, actor);
            })
        );
      });
    });
    describe('#update()', () => {
      it('update a message in a room and validates the messages:update event, params message and altMessage objects', () => {
        let message;
        const text = 'This message will be updated';

        beforeEach(() =>
          webex.messages
            .create({
              roomId: room.id,
              text,
            })
            .then((m) => {
              message = m;
              validateMessage(m, text);
            })
        );

        // "Block" this test with a promise that will
        // resolve after the messages:created arrives.
        const updated = new Promise((resolve) => {
          webex.messages.on('updated', (event) => {
            debug('message updated event called');
            resolve(event);
          });
        });

        text = 'This is updated message';

        return webex.messages.listen().then(() =>
          webex.messages
            .update({
              message: message,
              altMessage: { text: text },
            })
            .then(async (m) => {
              message = m;
              validateMessage(message, text);
              const event = await updated;

              validateMessageEvent(event, message, actor);
            })
        );
      });
      it('update a message in a room and validates the messages:update event, parameter messageId,  and altMessage with text and roomId', () => {
        let message;
        const text = 'This message will be updated';

        beforeEach(() =>
          webex.messages
            .create({
              roomId: room.id,
              text,
            })
            .then((m) => {
              message = m;
              validateMessage(m, text);
            })
        );

        // "Block" this test with a promise that will
        // resolve after the messages:created arrives.
        const updated = new Promise((resolve) => {
          webex.messages.on('updated', (event) => {
            debug('message updated event called');
            resolve(event);
          });
        });

        text = 'This is updated message';

        return webex.messages.listen().then(() =>
          webex.messages
            .update({
              message: message.id,
              altMessage: {
                roomId: room.id,
                text: text
              },
            })
            .then(async (m) => {
              message = m;
              validateMessage(message, text);
              const event = await updated;
              validateMessageEvent(event, message, actor);
            })
        );
      });
    });

    describe('#remove()', () => {
      let message;
      const text = 'This message will be deleted';

      beforeEach(() =>
        webex.messages
          .create({
            roomId: room.id,
            text,
          })
          .then((m) => {
            message = m;
            validateMessage(m, text);
          })
      );

      it('deletes a single message and validates the message:deleted event', () => {
        const deleted = new Promise((resolve) => {
          webex.messages.on('deleted', (event) => {
            debug('message deleted event called');
            resolve(event);
          });
        });

        return webex.messages.listen().then(() =>
          webex.messages
            .remove(message)
            .then((body) => {
              assert.notOk(body);

              return assert.isRejected(webex.messages.get(message));
            })
            .then(async (reason) => {
              assert.instanceOf(reason, WebexHttpError.NotFound);
              const event = await deleted;

              validateMessageEvent(event, message, actor);
            })
        );
      });
    });

    describe('get()', () => {
      let message;
      const text = 'A test message';

      before(() => {
        // The above tests validate all the events
        // Turn off the event listener for the remainder of the tests
        webex.messages.off('created');
        webex.messages.off('deleted');

        return webex.messages
          .create({
            roomId: room.id,
            text,
          })
          .then((m) => {
            message = m;
            validateMessage(message, text);
          });
      });

      it('returns a single message', () =>
        webex.messages.get(message).then((m) => {
          assert.isMessage(m);
          assert.deepEqual(m, message);
        }));
    });

    describe('#list()', () => {
      before(() =>
        webex.rooms
          .create({
            title: 'Room List Test',
          })
          .then((r) => {
            room = r;
          })
      );

      before(() =>
        [1, 2, 3].reduce(
          (promise, value) =>
            promise.then(() =>
              webex.messages.create({
                roomId: room.id,
                text: `message: ${value}`,
              })
            ),
          Promise.resolve()
        )
      );

      it('returns all messages for a room', () =>
        webex.messages.list({ roomId: room.id }).then((messages) => {
          assert.isDefined(messages);
          assert.lengthOf(messages, 3);
          for (const message of messages) {
            assert.isMessage(message);
          }
        }));

      it('returns a bounded set of messages for a room', () => {
        const spy = sinon.spy();

        return webex.messages
          .list({ roomId: room.id, max: 2 })
          .then((messages) => {
            assert.lengthOf(messages, 2);

            return (function f(page) {
              for (const message of page) {
                spy(message.id);
              }

              if (page.hasNext()) {
                return page.next().then(f);
              }

              return Promise.resolve();
            })(messages);
          })
          .then(() => {
            assert.calledThrice(spy);
          });
      });

      describe('when a message is threaded', () => {
        let parentId;

        before(() =>
          webex.rooms
            .create({
              title: 'Room List Test',
            })
            .then((r) => {
              room = r;
            })
        );

        before(() => {
          const createdParent = new Promise((resolve) => {
            webex.messages.once('created', (event) => {
              debug('Threaded Test: parent message created event called');
              resolve(event);
            });
          });

          return webex.messages.listen().then(() =>
            webex.messages
              .create({
                roomId: room.id,
                text: 'This is the parent message',
              })
              .then(async (message) => {
                parentId = message.id;

                validateMessage(message);
                const event = await createdParent;

                validateMessageEvent(event, message, actor);
                const createdReply = new Promise((resolve) => {
                  webex.messages.once('created', (e) => {
                    debug('Threaded Test: reply message created event called');
                    resolve(e);
                  });
                });

                return webex.messages
                  .create({
                    roomId: room.id,
                    text: 'This is the reply',
                    parentId,
                  })
                  .then(async (message2) => {
                    validateMessage(message2);
                    const event2 = await createdReply;

                    return Promise.resolve(validateMessageEvent(event2, message2, actor));
                  });
              })
          );
        });

        it('returns all messages for a room', () =>
          webex.messages.list({ roomId: room.id }).then((messages) => {
            assert.isDefined(messages);
            assert.lengthOf(messages.items, 2);
            for (const message of messages.items) {
              assert.isMessage(message);
              if (message.parentId) {
                assert.equal(message.parentId, parentId);
              }
            }
          }));

        it('returns only the replies for particular message thread', () =>
          webex.messages.list({ roomId: room.id, parentId }).then((messages) => {
            assert.lengthOf(messages.items, 1);
            const message = messages.items[0];

            assert.isMessage(message);
            assert.strictEqual(message.parentId, parentId);
          }));
      });
    });
  });
});

/**
 * Validate a Message object.
 * @param {Object} message
 * @param {String} text -- optional message text to check
 * @param {Boolean} numFiles
 * @param {Object} attachment
 * @returns {void}
 */
function validateMessage(message, text = '', numFiles = 0, attachment = null) {
  assert.isDefined(message);
  assert.isMessage(message);
  if (text) {
    assert.equal(message.text, text);
  }
  if (attachment) {
    validateAdaptiveCard(message, attachment);
  }
  if (numFiles) {
    assert.property(message, 'files');
    assert.isDefined(message.files);
    assert.isArray(message.files);
    assert.lengthOf(message.files, numFiles);
  }
  debug('message validated');
}

/**
 * Validate a Attachment Action.
 * @param {Object} message -- message returned from the API
 * @param {Object} attachment - adaptive card object that was sent to the API
 * @returns {void}
 */
function validateAdaptiveCard(message, attachment) {
  assert.isArray(message.attachments);
  assert.isDefined(message.attachments.length);
  const card = message.attachments[0];

  // Cannot do a deepEqual compare because the image URLs are remapped
  // Validate some aspects of the card data

  assert.isDefined(card.contentType);
  assert.isDefined(attachment.contentType);
  assert.equal(card.contentType, attachment.contentType);
  assert.isDefined(card.content);
  assert.isDefined(attachment.content);
  assert.equal(card.content.type, attachment.content.type);
  assert.equal(card.content.version, attachment.content.version);
  assert.isDefined(card.content.body);
  assert.isArray(attachment.content.body);
  assert.isDefined(card.content.body.length);
  assert.equal(card.content.body.length, attachment.content.body.length);
  for (let i = 0; i < card.content.body.length; i += 1) {
    if (card.content.body[i].type.toLowerCase() === 'textblock') {
      assert.deepEqual(card.content.body[i], attachment.content.body[i]);
    }
  }
}

/**
 * Validate a Message event.
 * @param {Object} event - message event
 * @param {Object} message -- return from the API that generate this event
 * @param {Object} actor - person object for user who performed action
 * @returns {void}
 */
function validateMessageEvent(event, message, actor) {
  assert.equal(event.resource, SDK_EVENT.EXTERNAL.RESOURCE.MESSAGES, 'not a message event');
  assert.isDefined(event.event, 'message event type not set');
  assert.isDefined(event.created, 'event listener created date not set');
  assert.equal(event.createdBy, actor.id, 'event listener createdBy not set to our actor');
  assert.equal(event.orgId, actor.orgId, "event listener orgId not === to our actor's");
  assert.equal(event.ownedBy, 'creator', 'event listener not owned by creator');
  assert.equal(event.status, 'active', 'event listener status not active');
  assert.equal(event.actorId, actor.id, "event actorId not equal to our actor's id");

  // Ensure event data matches data returned from function call
  assert.equal(event.data.id, message.id, 'event/message.id not equal');
  assert.equal(event.data.roomId, message.roomId, 'event/message.roomId not equal');
  assert.equal(event.data.personId, message.personId, 'event/message.personId not equal');
  assert.equal(event.data.personEmail, message.personEmail, 'event/message.personEmail not equal');
  assert.equal(event.data.roomType, message.roomType, 'event/message.roomType not equal');
  if (event.event === SDK_EVENT.EXTERNAL.EVENT_TYPE.DELETED) {
    return;
  }
  if (message.text) {
    assert.equal(event.data.text, message.text, 'event/message.text not equal');
  }
  if (message.files) {
    assert.isArray(event.data.files, 'event.data.files is not array');
    assert.isArray(message.files, 'message.files is not array');
    assert.equal(
      event.data.files.length,
      message.files.length,
      'event/message file arrays are different lengths'
    );
    for (let i = 0; i < message.files.length; i += 1) {
      // The gateway returned by the API is apialpha.ciscospark.com
      // The gateway returned in the event is api.ciscospark.com -- expected?
      assert.equal(
        event.data.files[i].substr(event.data.files[i].lastIndexOf('/') + 1),
        message.files[i].substr(message.files[i].lastIndexOf('/') + 1),
        'event/message file urls do not match'
      );
    }
  }
  if (message.attachments) {
    assert.isArray(event.data.attachments);
    assert.isDefined(event.data.attachments.length);
    validateAdaptiveCard(message, event.data.attachments[0]);
  }
  if (message.parentId) {
    assert.equal(message.parentId, event.data.parentId);
  }
}
