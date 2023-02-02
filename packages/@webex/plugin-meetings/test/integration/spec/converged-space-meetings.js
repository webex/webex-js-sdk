import { config } from 'dotenv';

import {assert} from '@webex/test-helper-chai';
import {skipInNode} from '@webex/test-helper-mocha';

import testUtils from '../../utils/testUtils';
import webexTestUsers from '../../utils/webex-test-users';

config();

skipInNode(describe)('plugin-meetings', () => {
  describe('converged-space-meeting', () => {
    let users, alice, bob, chris;
    let meeting = null;
    let space = null;

    before(() => webexTestUsers.generateConvergedTestUsers({
        count: 3,
        whistler: process.env.WHISTLER || process.env.JENKINS,
      }).then((userSet) => {
        users = userSet;
        alice = users[0];
        bob = users[1];
        chris = users[2];
        alice.name = 'alice';
        bob.name = 'bob';
        chris.name = 'chris';
      }).then(() => Promise.all([
        testUtils.syncAndEndMeeting(alice),
        testUtils.syncAndEndMeeting(bob),
      ])).catch((error) => {
        console.log(error);
      })
    );

    it('user "alice" starts a space', () =>
      alice.webex.internal.conversation.create({
        participants: [bob, chris],
      }).then((conversation) => {
        assert.lengthOf(conversation.participants.items, 3);
        assert.lengthOf(conversation.activities.items, 1);
        space = conversation;
      }).then(() => Promise.all([
        alice.webex.meetings.meetingInfo.fetchMeetingInfo(space.url, 'CONVERSATION_URL'),
        alice.webex.meetings.meetingInfo.fetchMeetingInfo(space.url),
      ])).then(([destinationWithType, destinationWithoutType]) => {
        assert.exists(destinationWithoutType);
        assert.exists(destinationWithType);
        assert.exists(destinationWithoutType.body.meetingNumber);
        assert.exists(destinationWithType.body.meetingNumber);
      }),
    );

    it('user "alice" starts a meeting', () =>
      Promise.all([
        testUtils.delayedPromise(alice.webex.meetings.create(space.url)),
        testUtils.waitForEvents([{
          scope: alice.webex.meetings,
          event: 'meeting:added',
          user: alice,
        }]),
      ]).then(([createdMeeting]) => {
        assert.exists(createdMeeting);

        meeting = createdMeeting;
      }),
    );

    it('user "alice" joins the meeting', () =>
      Promise.all([
        testUtils.delayedPromise(alice.meeting.join({enableMultistream: true})),
        testUtils.waitForEvents([
          {scope: bob.webex.meetings, event: 'meeting:added', user: bob},
          {scope: chris.webex.meetings, event: 'meeting:added', user: chris},
        ]),
      ]).then(() => {
        assert.isTrue(!!alice.webex.meetings.meetingCollection.meetings[meeting.id].joinedWith);
      }),
    );

    it('users "bob" and "chris" join the meeting', () =>
      testUtils.waitForStateChange(alice.meeting, 'JOINED')
        .then(() => Promise.all([
          testUtils.waitForStateChange(bob.meeting, 'IDLE'),
          testUtils.waitForStateChange(chris.meeting, 'IDLE'),
        ])).then(() => Promise.all([
          bob.meeting.join({enableMultistream: true}),
          chris.meeting.join({enableMultistream: true}),
        ])).then(() => Promise.all([
          testUtils.waitForStateChange(bob.meeting, 'JOINED'),
          testUtils.waitForStateChange(chris.meeting, 'JOINED'),
        ])).then(() => {
          assert.exists(bob.meeting.joinedWith);
          assert.exists(chris.meeting.joinedWith);
        }),
    );

    it('user "alice", "bob", and "chris" adds media', () =>
      Promise.all([
        testUtils.addMedia(alice, {streams: ['local']}),
        testUtils.addMedia(bob, {streams: ['local']}),
        testUtils.addMedia(chris, {streams: ['local']}),
      ])
        .then(() => {
          assert.isTrue(alice.meeting.mediaProperties.mediaDirection.sendAudio);
          assert.isTrue(alice.meeting.mediaProperties.mediaDirection.sendVideo);
          assert.isTrue(alice.meeting.mediaProperties.mediaDirection.receiveAudio);
          assert.isTrue(alice.meeting.mediaProperties.mediaDirection.receiveVideo);
          assert.isTrue(bob.meeting.mediaProperties.mediaDirection.sendAudio);
          assert.isTrue(bob.meeting.mediaProperties.mediaDirection.sendVideo);
          assert.isTrue(bob.meeting.mediaProperties.mediaDirection.receiveAudio);
          assert.isTrue(bob.meeting.mediaProperties.mediaDirection.receiveVideo);
          assert.isTrue(chris.meeting.mediaProperties.mediaDirection.sendAudio);
          assert.isTrue(chris.meeting.mediaProperties.mediaDirection.sendVideo);
          assert.isTrue(chris.meeting.mediaProperties.mediaDirection.receiveAudio);
          assert.isTrue(chris.meeting.mediaProperties.mediaDirection.receiveVideo);
        })
    );

    it('user "alice", "bob", and "chris" should be using the "homer" roap connection service', () => {
        assert.equal(alice.meeting.mediaProperties.webrtcMediaConnection.roapConnectionService, 'homer');
        assert.equal(bob.meeting.mediaProperties.webrtcMediaConnection.roapConnectionService, 'homer');
        assert.equal(chris.meeting.mediaProperties.webrtcMediaConnection.roapConnectionService, 'homer');
    });
  });
});
