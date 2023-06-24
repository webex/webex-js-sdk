/* globals navigator */
/* eslint prefer-arrow-callback: 0 */

import {assert} from '@webex/test-helper-chai';
import {skipInNode} from '@webex/test-helper-mocha';
import sinon from 'sinon';

import BrowserDetection from '@webex/plugin-meetings/dist/common/browser-detection';
import {createCameraTrack, createDisplayTrack, createMicrophoneTrack, LocalTrackEvents} from '@webex/plugin-meetings';

import testUtils from '../../utils/testUtils';
import integrationTestUtils from '../../utils/integrationTestUtils';

require('dotenv').config();

const webexTestUsers = require('../../utils/webex-test-users');

const {isBrowser} = BrowserDetection();

let userSet, alice, bob, chris, enumerateSpy, channelUrlA, channelUrlB;

const localTracks = {
  alice: {
    microphone: undefined,
    camera: undefined,
    screenShare: {
      video: undefined,
    }
  },
  bob: {
    microphone: undefined,
    camera: undefined,
    screenShare: {
      video: undefined,
    }
  },
  chris: {
    microphone: undefined,
    camera: undefined,
    screenShare: {
      video: undefined,
    }
  },
};


const waitForPublished = (track, expectedPublished, description) => {
  return testUtils.waitForEvents([{
    scope: track,
    event: LocalTrackEvents.PublishedStateUpdate,
    match: ({isPublished}) => {
      console.log(`${description} is now ${isPublished ? 'published': 'not published'}`);
      return (isPublished === expectedPublished);
    }
  }]);
};

skipInNode(describe)('plugin-meetings', () => {
  describe('journey', () => {
    before(() =>
      webexTestUsers
        .generateTestUsers({
          count: 3,
          whistler: process.env.WHISTLER || process.env.JENKINS,
        })
        .then((users) => {
          userSet = users;
          alice = userSet[0];
          bob = userSet[1];
          chris = userSet[2];
          alice.name = 'alice';
          bob.name = 'bob';
          chris.name = 'chris';
          alice.webex.meetings.name = 'alice';
          bob.webex.meetings.name = 'bob';
          chris.webex.meetings.name = 'chris';
          channelUrlA =
            'https://board-a.wbx2.com/board/api/v1/channels/49cfb550-5517-11eb-a2af-1b9e4bc3da13';
          channelUrlB =
            'https://board-a.wbx2.com/board/api/v1/channels/977a7330-54f4-11eb-b1ef-91f5eefc7bf3';
        })
        .then(() =>
          Promise.all([testUtils.syncAndEndMeeting(alice), testUtils.syncAndEndMeeting(bob)])
        )
        .catch((error) => {
          throw error;
        })
    );

    before(() => {
      enumerateSpy = sinon.spy(navigator.mediaDevices, 'enumerateDevices');
    });

    beforeEach(() => {
      enumerateSpy.resetHistory();
    });

    describe('Check configuration values', () => {
      it('properly sets the Media Quality Analyzer `metrics` config', () => {
        assert.equal(alice.webex.meetings.config.metrics.autoSendMQA, true);
        assert.equal(alice.webex.meetings.config.metrics.mqaMetricsInterval, 60000);
        assert.equal(alice.webex.meetings.config.metrics.clientType, 'WEBEX_SDK');
        assert.equal(alice.webex.meetings.config.metrics.clientName, 'WEBEX_JS_SDK');
      });
    });

    // Alice calls bob and bob rejects it
    xdescribe('End outgoing Call', () => {
      after(() => {
        alice.meeting = null;
        bob.meeting = null;
      });

      it('Alice Ends a outgoing meeting', () =>
        Promise.all([
          testUtils.delayedPromise(alice.webex.meetings.create(bob.emailAddress)),
          testUtils.waitForEvents([
            {scope: alice.webex.meetings, event: 'meeting:added', user: alice},
          ]),
        ])
          .then(() =>
            Promise.all([
              testUtils.delayedPromise(alice.meeting.join()),
              testUtils.waitForEvents([
                {scope: bob.webex.meetings, event: 'meeting:added', user: bob},
              ]),
            ])
          )
          .then(() => {
            // bob and alice have meeting object
            bob.meeting.acknowledge('INCOMING');
            assert.equal(bob.meeting.sipUri, alice.emailAddress);
            assert.equal(alice.meeting.sipUri, bob.emailAddress);
            assert.equal(bob.meeting.state, 'IDLE');
            assert.equal(alice.meeting.state, 'JOINED');
          })
          .then(function aliceLeavesMeetingAndBobGetsMeetingRemoved() {
            return Promise.all([
              testUtils.delayedPromise(alice.meeting.leave()),
              testUtils.waitForEvents([
                {scope: bob.webex.meetings, event: 'meeting:removed', user: bob},
              ]),
            ]);
          })
          .then(() => testUtils.waitForStateChange(alice.meeting, 'LEFT'))
          .then(() =>
            Promise.all([
              testUtils.waitForCallEnded(alice, bob.emailAddress),
              testUtils.waitForCallEnded(bob, alice.emailAddress),
            ])
          )
          .then(() => {
            assert.equal(alice.webex.meetings.getMeetingByType('sipUri', bob.emailAddress), null);
            assert.equal(bob.webex.meetings.getMeetingByType('sipUri', alice.emailAddress), null);
          })
          .catch((err) => {
            throw err;
          }));
    });

    // The event was coming but incomplete
    // 1) Test user doesnt have locus tag information

    // Alice calls bob and bob rejects it
    xdescribe('reject Incoming Call', () => {
      it('alice dials bob and bob receives meeting added', () =>
        Promise.all([
          testUtils.delayedPromise(alice.webex.meetings.create(bob.emailAddress)),
          testUtils.waitForEvents([
            {scope: alice.webex.meetings, event: 'meeting:added', user: alice},
          ]),
        ])
          .then(() =>
            Promise.all([
              testUtils.delayedPromise(alice.meeting.join()),
              testUtils.waitForEvents([
                {scope: bob.webex.meetings, event: 'meeting:added', user: bob},
              ]),
            ])
          )
          .then(function alicebobJoined() {
            assert.exists(bob.meeting);
            assert.exists(alice.meeting);
            assert.equal(bob.meeting.sipUri, alice.emailAddress);
            assert.equal(alice.meeting.sipUri, bob.emailAddress);
            assert.exists(bob.meeting.partner);
            assert.exists(alice.meeting.partner);
          })
          .then(function bobState() {
            testUtils.waitForStateChange(bob.meeting, 'IDLE');
          })
          .then(function aliceState() {
            testUtils.waitForStateChange(alice.meeting, 'JOINED');
          })
          .then(function bobDeclinedCall() {
            return bob.meeting
              .acknowledge('INCOMING')
              .then(() => bob.meeting.decline('BUSY'))
              .then(() => testUtils.waitForStateChange(bob.meeting, 'DECLINED'))
              .catch((e) => {
                console.error('Bob decline call not successful', e);
                throw e;
              });
          })
          .then(function aliceLeaveMeeting() {
            assert.equal(alice.meeting.state, 'JOINED');

            return alice.meeting
              .leave()
              .then(() => testUtils.waitForStateChange(alice.meeting, 'LEFT'))
              .then(() => testUtils.waitForStateChange(bob.meeting, 'DECLINED'))
              .catch((e) => {
                console.error('alice was not able to leave the meeting', e);
                throw e;
              });
          })
          .then(function WaitForMeetingEnd() {
            return Promise.all([
              testUtils.waitForCallEnded(alice, bob.emailAddress),
              testUtils.waitForCallEnded(bob, alice.emailAddress),
            ])
              .then(() => {
                assert.equal(
                  alice.webex.meetings.getMeetingByType('sipUri', bob.emailAddress),
                  null
                );
                assert.equal(
                  bob.webex.meetings.getMeetingByType('sipUri', alice.emailAddress),
                  null
                );
              })
              .catch((e) => {
                console.error('Alice bob meeting is deleted', e);
                throw e;
              });
          }));
    });

    // Enabled when config.enableUnifiedMeetings = true
    xdescribe('Conversation URL', () => {
      describe('Successful 1:1 meeting', () => {
        it('Fetch meeting information with a conversation URL for a 1:1 space', async () => {
          assert.equal(Object.keys(bob.webex.meetings.getAllMeetings()), 0);
          assert.equal(Object.keys(chris.webex.meetings.getAllMeetings()), 0);

          const conversation = await chris.webex.internal.conversation.create({
            participants: [bob],
          });

          await chris.webex.internal.conversation.post(conversation, {
            displayName: 'hello world how are you ',
          });

          await Promise.all([
            testUtils.delayedPromise(
              chris.webex.meetings.create(conversation.url, 'CONVERSATION_URL')
            ),
            testUtils.waitForEvents([
              {scope: chris.webex.meetings, event: 'meeting:added', user: chris},
            ]),
          ]).then(function chrisJoinsMeeting() {
            return Promise.all([
              testUtils.delayedPromise(chris.meeting.join()),
              testUtils
                .waitForEvents([
                  {scope: bob.webex.meetings, event: 'meeting:added', user: bob},
                  {scope: chris.meeting, event: 'meeting:stateChange', user: chris},
                ])
                .then((response) => {
                  assert.equal(response[0].result.payload.currentState, 'ACTIVE');
                }),
            ]);
          });
        });

        it('Fetch meeting information with invalid conversation URL and throws error', () => {
          chris.webex.meetings.meetingInfo
            .fetchMeetingInfo('http://some-invalid.com', 'CONVERSATION_URL')
            .then((response) => {
              assert(response.result === '404');
            });
        });
      });
    });

    describe('Successful 1:1 meeting (including Guest)', function () {
      before(() => {
        // Workaround since getDisplayMedia requires a user gesture to be activated, and this is a integration tests
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1580944
        if (isBrowser('firefox') || isBrowser('safari')) {
          sinon.replace(
            navigator.mediaDevices,
            'getDisplayMedia',
            navigator.mediaDevices.getUserMedia
          );
        }

        this.timeout(80000);
      });

      it('No previous Call', () => {
        assert.equal(Object.keys(bob.webex.meetings.getAllMeetings()), 0);
        assert.equal(Object.keys(alice.webex.meetings.getAllMeetings()), 0);

        return alice.webex.internal.conversation
          .create({participants: [bob]})
          .then((conversation) =>
            alice.webex.internal.conversation.post(conversation, {
              displayName: 'hello world how are you ',
            })
          );
      });

      it('alice creates local microphone and camera tracks', async () => {
        localTracks.alice.microphone = await createMicrophoneTrack();
        localTracks.alice.camera = await createCameraTrack();
      });

      it('alice dials bob and adds media', () =>
        Promise.all([
          testUtils.delayedPromise(alice.webex.meetings.create(bob.emailAddress)),
          testUtils.waitForEvents([
            {scope: alice.webex.meetings, event: 'meeting:added', user: alice},
          ]),
        ])
          .then(function aliceJoinsMeeting() {
            return Promise.all([
              testUtils.delayedPromise(alice.meeting.join()),
              testUtils
                .waitForEvents([
                  {scope: bob.webex.meetings, event: 'meeting:added', user: bob},
                  {scope: alice.meeting, event: 'meeting:stateChange', user: alice},
                ])
                .then((response) => {
                  assert.equal(response[0].result.payload.currentState, 'ACTIVE');
                }),
            ]);
          })
          .then(() => {
            assert.equal(bob.meeting.partner.state, 'JOINED');
            // Wait for openH264 to finsish downloading and peerConnection to be stable
            testUtils.waitUntil(4000);
          })
          .then(() =>
            Promise.all([
              integrationTestUtils.addMedia(alice, {microphone: localTracks.alice.microphone, camera: localTracks.alice.camera}),
              testUtils.waitForEvents([
                {scope: alice.meeting, event: 'meeting:media:local:start', user: alice},
              ]),
            ])
          )
          .then(() => assert(enumerateSpy.called)));

      it('bob joins the meeting', () => {
        const checkBobIsInMeeting = (event) =>
          !!event.delta.updated.find(
            (member) => bob.meeting.members.selfId === member.id && member.status === 'IN_MEETING'
          );

        return Promise.all([
          bob.meeting.acknowledge('INCOMING').then(() => bob.meeting.join()),
          testUtils.waitForEvents([
            {
              scope: alice.meeting.members,
              event: 'members:update',
              user: alice,
              match: checkBobIsInMeeting,
            },
          ]),
        ]);
      });

      it('bob creates local microphone and camera tracks', async () => {
        localTracks.bob.microphone = await createMicrophoneTrack();
        localTracks.bob.camera = await createCameraTrack();
      });

      it('bob adds media to the meeting', () =>
        Promise.all([
          integrationTestUtils.addMedia(bob, {microphone: localTracks.bob.microphone, camera: localTracks.bob.camera}),
          testUtils
            .waitForEvents([
              {scope: bob.meeting, event: 'meeting:media:local:start', user: bob},
              {scope: alice.meeting, event: 'meeting:media:remote:start', user: alice},
            ])
            .catch((e) => {
              console.error('Error on remote and local start event', e);
              throw e;
            }),
        ])
          .then(() => {
            assert.equal(bob.meeting.sipUri, alice.id);
            assert.equal(alice.meeting.sipUri, bob.id);
            assert.exists(alice.meeting.members.locusUrl);
            assert.equal(alice.meeting.type, 'CALL');
            assert.equal(bob.meeting.type, 'CALL');
            assert(enumerateSpy.called);
          })
          .then(function bobState() {
            testUtils.waitForStateChange(bob.meeting, 'JOINED');
          })
          .then(function aliceState() {
            testUtils.waitForStateChange(alice.meeting, 'JOINED');
          })
          .catch((e) => {
            console.error('Error bob joins the meeting ', e);
            throw e;
          }));

      it('check for meeting properties', () => {
        assert.exists(alice.meeting.userId, 'userId not present');
        assert.exists(alice.meeting.deviceUrl, 'deviceUrl not present');
        assert.exists(alice.meeting.partner, 'partner not present');
        assert.exists(alice.meeting.type, 'type not present');
        assert.exists(alice.meeting.state, 'state not present');
        assert.exists(alice.meeting.guest, 'guest not present');
        assert.exists(alice.meeting.mediaProperties, 'mediaProperties not Present');
        assert.exists(alice.meeting.mediaProperties.mediaDirection, 'mediaDirection not present');
        assert.exists(alice.meeting.members.selfId, 'selfId not present');
      });

      it('alice Audio Mute ', async () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => alice.meeting.members.selfId === member.id && member.isAudioMuted === true
          );

        await testUtils.waitUntil(2000);

        const membersUpdate = testUtils.waitForEvents([
          {scope: bob.meeting.members, event: 'members:update', match: checkEvent},
        ]);

        localTracks.alice.microphone.setMuted(true);

        await membersUpdate;

        assert.equal(localTracks.alice.microphone.muted, true);
      });

      it('alice Audio unMute ', async () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => alice.meeting.members.selfId === member.id && member.isAudioMuted === false
          );

        await testUtils.waitUntil(2000);

        const membersUpdate = testUtils.waitForEvents([
          {scope: bob.meeting.members, event: 'members:update', match: checkEvent},
        ]);

        localTracks.alice.microphone.setMuted(false);

        await membersUpdate;

        assert.equal(localTracks.alice.microphone.muted, false);
      });

      it('alice video mute', async () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => alice.meeting.members.selfId === member.id && member.isVideoMuted === true
          );

        await testUtils.waitUntil(2000);

        const membersUpdate = testUtils.waitForEvents([
          {scope: bob.meeting.members, event: 'members:update', match: checkEvent},
        ]);

        localTracks.alice.camera.setMuted(true);

        await membersUpdate;

        assert.equal(localTracks.alice.camera.muted, true);
      });

      it('alice video unmute', async () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => alice.meeting.members.selfId === member.id && member.isVideoMuted === false
          );

        await testUtils.waitUntil(2000);

        const membersUpdate = testUtils.waitForEvents([
          {scope: bob.meeting.members, event: 'members:update', match: checkEvent},
        ]);

        localTracks.alice.camera.setMuted(false);

        await membersUpdate;

        assert.equal(localTracks.alice.camera.muted, false);
      });

      it('alice update Audio', async () => {
        const oldVideoTrackId = alice.meeting.mediaProperties.videoTrack.id;

        const oldMicrophoneTrack = localTracks.alice.microphone;
        const newMicrophoneTrack = await createMicrophoneTrack();

        assert.equal(oldMicrophoneTrack.published, true);
        assert.notEqual(oldMicrophoneTrack.id, newMicrophoneTrack.id);

        const oldTrackUnpublished = waitForPublished(oldMicrophoneTrack, false, "Alice AUDIO: old microphone track");
        const newTrackPublished = waitForPublished(newMicrophoneTrack, true, "Alice AUDIO: new microphone track");

        await testUtils.delayedPromise(
            alice.meeting
              .publishTracks({
                microphone: newMicrophoneTrack,
              })
              .then(() => {
                console.log('Alice AUDIO: new track on meeting object:', alice.meeting.mediaProperties.audioTrack);
                assert.equal(
                  alice.meeting.mediaProperties.audioTrack.id,
                  newMicrophoneTrack.id
                );
                assert.equal(alice.meeting.mediaProperties.videoTrack.id, oldVideoTrackId);
              })
          );

        await oldTrackUnpublished;
        await newTrackPublished;

        localTracks.alice.microphone = newMicrophoneTrack;
      });

      it('alice update video', async () => {
        const oldAudioTrackId = alice.meeting.mediaProperties.audioTrack.id;

        const oldCameraTrack = localTracks.alice.camera;
        const newCameraTrack = await createCameraTrack();

        assert.equal(oldCameraTrack.published, true);
        assert.notEqual(oldCameraTrack.id, newCameraTrack.id);

        const oldTrackUnpublished = waitForPublished(oldCameraTrack, false, "Alice VIDEO: old camera track");
        const newTrackPublished = waitForPublished(newCameraTrack, true, "Alice VIDEO: new camera track");

        await testUtils.delayedPromise(
            alice.meeting
              .publishTracks({
                camera: newCameraTrack,
              })
              .then(() => {
                console.log('Alice VIDEO: new track on meeting:', alice.meeting.mediaProperties.videoTrack);
                assert.equal(
                  alice.meeting.mediaProperties.videoTrack.id,
                  newCameraTrack.id
                );
                assert.equal(alice.meeting.mediaProperties.audioTrack.id, oldAudioTrackId);
              })
          );

        await oldTrackUnpublished;
        await newTrackPublished;

        localTracks.alice.camera = newCameraTrack;
      });

      it('alice mutes bob', () =>
        Promise.all([
          testUtils.delayedPromise(alice.meeting.mute(bob.meeting.members.selfId, true)),
          testUtils
            .waitForEvents([{scope: bob.meeting, event: 'meeting:self:mutedByOthers'}])
            .then((response) => {
              console.log('meeting:self:mutedByOthers event ', response[0].result);
              assert.equal(response[0].result.payload.unmuteAllowed, true);
            }),
        ]));

      it('alice unmutes bob', () =>
        Promise.all([
          testUtils.delayedPromise(alice.meeting.mute(bob.meeting.members.selfId, false)),
          testUtils
            .waitForEvents([{scope: bob.meeting, event: 'meeting:self:unmutedByOthers'}])
            .then((response) => {
              console.log('meeting:self:unmutedByOthers event ', response[0].result);
            }),
        ]));

      it('bob audio mute, so alice cannot unmute bob', async () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => bob.meeting.members.selfId === member.id && member.isAudioMuted === true
          );

        const membersUpdate = testUtils.waitForEvents([
          {scope: bob.meeting.members, event: 'members:update', match: checkEvent},
        ]);

        // first bob mutes himself
        localTracks.bob.microphone.setMuted(true);

        await membersUpdate;

        assert.equal(localTracks.bob.microphone.muted, true);

        // now alice tries to unmmute bob
        await testUtils.delayedPromise(alice.meeting.mute(bob.meeting.members.selfId, false))
          // expect the waitForEvents to timeout
          .then(() =>
            testUtils.waitForEvents(
              [{scope: bob.meeting, event: 'meeting:self:unmutedByOthers'}],
              2000
            )
          )
          .then(() => {
            assert.fail('bob received unexpected meeting:self:unmutedByOthers event');
          })
          .catch(() => {
            assert.equal(localTracks.bob.microphone.muted, true);
          });
      });

      it('bob audio unmute ', async () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => bob.meeting.members.selfId === member.id && member.isAudioMuted === false
          );

        const membersUpdate = testUtils.waitForEvents([
          {scope: alice.meeting.members, event: 'members:update', match: checkEvent},
        ]);

        localTracks.bob.microphone.setMuted(false);

        await membersUpdate;

        assert.equal(localTracks.bob.microphone.muted, false);
      });

      it('alice shares the screen with highFrameRate', async () => {
        localTracks.alice.screenShare.video = await createDisplayTrack();

        const startedSharingLocal = testUtils.waitForEvents([{scope: alice.meeting, event: 'meeting:startedSharingLocal'}]);
        const startedSharingRemote = testUtils.waitForEvents([{scope: bob.meeting, event: 'meeting:startedSharingRemote'}])
          .then((response) => {
            assert.equal(response[0].result.memberId, alice.meeting.selfId);
          });
        const bobReceivesMembersUpdate = testUtils.waitForEvents([{scope: bob.meeting.members, event: 'members:update'}])
          .then((response) => {
            console.log(
              'SCREEN SHARE RESPONSE ',
              JSON.stringify(response, testUtils.getCircularReplacer())
            );
          });
        const screenShareVideoPublished = waitForPublished(localTracks.alice.screenShare.video, true, "alice's screen share video track");

        await testUtils.delayedPromise(alice.meeting.publishTracks({screenShare: {video: localTracks.alice.screenShare.video}}));

        await screenShareVideoPublished;
        await startedSharingLocal;
        await startedSharingRemote;
        await bobReceivesMembersUpdate;

        assert.equal(alice.meeting.isSharing, true);
        assert.equal(alice.meeting.shareStatus, 'local_share_active');
        assert.equal(bob.meeting.shareStatus, 'remote_share_active');
        console.log(
          'SCREEN SHARE PARTICIPANTS ',
          JSON.stringify(alice.meeting.locusInfo.participants)
        );

        await testUtils.waitUntil(10000);
      });

      it('bob steals the screen share from alice', async () => {
        localTracks.bob.screenShare.video = await createDisplayTrack();

        const stoppedSharingLocal = testUtils.waitForEvents([{scope: alice.meeting, event: 'meeting:stoppedSharingLocal'}]);
        const startedSharingLocal = testUtils.waitForEvents([{scope: bob.meeting, event: 'meeting:startedSharingLocal'}]);
        const startedSharingRemote = testUtils.waitForEvents([{scope: alice.meeting, event: 'meeting:startedSharingRemote'}])
          .then((response) => {
            assert.equal(response[0].result.memberId, bob.meeting.selfId);
          });
        const aliceReceivesMembersUpdate = testUtils.waitForEvents([{scope: alice.meeting.members, event: 'members:update'}])
          .then((response) => {
            console.log(
              'SCREEN SHARE RESPONSE ',
              JSON.stringify(response, testUtils.getCircularReplacer())
            );
          });
        const aliceScreenShareVideoUnpublished = waitForPublished(localTracks.alice.screenShare.video, false, "alice's screen share video track");
        const bobScreenShareVideoPublished = waitForPublished(localTracks.bob.screenShare.video, true, "bob's screen share video track");

        await testUtils.delayedPromise(bob.meeting.publishTracks({screenShare: {video: localTracks.bob.screenShare.video}}));

        await bobScreenShareVideoPublished;
        await aliceScreenShareVideoUnpublished;
        await stoppedSharingLocal;
        await startedSharingLocal;
        await startedSharingRemote;
        await aliceReceivesMembersUpdate;

        localTracks.alice.screenShare.video.stop();
        localTracks.alice.screenShare.video = undefined;

        assert.equal(bob.meeting.isSharing, true);
        assert.equal(bob.meeting.shareStatus, 'local_share_active');
        assert.equal(alice.meeting.shareStatus, 'remote_share_active');

        await testUtils.waitUntil(10000);
      });

      it('bob stops sharing', async () => {
        const screenShareVideoUnpublished = waitForPublished(localTracks.bob.screenShare.video, false, "bob's screen share video track");
        const stoppedSharingLocal = testUtils.waitForEvents([{scope: bob.meeting, event: 'meeting:stoppedSharingLocal'}]);
        const stoppedSharingRemote = testUtils.waitForEvents([{scope: alice.meeting, event: 'meeting:stoppedSharingRemote'}]);

        await testUtils.delayedPromise(bob.meeting.unpublishTracks([localTracks.bob.screenShare.video]));

        await screenShareVideoUnpublished;
        await stoppedSharingLocal;
        await stoppedSharingRemote;

        localTracks.bob.screenShare.video.stop();
        localTracks.bob.screenShare.video = undefined;

        assert.equal(bob.meeting.isSharing, false);
        assert.equal(bob.meeting.shareStatus, 'no_share');
        assert.equal(alice.meeting.shareStatus, 'no_share');

        await testUtils.waitUntil(10000);
      });

      it('alice shares whiteboard A', () =>
        Promise.all([
          testUtils.delayedPromise(alice.meeting.startWhiteboardShare(channelUrlA)),
          testUtils.waitForEvents([
            {scope: alice.meeting, event: 'meeting:startedSharingWhiteboard'},
          ]),
          testUtils
            .waitForEvents([{scope: bob.meeting, event: 'meeting:startedSharingWhiteboard'}])
            .then((response) => {
              const {memberId, resourceUrl} = response[0].result;

              assert.equal(memberId, alice.meeting.selfId);
              assert.equal(resourceUrl, channelUrlA);
            }),
          testUtils
            .waitForEvents([{scope: bob.meeting.members, event: 'members:update'}])
            .then((response) => {
              console.log(
                'WHITEBOARD SHARE RESPONSE ',
                JSON.stringify(response, testUtils.getCircularReplacer())
              );
            }),
        ]).then(() => {
          assert.equal(alice.meeting.isSharing, false);
          assert.equal(alice.meeting.shareStatus, 'whiteboard_share_active');
          assert.equal(bob.meeting.shareStatus, 'whiteboard_share_active');
        }));

      it('bob steals share from alice with whiteboard B', () =>
        Promise.all([
          testUtils.delayedPromise(bob.meeting.startWhiteboardShare(channelUrlB)),
          testUtils.waitForEvents([
            {scope: bob.meeting, event: 'meeting:startedSharingWhiteboard'},
          ]),
          testUtils
            .waitForEvents([{scope: alice.meeting, event: 'meeting:startedSharingWhiteboard'}])
            .then((response) => {
              const {memberId, resourceUrl} = response[0].result;

              assert.equal(memberId, bob.meeting.selfId);
              assert.equal(resourceUrl, channelUrlB);
            }),
          testUtils
            .waitForEvents([{scope: alice.meeting.members, event: 'members:update'}])
            .then((response) => {
              console.log(
                'WHITEBOARD SHARE RESPONSE ',
                JSON.stringify(response, testUtils.getCircularReplacer())
              );
            }),
        ]).then(() => {
          assert.equal(bob.meeting.isSharing, false);
          assert.equal(alice.meeting.shareStatus, 'whiteboard_share_active');
          assert.equal(bob.meeting.shareStatus, 'whiteboard_share_active');
        }));

      it('bob stops sharing again', () =>
        Promise.all([
          // Wait for peerConnection to stabalize
          testUtils.waitUntil(20000),
          testUtils.delayedPromise(bob.meeting.stopWhiteboardShare(channelUrlB)),
          testUtils.waitForEvents([
            {scope: bob.meeting, event: 'meeting:stoppedSharingWhiteboard'},
          ]),
          testUtils.waitForEvents([
            {scope: alice.meeting, event: 'meeting:stoppedSharingWhiteboard'},
          ]),
        ]).then(() => {
          assert.equal(bob.meeting.isSharing, false);
          assert.equal(bob.meeting.shareStatus, 'no_share');
          assert.equal(alice.meeting.shareStatus, 'no_share');
        }));

      it('alice shares whiteboard B', () =>
        Promise.all([
          testUtils.delayedPromise(alice.meeting.startWhiteboardShare(channelUrlB)),
          testUtils.waitForEvents([
            {scope: alice.meeting, event: 'meeting:startedSharingWhiteboard'},
          ]),
          testUtils
            .waitForEvents([{scope: bob.meeting, event: 'meeting:startedSharingWhiteboard'}])
            .then((response) => {
              const {memberId, resourceUrl} = response[0].result;

              assert.equal(memberId, alice.meeting.selfId);
              assert.equal(resourceUrl, channelUrlB);
            }),
          testUtils
            .waitForEvents([{scope: bob.meeting.members, event: 'members:update'}])
            .then((response) => {
              console.log(
                'WHITEBOARD SHARE RESPONSE ',
                JSON.stringify(response, testUtils.getCircularReplacer())
              );
            }),
        ]).then(() => {
          assert.equal(alice.meeting.isSharing, false);
          assert.equal(alice.meeting.shareStatus, 'whiteboard_share_active');
          assert.equal(bob.meeting.shareStatus, 'whiteboard_share_active');
        }));

      it('bob steals the share from alice with desktop share', async () => {
        localTracks.bob.screenShare.video = await createDisplayTrack();

        const stoppedSharingWhiteboard = testUtils.waitForEvents([{scope: alice.meeting, event: 'meeting:stoppedSharingWhiteboard'}]);
        const startedSharingLocal = testUtils.waitForEvents([{scope: bob.meeting, event: 'meeting:startedSharingLocal'}]);
        const startedSharingRemote = testUtils.waitForEvents([{scope: alice.meeting, event: 'meeting:startedSharingRemote'}])
          .then((response) => {
            assert.equal(response[0].result.memberId, bob.meeting.selfId);
          });
        const aliceReceivesMembersUpdate = testUtils.waitForEvents([{scope: alice.meeting.members, event: 'members:update'}])
          .then((response) => {
            console.log(
              'SCREEN SHARE RESPONSE ',
              JSON.stringify(response, testUtils.getCircularReplacer())
            );
          });
        const bobScreenShareVideoPublished = waitForPublished(localTracks.bob.screenShare.video, true, "bob's screen share video track");

        await testUtils.delayedPromise(bob.meeting.publishTracks({screenShare: {video: localTracks.bob.screenShare.video}}));

        await bobScreenShareVideoPublished;
        await stoppedSharingWhiteboard;
        await startedSharingLocal;
        await startedSharingRemote;
        await aliceReceivesMembersUpdate;

        assert.equal(bob.meeting.isSharing, true);
        assert.equal(bob.meeting.shareStatus, 'local_share_active');
        assert.equal(alice.meeting.shareStatus, 'remote_share_active');

        await testUtils.waitUntil(10000);
      });

      it('bob shares whiteboard B', () =>
        Promise.all([
          testUtils.delayedPromise(bob.meeting.startWhiteboardShare(channelUrlB)),
          testUtils.waitForEvents([
            {scope: bob.meeting, event: 'meeting:startedSharingWhiteboard'},
          ]),
          testUtils
            .waitForEvents([{scope: alice.meeting, event: 'meeting:startedSharingWhiteboard'}])
            .then((response) => {
              const {memberId, resourceUrl} = response[0].result;

              assert.equal(memberId, bob.meeting.selfId);
              assert.equal(resourceUrl, channelUrlB);
            }),
          testUtils
            .waitForEvents([{scope: alice.meeting.members, event: 'members:update'}])
            .then((response) => {
              console.log(
                'WHITEBOARD SHARE RESPONSE ',
                JSON.stringify(response, testUtils.getCircularReplacer())
              );
            }),
        ]).then(() => {
          assert.equal(bob.meeting.isSharing, false);
          assert.equal(alice.meeting.shareStatus, 'whiteboard_share_active');
          assert.equal(bob.meeting.shareStatus, 'whiteboard_share_active');
        }));

      it('alice adds chris as guest to 1:1 meeting', () =>
        Promise.all([
          testUtils.delayedPromise(alice.meeting.invite({emailAddress: chris.emailAddress})),
          testUtils.waitForEvents([
            {scope: chris.webex.meetings, event: 'meeting:added', user: chris},
          ]),
          testUtils
            .waitForEvents([{scope: alice.meeting.members, event: 'members:update'}])
            .then((response) => {
              const chrisParticipant = response[0].result.delta.added.find(
                (member) => member.participant.identity === chris.id
              );

              assert.equal(chrisParticipant.status, 'NOT_IN_MEETING');
            }),
        ])
          .catch((e) => {
            console.error('Error adding chris as guest ', e);
            throw e;
          })
          .then(function memberUpdated() {
            assert.exists(chris.meeting);

            return Promise.all([
              testUtils.delayedPromise(chris.meeting.join()),
              testUtils.waitForEvents([
                {
                  scope: alice.meeting.members,
                  event: 'members:update',
                  match: testUtils.checkParticipantUpdatedStatus(chris, 'IN_MEETING'),
                },
              ]),
            ])
              .then(() => {
                assert.equal(
                  alice.meeting.members.membersCollection.get(chris.meeting.members.selfId)
                    .participant.state,
                  'JOINED'
                );
              })
              .then(() => testUtils.waitForStateChange(chris.meeting, 'JOINED'))
              .then(async () => {
                localTracks.chris.microphone = await createMicrophoneTrack();
                localTracks.chris.camera = await createCameraTrack();
              })
              .then(() => integrationTestUtils.addMedia(chris, {microphone: localTracks.chris.microphone, camera: localTracks.chris.camera}))
              .then(() => assert(enumerateSpy.called));
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
            console.error('Error chris joining the meeting ', e);
            throw e;
          }));

      it('leave on the meeting object', () => {
        const checkInactive = (result) => result.reason === 'CALL_INACTIVE';

        Promise.all([
          testUtils.delayedPromise(bob.meeting.leave()),
          testUtils.waitForEvents([
            {scope: alice.meeting.members, event: 'members:update', user: alice},
            {
              scope: bob.webex.meetings,
              event: 'meeting:removed',
              user: bob,
              match: checkInactive,
            },
            {scope: alice.webex.meetings, event: 'meeting:removed', user: alice},
          ]),
        ])
          .then(() => {
            assert.equal(bob.meeting, null);
            assert.equal(alice.meeting, null);
          })
          .then(() => testUtils.waitForCallEnded(bob, alice.emailAddress))
          .then(() => testUtils.waitForCallEnded(alice, bob.emailAddress))
          .then(() => {
            assert.equal(alice.webex.meetings.getMeetingByType('sipUri', bob.emailAddress), null);
            assert.equal(bob.webex.meetings.getMeetingByType('sipUri', alice.emailAddress), null);
          });
      });

      it('stop all local tracks', () => {
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

        if (localTracks.chris.microphone) {
          localTracks.chris.microphone.stop();
          localTracks.chris.microphone = undefined;
        }
        if (localTracks.chris.camera) {
          localTracks.chris.camera.stop();
          localTracks.chris.camera = undefined;
        }
      });
    });
  });
});
