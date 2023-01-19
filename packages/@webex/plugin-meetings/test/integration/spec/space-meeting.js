/* eslint prefer-arrow-callback: 0 */
import {assert} from '@webex/test-helper-chai';
import {skipInNode, jenkinsOnly} from '@webex/test-helper-mocha';
import {patterns} from '@webex/common';
import MeetingInfoUtil from '@webex/plugin-meetings/dist/meeting-info/utilv2';

import CMR from '../../utils/cmr';
import testUtils from '../../utils/testUtils';

require('dotenv').config();

const webexTestUsers = require('../../utils/webex-test-users');

let userSet, alice, bob, chris, guest;

skipInNode(describe)('plugin-meetings', () => {
  describe('space-meeting', () => {
    let space = null;

    before(() =>
      webexTestUsers
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
        )
        .catch((error) => {
          console.log(error);
        })
    );

    it('Alice starts a space meeting', () =>
      alice.webex.internal.conversation
        .create({participants: [bob, chris]})
        .then((conversation) => {
          assert.lengthOf(conversation.participants.items, 3);
          assert.lengthOf(conversation.activities.items, 1);
          console.log('CONVERSATION', conversation);
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

    it('Bob and Alice addsMedia', () =>
      testUtils.addMedia(bob).then(() => testUtils.addMedia(alice)));

    it('Bob has flowing streams on reconnect', () => {
      const retrieveStats = () => {
        assert.isAbove(
          bob.meeting.statsAnalyzer.statsResults.audio.recv.totalPacketsReceived,
          0,
          'total packets received greater than 0'
        );
      };

      return Promise.all([
        testUtils.delayedPromise(bob.meeting.reconnect()),
        testUtils.waitForEvents([{scope: bob.meeting, event: 'media:ready'}]),
        testUtils.delayedTest(retrieveStats, 9000),
      ]).catch((error) => {
        // eslint-disable-next-line no-console
        console.warn('errror', error);
      });
    });

    it('alice adds x user as guest to space meeting', () =>
      Promise.all([
        testUtils.delayedPromise(guest.webex.meetings.create(alice.meeting.sipUri)),
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
        .then(() => testUtils.addMedia(guest))
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

    it('bob and chris leave meeting', () =>
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
        .then(() => chris.meeting.leave())
        .then(() => testUtils.waitUntil(4000)));

    it('check for meeting cleanup', () => {
      console.log('Alice ', alice.webex.meetings.getAllMeetings());
      console.log('Bob ', bob.webex.meetings.getAllMeetings());
      console.log('Chris ', chris.webex.meetings.getAllMeetings());
      assert.notExists(
        alice.webex.meetings.getMeetingByType('correlationId', alice.meeting.correlationId),
        'alice meeting exists'
      );
      assert.notExists(
        bob.webex.meetings.getMeetingByType('correlationId', bob.meeting.correlationId),
        'bob meeting exists'
      );
      assert.notExists(
        chris.webex.meetings.getMeetingByType('correlationId', chris.meeting.correlationId),
        'chris meeting exists'
      );
    });
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
              .then(() => testUtils.addMedia(guest));
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
          ));
    });
  });
});
