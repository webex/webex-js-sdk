/* eslint prefer-arrow-callback: 0 */
import {assert} from '@webex/test-helper-chai';
import {skipInNode, jenkinsOnly} from '@webex/test-helper-mocha';
import {patterns} from '@webex/common';
import MeetingInfoUtil from '@webex/plugin-meetings/dist/meeting-info/utilv2';
import {createCameraStream, createMicrophoneStream} from '@webex/plugin-meetings';

import CMR from '../../utils/cmr';
import testUtils from '../../utils/testUtils';
import integrationTestUtils from '../../utils/integrationTestUtils';

require('dotenv').config();

const webexTestUsers = require('../../utils/webex-test-users');

let userSet, alice, bob, chris, guest;

const localTracks = {
  alice: {
    microphone: undefined,
    camera: undefined,
  },
  bob: {
    microphone: undefined,
    camera: undefined,
  },
  guest: {
    microphone: undefined,
    camera: undefined,
  },
};

skipInNode(describe)('plugin-meetings', () => {
  describe('space-meeting', function () {
    this.timeout(integrationTestUtils.MEDIA_TEST_TIMEOUT);
    let space = null;

    before(function setupUsers() {
      this.timeout(180000);

      return webexTestUsers
        .generateTestUsers({
          count: 4,
          whistler: process.env.WHISTLER || process.env.JENKINS,
        })
        .then((users) => {
          userSet = users;
          alice = userSet[0];
          bob = userSet[1];
          chris = userSet[2];
          guest = userSet[3];
          alice.name = 'alice';
          bob.name = 'bob';
          chris.name = 'chris';
          guest.name = 'guest';
        })
        .then(() =>
          Promise.all([testUtils.syncAndEndMeeting(alice), testUtils.syncAndEndMeeting(bob)])
        );
    });

    it('Alice starts a space meeting', () =>
      alice.webex.internal.conversation
        .create({
          displayName: 'SDK space meeting integration',
          participants: [bob, chris],
        })
        .then((conversation) => {
          assert.lengthOf(conversation.participants.items, 3);
          assert.lengthOf(conversation.activities.items, 1);
          space = conversation;
        })
        .then(async () => {
          const destinationWithType = await alice.webex.meetings.meetingInfo.fetchMeetingInfo(
            space.url,
            'CONVERSATION_URL'
          );
          const destinationNoType = await alice.webex.meetings.meetingInfo.fetchMeetingInfo(
            space.url
          );

          assert.exists(destinationNoType);
          assert.exists(destinationWithType);
          assert.exists(destinationNoType.body.meetingNumber);
          assert.exists(destinationWithType.body.meetingNumber);
        })
        .then(function aliceStartsMeeting() {
          return Promise.all([
            testUtils.delayedPromise(alice.webex.meetings.create(space.url)),
            testUtils.waitForEvents([
              {scope: alice.webex.meetings, event: 'meeting:added', user: alice},
            ]),
          ]);
        })
        .then(() =>
          Promise.all([
            testUtils.delayedPromise(alice.meeting.join()),
            testUtils.waitForEvents([
              {scope: bob.webex.meetings, event: 'meeting:added', user: bob},
              {scope: chris.webex.meetings, event: 'meeting:added', user: chris},
            ]),
          ]).then(() => {
            // TODO Renenable after unified flag is enabled
            // const {meetingNumber} = bob.meeting.meetingInfo;
            // assert(meetingNumber === alice.meeting.meetingNumber, 'meetingNumber matches alice meeting number');
          })
        ));

    xit('Should fetch user info using user hydra id with the new api', () =>
      alice.webex.rooms
        .create({title: 'sample'})
        .then((room) =>
          MeetingInfoUtil.getDestinationType({
            destination: room.creatorId,
            webex: alice.webex,
          })
        )
        .then((destinationType) => MeetingInfoUtil.getRequestBody(destinationType))
        .then((res) => {
          assert.exists(res.sipUrl, 'sipURL didnt exist');
          assert.match(res.sipUrl, patterns.email); // assert sipURL is email
        }));

    // Enable this test when we are going to enable the unified space meeeting .
    // We cannot change the config on load as the meetingInfo function loads dynamically
    xit('Should fetch meeting info using space url with the new api', async () => {
      const res = await alice.webex.meetings.meetingInfo.fetchMeetingInfo(
        space.url,
        'CONVERSATION_URL'
      );

      assert.exists(res.body.meetingNumber);
    });

    xit('Bob fetches meeting info with SIP URI before joining', async () => {
      const {sipUri} = alice.meeting;
      const res = await bob.webex.meetings.meetingInfo.fetchMeetingInfo(sipUri, 'SIP_URI');
      const {meetingNumber} = res.body;

      assert(
        meetingNumber === alice.meeting.meetingNumber,
        'meetingNumber matches alice meeting number'
      );
    });

    it('Bob and chris joins space meeting', () =>
      testUtils
        .waitForStateChange(alice.meeting, 'JOINED')
        .then(() => testUtils.waitForStateChange(bob.meeting, 'IDLE'))
        .then(() => testUtils.waitForStateChange(chris.meeting, 'IDLE'))
        .then(() => bob.meeting.join())
        .then(() => chris.meeting.join())
        // add .then checks for alice response, should see bob and chris member status to isInMeeting = true
        .then(() => testUtils.waitForStateChange(bob.meeting, 'JOINED'))
        .then(() => testUtils.waitForStateChange(chris.meeting, 'JOINED')));

    it('Bob and Alice create local microphone and camera tracks', async () => {
      localTracks.alice.microphone = await createMicrophoneStream();
      localTracks.alice.camera = await createCameraStream();

      localTracks.bob.microphone = await createMicrophoneStream();
      localTracks.bob.camera = await createCameraStream();
    });

    it('Bob and Alice addsMedia', () =>
      integrationTestUtils.addMedia(bob, {microphone: localTracks.bob.microphone, camera: localTracks.bob.camera})
        .then(() => integrationTestUtils.addMedia(alice, {microphone: localTracks.alice.microphone, camera: localTracks.alice.camera})));

    it('Bob has flowing streams on reconnect', () => {
      const waitForReceivedAudio = () =>
        new Promise((resolve, reject) => {
          const timeout = 15000;
          const statsAnalyzer = bob.meeting.statsAnalyzer;
          let availableStats = [];

          const cleanup = () => {
            clearTimeout(timeoutId);
            statsAnalyzer.off('STATS_UPDATE', onStatsUpdate);
          };

          const onStatsUpdate = ({stats}) => {
            availableStats = Array.from(stats.keys());

            const hasReceivedAudio = Array.from(stats.values()).some(
              (stat) =>
                stat.type === 'inbound-rtp' &&
                stat.kind === 'audio' &&
                stat.packetsReceived > 0
            );

            if (hasReceivedAudio) {
              cleanup();
              resolve();
            }
          };

          const timeoutId = setTimeout(() => {
            cleanup();
            reject(
              new Error(
                `No received audio packets after reconnect. Available stats: ${availableStats.join(
                  ', '
                )}`
              )
            );
          }, timeout);

          statsAnalyzer.on('STATS_UPDATE', onStatsUpdate);
        });

      return Promise.all([
        testUtils.waitForEvents([{scope: bob.meeting, event: 'media:ready'}], integrationTestUtils.MEDIA_OPERATION_TIMEOUT),
        testUtils.withTimeout(bob.meeting.reconnect(), integrationTestUtils.MEDIA_OPERATION_TIMEOUT, 'SDK reconnect() timed out'),
      ]).then(waitForReceivedAudio);
    });

    it('alice adds x user as guest to space meeting', () =>
      Promise.all([
        // Preserve the invitation's MTID when joining as a non-space participant.
        testUtils.delayedPromise(guest.webex.meetings.create(alice.meeting.meetingJoinUrl)),
        testUtils.waitForEvents([
          {scope: guest.webex.meetings, event: 'meeting:added', user: guest},
        ]),
      ])
        .then(() =>
          Promise.all([
            testUtils.delayedPromise(guest.meeting.join()),
            testUtils.waitForEvents([{scope: guest.meeting, event: 'meeting:self:lobbyWaiting'}]),
            testUtils
              .waitForEvents([{scope: alice.meeting.members, event: 'members:update'}])
              .then((response) => {
                const guestParticipant = response[0].result.delta.added.find(
                  (member) => member.participant.identity === guest.id
                );

                assert.equal(guestParticipant.status, 'IN_LOBBY');

                return Promise.all([
                  testUtils.delayedPromise(alice.meeting.admit(guestParticipant.id)),
                  testUtils.waitForEvents([
                    {scope: guest.meeting, event: 'meeting:self:guestAdmitted'},
                  ]),
                ]);
              }),
          ])
        )
        .then(() => testUtils.waitForStateChange(guest.meeting, 'JOINED'))
        .then(async () => {
          localTracks.guest.microphone = await createMicrophoneStream();
          localTracks.guest.camera = await createCameraStream();
        })
        .then(() => integrationTestUtils.addMedia(guest, {microphone: localTracks.guest.microphone, camera: localTracks.guest.camera}))
        .catch((e) => {
          console.error('Error chris joining the meeting ', e);
          throw e;
        }));

    it('alice Leaves the meeting', () =>
      Promise.all([
        testUtils.delayedPromise(alice.meeting.leave()),
        testUtils.waitForEvents([
          {
            scope: chris.meeting.members,
            event: 'members:update',
            match: testUtils.checkParticipantUpdatedStatus(alice, 'NOT_IN_MEETING'),
          },
        ]),
      ]).then(() => testUtils.waitForStateChange(alice.meeting, 'LEFT')));

    it('bob, chris and guest leave meeting', () =>
      Promise.all([
        testUtils.delayedPromise(bob.meeting.leave()),
        testUtils.waitForEvents([
          {
            scope: chris.meeting.members,
            event: 'members:update',
            match: testUtils.checkParticipantUpdatedStatus(bob, 'NOT_IN_MEETING'),
          },
        ]),
      ])
        .then(() => testUtils.waitForStateChange(bob.meeting, 'LEFT'))
        .then(() => guest.meeting.leave())
        .then(() => testUtils.waitForStateChange(guest.meeting, 'LEFT'))
        .then(() => chris.meeting.leave()));

    it('alice, bob and chris stop all local tracks', () => {
      if (localTracks.alice.microphone) {
        localTracks.alice.microphone.stop();
        localTracks.alice.microphone = undefined;
      }
      if (localTracks.alice.camera) {
        localTracks.alice.camera.stop();
        localTracks.alice.camera = undefined;
      }

      if (localTracks.bob.microphone) {
        localTracks.bob.microphone.stop();
        localTracks.bob.microphone = undefined;
      }
      if (localTracks.bob.camera) {
        localTracks.bob.camera.stop();
        localTracks.bob.camera = undefined;
      }

      if (localTracks.guest.microphone) {
        localTracks.guest.microphone.stop();
        localTracks.guest.microphone = undefined;
      }
      if (localTracks.guest.camera) {
        localTracks.guest.camera.stop();
        localTracks.guest.camera = undefined;
      }
    });

    it('check for meeting cleanup', () => new Promise((resolve, reject) => {
      const remaining = () => userSet.filter((user) => user.webex.meetings.getMeetingByType(
        'correlationId', user.meeting.correlationId
      )).map((user) => user.name);
      const cleanup = () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
      const intervalId = setInterval(() => {
        if (remaining().length === 0) {
          cleanup();
          resolve();
        }
      }, 250);
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Meetings still exist after all participants left: ${remaining().join(', ')}`));
      }, 15000);
    }));
  });

  jenkinsOnly(describe.skip)('Unclaimed PMR', () => {
    before(() =>
      webexTestUsers
        .generateTestUsers({
          count: 3,
          whistler: true,
        })
        .then((users) => {
          userSet = users;
          alice = userSet[0];
          bob = userSet[1];
          chris = userSet[2];
        })
        .then(() => testUtils.syncAndEndMeeting(alice))
        .then(() => CMR.reserve(alice.webex, false))
        .then((cmr) => {
          console.log('CMRR ', cmr);
          alice.cmr = cmr;
        })
        .catch((error) => {
          console.log('WEBEX MEETING error ', error);
        })
    );

    after(() => CMR.release(alice.webex, alice.cmr.reservationUrl));

    describe('Successful meeting', () => {
      it('alice joins the unclaimed PMR as attende', () => {
        Promise.all([
          testUtils.delayedPromise(alice.webex.meetings.create(alice.cmr.sipAddress)),
          testUtils.waitForEvents([
            {scope: alice.webex.meetings, event: 'meeting:added', user: alice},
          ]),
        ])
          .then(() => alice.meeting.join({moderator: false}))
          .then(() => testUtils.waitForStateChange(alice.meeting, 'IDLE'))
          .then(function bobChrisJoiningMeeting() {
            return bob.webex.meetings
              .create(alice.cmr.sipAddress)
              .then((m) => {
                bob.meeting = m;

                return m.join({moderator: false, pin: alice.cmr.responseMetaData.hostPin});
              })
              .then(() => chris.webex.meetings.create(alice.cmr.sipAddress))
              .then((m) => {
                chris.meeting = m;

                return m.join({moderator: false});
              })
              .then(() => testUtils.waitForStateChange(bob.meeting, 'JOINED'))
              .then(() => testUtils.waitForStateChange(chris.meeting, 'JOINED'));
          })
          .then(() => alice.meeting.leave())
          .then(() => testUtils.waitForStateChange(alice.meeting, 'LEFT'))
          .then(() => bob.meeting.leave())
          .then(() => testUtils.waitForStateChange(bob.meeting, 'LEFT'))
          .then(() => chris.meeting.leave())
          .then(() => testUtils.waitForStateChange(chris.meeting, 'LEFT'))
          .then(() =>
            Promise.all([
              testUtils.waitForCallEnded(alice, alice.sipAddress),
              testUtils.waitForCallEnded(bob, alice.sipAddress),
              testUtils.waitForCallEnded(chris, alice.sipAddress),
            ])
          );
      });

      // it('bob joins with out host pin or moderator', () => {
      //   // either we see meeting info after create or we wait for the error to determine
      // });
    });
  });

  // TODO: fix this . getting 408 conflict for leave
  jenkinsOnly(describe.skip)('Claimed PMR', () => {
    before(() =>
      webexTestUsers
        .generateTestUsers({
          count: 3,
          whistler: true,
        })
        .then((users) => {
          userSet = users;
          alice = userSet[0];
          bob = userSet[1];
          chris = userSet[2];
          alice.name = 'alice';
          bob.name = 'bob';
        })
        .then(() => testUtils.syncAndEndMeeting(alice))
        .then(() => CMR.reserve(alice.webex, true))
        .then((cmr) => {
          console.log('CMRR ', cmr);
          alice.cmr = cmr;
        })
        .catch((error) => {
          console.log('WEBEX MEETING error ', error);
        })
    );

    after(() => CMR.release(alice.webex, alice.cmr.reservationUrl));

    describe('Successful meeting', () => {
      it('alice starts a space meeting', () =>
        Promise.all([
          testUtils.delayedPromise(alice.webex.meetings.create(alice.cmr.sipAddress)),
          testUtils.waitForEvents([
            {scope: alice.webex.meetings, event: 'meeting:added', user: alice},
          ]),
        ])
          .then(() => alice.meeting.join({moderator: false}))
          .then(() => testUtils.waitForStateChange(alice.meeting, 'JOINED'))
          .then(() => bob.webex.meetings.create(alice.cmr.sipAddress))
          .then((m) => {
            bob.meeting = m;

            return m.join();
          })
          .then(() => testUtils.waitForStateChange(bob.meeting, 'JOINED'))
          .then(function bobChrisJoinMeeting() {
            return chris.webex.meetings
              .create(alice.cmr.sipAddress)
              .then((m) => {
                chris.meeting = m;

                return m.join({moderator: false});
              })
              .then(() => testUtils.waitForStateChange(chris.meeting, 'JOINED'));
          }));

      it('alice adds chris as guest to space meeting', () =>
        Promise.all([
          testUtils.delayedPromise(alice.meeting.invite({emailAddress: guest.emailAddress})),
          testUtils.waitForEvents([
            {scope: guest.webex.meetings, event: 'meeting:added', user: guest},
          ]),
          testUtils
            .waitForEvents([{scope: alice.meeting.members, event: 'members:update'}])
            .then((response) => {
              const guestParticipant = response[0].result.delta.added.find(
                (member) => guest.emailAddress === member.email
              );

              assert.equal(guestParticipant.status, 'NOT_IN_MEETING');
            }),
        ])
          .catch((e) => {
            console.error('Error adding chris as guest ', e);
            throw e;
          })
          .then(function memberUpdated() {
            assert.exists(guest.meeting);

            return Promise.all([
              testUtils.delayedPromise(guest.meeting.join()),
              testUtils.waitForEvents([{scope: guest.meeting, event: 'meeting:self:lobbyWaiting'}]),
              testUtils
                .waitForEvents([
                  {
                    scope: alice.meeting.members,
                    event: 'members:update',
                    match: testUtils.checkParticipantUpdatedStatus(guest, 'IN_LOBBY'),
                  },
                ])
                .then(() => {
                  Promise.all([
                    testUtils.delayedPromise(alice.meeting.admit(guest.meeting.members.selfId)),
                    testUtils.waitForEvents([
                      {scope: guest.meeting, event: 'meeting:self:guestAdmitted'},
                    ]),
                  ]);
                }),
            ])
              .then(() => testUtils.waitForStateChange(guest.meeting, 'JOINED'))
              .then(async () => {
                localTracks.guest.microphone = await createMicrophoneStream();
                localTracks.guest.camera = await createCameraStream();
              })
              .then(() => integrationTestUtils.addMedia(guest, {microphone: localTracks.guest.microphone, camera: localTracks.guest.camera}));
          })
          .catch((e) => {
            console.error('Error guest joining the meeting ', e);
            throw e;
          })
          .then(() =>
            Promise.all([
              testUtils.delayedPromise(chris.meeting.leave()),
              testUtils.waitForEvents([
                {
                  scope: alice.meeting.members,
                  event: 'members:update',
                  match: testUtils.checkParticipantUpdatedStatus(chris, 'NOT_IN_MEETING'),
                },
              ]),
            ])
          )
          .catch((e) => {
            console.error('Error chris leaving the meeting ', e);
            throw e;
          }));

      it('leave claimed PMR', () =>
        alice.meeting
          .leave()
          .then(() => bob.meeting.leave())
          .then(() => testUtils.waitForStateChange(alice.meeting, 'LEFT'))
          .then(() => testUtils.waitForStateChange(bob.meeting, 'LEFT'))
          .then(() => chris.meeting.leave())
          .then(() => testUtils.waitForStateChange(chris.meeting, 'LEFT'))
          .then(() =>
            Promise.all([
              testUtils.waitForCallEnded(alice, alice.sipAddress),
              testUtils.waitForCallEnded(bob, alice.sipAddress),
              testUtils.waitForCallEnded(chris, alice.sipAddress),
            ])
          .then(() => {
            if (localTracks.guest.microphone) {
              localTracks.guest.microphone.stop();
              localTracks.guest.microphone = undefined;
            }
            if (localTracks.guest.camera) {
              localTracks.guest.camera.stop();
              localTracks.guest.camera = undefined;
            }
          })
          ));
    });
  });
});
