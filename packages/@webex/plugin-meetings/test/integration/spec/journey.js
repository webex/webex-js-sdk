/* globals navigator */
/* eslint prefer-arrow-callback: 0 */

import {assert} from '@webex/test-helper-chai';
import {skipInNode} from '@webex/test-helper-mocha';
import sinon from 'sinon';

import BrowserDetection from '@webex/plugin-meetings/dist/common/browser-detection';

import DEFAULT_RESOLUTIONS from '../../../src/config';
import testUtils from '../../utils/testUtils';

require('dotenv').config();

const webexTestUsers = require('../../utils/webex-test-users');

const {isBrowser} = BrowserDetection();

let userSet, alice, bob, chris, enumerateSpy, channelUrlA, channelUrlB;

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
              testUtils.addMedia(alice),
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

      it('bob adds media to the meeting', () =>
        Promise.all([
          testUtils.addMedia(bob),
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

      it('alice Audio Mute ', () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => alice.meeting.members.selfId === member.id && member.isAudioMuted === true
          );

        return Promise.all([
          testUtils.delayedPromise(alice.meeting.muteAudio()),
          testUtils.waitForEvents([
            {scope: bob.meeting.members, event: 'members:update', match: checkEvent},
          ]),
        ]).then(() => {
          assert.equal(alice.meeting.audio.muted, true);
          assert.equal(alice.meeting.isAudioMuted(), true);
        });
      });

      it('alice Audio unMute ', () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => alice.meeting.members.selfId === member.id && member.isAudioMuted === false
          );

        return Promise.all([
          testUtils.delayedPromise(alice.meeting.unmuteAudio()),
          testUtils.waitForEvents([
            {scope: bob.meeting.members, event: 'members:update', match: checkEvent},
          ]),
        ]).then(() => {
          assert.equal(alice.meeting.audio.muted, false);
          assert.equal(alice.meeting.isAudioMuted(), false);
        });
      });

      it('alice Video Mute', () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => alice.meeting.members.selfId === member.id && member.isVideoMuted === true
          );

        return Promise.all([
          testUtils.delayedPromise(alice.meeting.muteVideo()),
          testUtils.waitForEvents([
            {scope: alice.meeting.members, event: 'members:update', match: checkEvent},
          ]),
        ]).then(() => {
          assert.equal(alice.meeting.video.muted, true);
          assert.equal(alice.meeting.isVideoMuted(), true);
        });
      });

      it('alice video unMute', () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => alice.meeting.members.selfId === member.id && member.isVideoMuted === false
          );

        return Promise.all([
          testUtils.delayedPromise(alice.meeting.unmuteVideo()),
          testUtils.waitForEvents([
            {scope: bob.meeting.members, event: 'members:update', match: checkEvent},
          ]),
        ]).then(() => {
          assert.equal(alice.meeting.video.muted, false);
          assert.equal(alice.meeting.isVideoMuted(), false);
        });
      });

      it('alice update Audio', () => {
        const oldVideoTrackId = alice.meeting.mediaProperties.videoTrack.id;

        return alice.meeting.getMediaStreams({sendAudio: true}).then((response) =>
          Promise.all([
            testUtils.delayedPromise(
              alice.meeting
                .updateAudio({
                  sendAudio: true,
                  receiveAudio: true,
                  stream: response[0],
                })
                .then(() => {
                  console.log(
                    'AUDIO ',
                    alice.meeting.mediaProperties.peerConnection.audioTransceiver.sender.track
                  );
                  assert.equal(
                    alice.meeting.mediaProperties.audioTrack.id,
                    response[0].getAudioTracks()[0].id
                  );
                  assert.equal(alice.meeting.mediaProperties.videoTrack.id, oldVideoTrackId);
                })
            ),
            testUtils
              .waitForEvents([{scope: alice.meeting, event: 'media:ready'}])
              .then((response) => {
                console.log('MEDIA:READY event ', response[0].result);
                assert.equal(response[0].result.type === 'local', true);
              }),
          ])
        );
      });

      it('alice update video', () => {
        const oldAudioTrackId = alice.meeting.mediaProperties.audioTrack.id;

        return alice.meeting.getMediaStreams({sendVideo: true}).then((response) =>
          Promise.all([
            testUtils.delayedPromise(
              alice.meeting
                .updateVideo({
                  sendVideo: true,
                  receiveVideo: true,
                  stream: response[0],
                })
                .then(() => {
                  assert.equal(
                    alice.meeting.mediaProperties.videoTrack.id,
                    response[0].getVideoTracks()[0].id
                  );
                  assert.equal(alice.meeting.mediaProperties.audioTrack.id, oldAudioTrackId);
                })
            ),
            testUtils
              .waitForEvents([{scope: alice.meeting, event: 'media:ready'}])
              .then((response) => {
                console.log('MEDIA:READY event ', response[0].result);
                assert.equal(response[0].result.type === 'local', true);
              }),
          ])
        );
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

      it('bob audio mute, so alice cannot unmute bob', (done) => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => bob.meeting.members.selfId === member.id && member.isAudioMuted === true
          );

        // first bob mutes himself
        Promise.all([
          testUtils.delayedPromise(bob.meeting.muteAudio()),
          testUtils.waitForEvents([
            {scope: bob.meeting.members, event: 'members:update', match: checkEvent},
          ]),
        ])
          .then(() => {
            assert.equal(bob.meeting.audio.muted, true);
            assert.equal(bob.meeting.isAudioMuted(), true);
          })
          // now alice tries to unmmut bob
          .then(() =>
            testUtils.delayedPromise(alice.meeting.mute(bob.meeting.members.selfId, false))
          )
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
            assert.equal(bob.meeting.audio.muted, true);
            assert.equal(bob.meeting.isAudioMuted(), true);
            done();
          });
      });

      it('bob audio unmute ', () => {
        const checkEvent = (event) =>
          !!event.delta.updated.find(
            (member) => bob.meeting.members.selfId === member.id && member.isAudioMuted === false
          );

        return Promise.all([
          testUtils.delayedPromise(bob.meeting.unmuteAudio()),
          testUtils.waitForEvents([
            {scope: alice.meeting.members, event: 'members:update', match: checkEvent},
          ]),
        ]).then(() => {
          assert.equal(bob.meeting.audio.muted, false);
          assert.equal(bob.meeting.isAudioMuted(), false);
        });
      });

      it('alice shares the screen with highFrameRate', () =>
        Promise.all([
          testUtils.delayedPromise(
            alice.meeting.shareScreen({sharePreferences: {highFrameRate: true}})
          ),
          testUtils.waitForEvents([{scope: alice.meeting, event: 'meeting:startedSharingLocal'}]),
          testUtils
            .waitForEvents([{scope: bob.meeting, event: 'meeting:startedSharingRemote'}])
            .then((response) => {
              assert.equal(response[0].result.memberId, alice.meeting.selfId);
            }),
          testUtils
            .waitForEvents([{scope: bob.meeting.members, event: 'members:update'}])
            .then((response) => {
              console.log(
                'SCREEN SHARE RESPONSE ',
                JSON.stringify(response, testUtils.getCircularReplacer())
              );
            }),
          testUtils
            .waitForEvents([{scope: alice.meeting, event: 'media:ready'}])
            .then((response) => {
              console.log('MEDIA:READY event ', response[0].result);
              assert.equal(response[0].result.type === 'localShare', true);
            }),
        ]).then(() => {
          // TODO: Re-eanable Safari when screensharing issues have been resolved
          if (!isBrowser('safari')) {
            assert.equal(alice.meeting.mediaProperties.shareTrack.getConstraints().height, 720);
          }
          assert.equal(alice.meeting.isSharing, true);
          assert.equal(alice.meeting.shareStatus, 'local_share_active');
          assert.equal(bob.meeting.shareStatus, 'remote_share_active');
          console.log(
            'SCREEN SHARE PARTICIPANTS ',
            JSON.stringify(alice.meeting.locusInfo.participants)
          );

          return testUtils.waitUntil(10000);
        }));

      it('bob steals the screen share from alice', () =>
        Promise.all([
          testUtils.delayedPromise(bob.meeting.shareScreen()),
          testUtils.waitForEvents([{scope: alice.meeting, event: 'meeting:stoppedSharingLocal'}]),
          testUtils.waitForEvents([{scope: bob.meeting, event: 'meeting:startedSharingLocal'}]),
          testUtils
            .waitForEvents([{scope: alice.meeting, event: 'meeting:startedSharingRemote'}])
            .then((response) => {
              assert.equal(response[0].result.memberId, bob.meeting.selfId);
            }),
          testUtils
            .waitForEvents([{scope: alice.meeting.members, event: 'members:update'}])
            .then((response) => {
              console.log(
                'SCREEN SHARE RESPONSE ',
                JSON.stringify(response, testUtils.getCircularReplacer())
              );
            }),
          testUtils.waitForEvents([{scope: bob.meeting, event: 'media:ready'}]).then((response) => {
            console.log('MEDIA:READY event ', response[0].result);
            assert.equal(response[0].result.type === 'localShare', true);
          }),
        ]).then(() => {
          const heightResolution = DEFAULT_RESOLUTIONS.meetings.screenResolution.idealHeight;

          // TODO: Re-eanable Safari when screensharing issues have been resolved
          if (!isBrowser('safari')) {
            assert.equal(
              bob.meeting.mediaProperties.shareTrack.getConstraints().height,
              heightResolution
            );
          }
          assert.equal(bob.meeting.isSharing, true);
          assert.equal(bob.meeting.shareStatus, 'local_share_active');
          assert.equal(alice.meeting.shareStatus, 'remote_share_active');

          return testUtils.waitUntil(10000);
        }));

      it('bob stops sharing ', () =>
        Promise.all([
          // Wait for peerConnection to stabalize
          testUtils.waitUntil(20000),
          testUtils.delayedPromise(
            bob.meeting.updateShare({
              sendShare: false,
              receiveShare: true,
            })
          ),
          testUtils.waitForEvents([{scope: bob.meeting, event: 'meeting:stoppedSharingLocal'}]),
          testUtils.waitForEvents([{scope: alice.meeting, event: 'meeting:stoppedSharingRemote'}]),
        ]).then(() => {
          assert.equal(bob.meeting.isSharing, false);
          assert.equal(bob.meeting.shareStatus, 'no_share');
          assert.equal(alice.meeting.shareStatus, 'no_share');
        }));

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

      it('bob stops sharing ', () =>
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

      it('bob steals the share from alice with desktop share', () =>
        Promise.all([
          testUtils.delayedPromise(bob.meeting.shareScreen()),
          testUtils.waitForEvents([
            {scope: alice.meeting, event: 'meeting:stoppedSharingWhiteboard'},
          ]),
          testUtils.waitForEvents([{scope: bob.meeting, event: 'meeting:startedSharingLocal'}]),
          testUtils
            .waitForEvents([{scope: alice.meeting, event: 'meeting:startedSharingRemote'}])
            .then((response) => {
              assert.equal(response[0].result.memberId, bob.meeting.selfId);
            }),
          testUtils
            .waitForEvents([{scope: alice.meeting.members, event: 'members:update'}])
            .then((response) => {
              console.log(
                'SCREEN SHARE RESPONSE ',
                JSON.stringify(response, testUtils.getCircularReplacer())
              );
            }),
          testUtils.waitForEvents([{scope: bob.meeting, event: 'media:ready'}]).then((response) => {
            console.log('MEDIA:READY event ', response[0].result);
            assert.equal(response[0].result.type === 'localShare', true);
          }),
        ]).then(() => {
          const heightResolution = DEFAULT_RESOLUTIONS.meetings.screenResolution.idealHeight;

          // TODO: Re-eanable Safari when screensharing issues have been resolved
          if (!isBrowser('safari')) {
            assert.equal(
              bob.meeting.mediaProperties.shareTrack.getConstraints().height,
              heightResolution
            );
          }
          assert.equal(bob.meeting.isSharing, true);
          assert.equal(bob.meeting.shareStatus, 'local_share_active');
          assert.equal(alice.meeting.shareStatus, 'remote_share_active');

          return testUtils.waitUntil(10000);
        }));

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
              .then(() => testUtils.addMedia(chris))
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
    });
  });
});
