/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import bowser from 'bowser';
import '@webex/internal-plugin-lyra';
import {assert} from '@webex/test-helper-chai';
import retry from '@webex/test-helper-retry';
import testUsers from '@webex/test-helper-test-users';
// FIXME
// eslint-disable-next-line import/no-unresolved
import {generateRandomString} from '@ciscospark/test-users-legacy';
import WebexCore from '@webex/webex-core';
import '@webex/internal-plugin-locus';

describe('plugin-lyra', function () {
  this.timeout(30000);
  describe('Space', () => {
    let participants;
    let lyraMachine;
    let lyraSpace; // space with details of lyra URIs
    let spock;
    let conversation;

    before('create lyra machine', function () {
      this.timeout(retry.timeout(20000));

      return retry(() => testUsers.create({
        count: 1,
        config: {
          machineType: 'LYRA_SPACE',
          type: 'MACHINE',
          password: `${generateRandomString(32)}d_wA*`
        }
      }))
        .then((machines) => {
          lyraMachine = machines[0];
          lyraMachine.webex = new WebexCore({
            credentials: {
              authorization: lyraMachine.token
            }
          });

          // binding to conversation only works with webex board device
          lyraMachine.webex.internal.device.config.defaults.deviceType = 'SPARK_BOARD';
          lyraMachine.webex.internal.device.config.defaults.model = 'WebexBoard Test';
          lyraMachine.webex.internal.device.config.defaults.localizedModel = 'WebexJSSDKTest';
          lyraMachine.webex.internal.device.config.defaults.systemVersion = 'WebexJSSDKTest';
          lyraMachine.webex.internal.device.config.defaults.systemName = 'Darling';

          return lyraMachine.webex.internal.mercury.connect();
        })
        .then(() => lyraMachine.webex.internal.lyra.space.get({id: lyraMachine.id}))
        .then((space) => {
          lyraMachine.space = space;
          lyraSpace = Object.assign({}, space, {url: `/spaces/${space.identity.id}`});
        });
    });

    before('create users', () => testUsers.create({count: 2})
      .then((users) => {
        participants = users;
        spock = participants[0];

        return Promise.all(Array.map(participants, (participant) => {
          participant.webex = new WebexCore({
            credentials: {
              authorization: participant.token
            }
          });

          return participant.webex.internal.mercury.connect();
        }));
      }));

    before('create conversation', () => retry(() => participants[0].webex.internal.conversation.create({
      displayName: 'Test Lyra Conversation',
      participants
    }))
      .then((c) => {
        conversation = c;

        return conversation;
      }));

    describe('#list()', () => {
      before('ensure participant joined space', () => spock.webex.internal.lyra.space.join(lyraSpace));

      it('returns spaces', () => spock.webex.internal.lyra.space.list()
        .then((spaces) => {
          assert.lengthOf(spaces, 1);
          assert.deepEqual(spaces[0].identity, lyraMachine.space.identity);
        }));
    });

    describe('#get()', () => {
      it('returns space info', () => spock.webex.internal.lyra.space.get(lyraMachine.space)
        .then((lyraSpace) => assert.deepEqual(lyraMachine.space.identity, lyraSpace.identity)));
    });

    describe('#join()', () => {
      it('adds the current user to lyra space', () => spock.webex.internal.lyra.space.join(lyraSpace)
        .then(() => lyraMachine.webex.internal.lyra.space.get(lyraMachine.space))
        .then((lyraSpace) => {
          assert.lengthOf(lyraSpace.occupants.items, 1);
          assert.equal(lyraSpace.occupants.items[0].identity.id, spock.id);
        }));
    });

    describe('#leave()', () => {
      it('removes the current user from lyra space', () => spock.webex.internal.lyra.space.join(lyraSpace)
        .then(() => spock.webex.internal.lyra.space.leave(lyraSpace))
        .then(() => lyraMachine.webex.internal.lyra.space.get(lyraMachine.space))
        .then((lyraSpace) => assert.lengthOf(lyraSpace.occupants.items, 0)));

      describe('when a user has multiple devices in the space', () => {
        before('add another device', () => {
          spock.webex2 = new WebexCore({
            credentials: {
              authorization: spock.token
            }
          });

          return spock.webex2.internal.device.register()
            .then(() => spock.webex.internal.lyra.space.join(lyraSpace))
            .then(() => spock.webex2.internal.lyra.space.join(lyraSpace));
        });

        it('removes all devices from lyra space', () => spock.webex.internal.lyra.space.leave(lyraSpace, {
          removeAllDevices: true
        })
          .then(() => lyraMachine.webex.internal.lyra.space.get(lyraMachine.space))
          .then((lyraSpace) => assert.lengthOf(lyraSpace.occupants.items, 0)));
      });
    });


    // Skip until we can bind a conversation to lyra space by posting capabilities to Lyra.

    describe.skip('#bindConversation()', () => {
      before('ensure participant joined space', () => spock.webex.internal.lyra.space.join(lyraSpace)
        .then(() => lyraMachine.webex.internal.lyra.space.verifyOccupant(lyraMachine.space, spock.id))
        .then(() => spock.webex.internal.lyra.space.bindConversation(lyraSpace, conversation)));

      after('remove binding', () => spock.webex.internal.lyra.space.unbindConversation(lyraSpace, conversation)
        // After hooks shouldn't be able to break tests
        .catch((err) => console.error(err)));

      it('binds conversation and lyra space', () => spock.webex.internal.lyra.space.getCurrentBindings(lyraMachine.space)
        .then(({bindings}) => {
          assert.lengthOf(bindings, 1);
          assert.equal(bindings[0].conversationUrl, conversation.url);
        }));
    });

    describe.skip('#unbindConversation()', () => {
      before('ensure participant joined space', () => spock.webex.internal.lyra.space.join(lyraSpace)
        .then(() => lyraMachine.webex.internal.lyra.space.verifyOccupant(lyraMachine.space, spock.id))
        .then(() => spock.webex.internal.lyra.space.bindConversation(lyraSpace, conversation))
        .then(() => spock.webex.internal.lyra.space.getCurrentBindings(lyraMachine.space))
        .then(({bindings}) => assert.lengthOf(bindings, 1)));

      // Skip this feature in IE. We do not support it at this time.
      (bowser.msie ? it.skip : it)('removes the binding between conversation and lyra space', () => spock.webex.internal.lyra.space.unbindConversation(lyraSpace, conversation)
        .then(() => spock.webex.internal.lyra.space.getCurrentBindings(lyraMachine.space))
        .then(({bindings}) => assert.lengthOf(bindings, 0)));
    });

    describe.skip('#deleteBinding()', () => {
      let bindingId;

      before('ensure participant joined space', () => spock.webex.internal.lyra.space.join(lyraSpace)
        .then(() => lyraMachine.webex.internal.lyra.space.verifyOccupant(lyraMachine.space, spock.id))
        .then(() => spock.webex.internal.lyra.space.bindConversation(lyraSpace, conversation))
        .then(() => spock.webex.internal.lyra.space.getCurrentBindings(lyraMachine.space))
        .then(({bindings}) => {
          assert.lengthOf(bindings, 1);
          bindingId = bindings[0].bindingUrl.split('/').pop();
        }));

      // Skip this feature in IE. We do not support it at this time.
      (bowser.msie ? it.skip : it)('removes the binding between conversation and lyra space', () => spock.webex.internal.lyra.space.deleteBinding(lyraMachine.space, {kmsResourceObjectUrl: conversation.kmsResourceObjectUrl, bindingId})
        .then(() => spock.webex.internal.lyra.space.getCurrentBindings(lyraMachine.space))
        .then(({bindings}) => assert.lengthOf(bindings, 0)));
    });
  });
});
