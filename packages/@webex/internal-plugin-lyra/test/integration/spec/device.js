/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-lyra';

import {assert} from '@webex/test-helper-chai';
import retry from '@webex/test-helper-retry';
import testUsers from '@webex/test-helper-test-users';
// FIXME
// eslint-disable-next-line import/no-unresolved
import {generateRandomString} from '@ciscospark/test-users-legacy';
import WebexCore from '@webex/webex-core';
import uuid from 'uuid';

describe('plugin-lyra', () => {
  describe('Device', () => {
    let participants;
    let lyraMachine;
    let lyraSpace; // space with details of lyra URIs
    let spock;
    let conversation;

    before('create lyra machine', function () {
      this.timeout(retry.timeout(20000));

      return retry(() =>
        testUsers.create({
          count: 1,
          config: {
            machineType: 'LYRA_SPACE',
            type: 'MACHINE',
            password: `${generateRandomString(32)}d_wA*`,
          },
        })
      )
        .then((machines) => {
          lyraMachine = machines[0];
          lyraMachine.webex = new WebexCore({
            credentials: {
              authorization: lyraMachine.token,
            },
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

    before('create users', () =>
      testUsers.create({count: 2}).then((users) => {
        participants = users;
        spock = participants[0];

        return Promise.all(
          Array.map(participants, (participant) => {
            participant.webex = new WebexCore({
              credentials: {
                authorization: participant.token,
              },
            });

            return participant.webex.internal.mercury.connect();
          })
        );
      })
    );

    before('create conversation', () =>
      retry(() =>
        participants[0].webex.internal.conversation.create({
          displayName: 'Test Lyra Conversation',
          participants,
        })
      ).then((c) => {
        conversation = c;

        return conversation;
      })
    );

    describe('#getAudioState', () => {
      let audioState;

      before('put audio state', () => {
        audioState = {
          volume: {
            level: 2,
          },
          microphones: {
            muted: false,
          },
          deviceUrl: lyraMachine.webex.internal.device.url,
        };

        return lyraMachine.webex.internal.lyra.device.putAudioState(lyraMachine.space, audioState);
      });

      it('returns audio state', () =>
        lyraMachine.webex.internal.lyra.device.getAudioState(lyraMachine.space).then((res) => {
          assert.equal(res.microphones.muted, audioState.microphones.muted);
          assert.equal(res.volume.level, audioState.volume.level);
        }));
    });

    // Skip until we can bind a conversation to lyra space by posting capabilities to Lyra.
    describe.skip('when a call is in progress', () => {
      before('ensure participant joined space', () =>
        spock.webex.internal.lyra.space
          .join(lyraSpace)
          .then(() =>
            lyraMachine.webex.internal.lyra.space.verifyOccupant(lyraMachine.space, spock.id)
          )
          .then(() => spock.webex.internal.lyra.space.bindConversation(lyraSpace, conversation))
      );

      before('make a call', () => {
        const locus = {
          url: conversation.locusUrl,
          correlationId: uuid.v4(),
        };

        return spock.webex.request({
          method: 'POST',
          uri: `${locus.url}/participant`,
          body: {
            correlationId: locus.correlationId,
            deviceUrl: spock.webex.internal.device.url,
            localMedias: [],
          },
        });
      });

      after('remove binding', () =>
        spock.webex.internal.lyra.space
          .unbindConversation(lyraMachine.space, conversation)
          // After hooks shouldn't be able to break tests
          .catch((err) => console.error(err))
      );

      it('mutes', () => {
        spock.webex.internal.lyra.device.mute(lyraMachine.space);

        return lyraMachine.webex.internal.mercury
          .when('event:lyra.space_audio_microphones_mute_action')
          .then(([event]) => {
            assert.equal(event.data.action, 'mute');
          });
      });

      it('unmutes', () => {
        spock.webex.internal.lyra.device.unmute(lyraMachine.space);

        return lyraMachine.webex.internal.mercury
          .when('event:lyra.space_audio_microphones_mute_action')
          .then(([event]) => {
            assert.equal(event.data.action, 'unMute');
          });
      });

      it('increases volume', () => {
        spock.webex.internal.lyra.device.increaseVolume(lyraMachine.space);

        return lyraMachine.webex.internal.mercury
          .when('event:lyra.space_audio_volume_change_action')
          .then(([event]) => {
            assert.equal(event.data.action, 'increase');
          });
      });

      it('decreases volume', () => {
        spock.webex.internal.lyra.device.decreaseVolume(lyraMachine.space);

        return lyraMachine.webex.internal.mercury
          .when('event:lyra.space_audio_volume_change_action')
          .then(([event]) => {
            assert.equal(event.data.action, 'decrease');
          });
      });

      it('sets volume', () => {
        spock.webex.internal.lyra.device.setVolume(lyraMachine.space, 2);

        return lyraMachine.webex.internal.mercury
          .when('event:lyra.space_audio_volume_set_action')
          .then(([event]) => {
            assert.equal(event.data.level, 2);
          });
      });
    });
  });
});
