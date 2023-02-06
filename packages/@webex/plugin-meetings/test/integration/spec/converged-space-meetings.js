import { config } from 'dotenv';

import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import {skipInNode} from '@webex/test-helper-mocha';

import {MEDIA_SERVERS} from '../../utils/constants';
import testUtils from '../../utils/testUtils';
import webexTestUsers from '../../utils/webex-test-users';

config();

skipInNode(describe)('plugin-meetings', () => {
  describe('converged-space-meeting', () => {
    let stepFailed = false;
    let users, alice, bob, chris;
    let meeting = null;
    let space = null;

    before(async () => {
      const userSet = await webexTestUsers.generateTestUsers({
        count: 3,
        whistler: process.env.WHISTLER || process.env.JENKINS,
      });

      users = userSet;
      alice = users[0];
      bob = users[1];
      chris = users[2];
      alice.name = 'alice';
      bob.name = 'bob';
      chris.name = 'chris';

      const aliceSync = testUtils.syncAndEndMeeting(alice);
      const bobSync = testUtils.syncAndEndMeeting(bob);
      const chrisSync = testUtils.syncAndEndMeeting(chris);

      await aliceSync;
      await bobSync;
      await chrisSync;
    });

    // Skip a test in this series if one failed.
    // This beforeEach() instance function must use the `function` declaration to preserve the
    // `this` context. `() => {}` will not generate the correct `this` context
    beforeEach(function() {
      if (stepFailed) {
        this.skip();
      }
    });

    // Store to the describe scope if a test has failed for skipping.
    // This beforeEach() instance function must use the `function` declaration to preserve the
    // `this` context. `() => {}` will not generate the correct `this` context
    afterEach(function() {
      if (this.currentTest.state === 'failed') {
        stepFailed = true;
      }
    });

    it('user "alice" starts a space', async () => {
      const conversation = await alice.webex.internal.conversation.create({
        participants: [bob, chris],
      });

      assert.lengthOf(conversation.participants.items, 3);
      assert.lengthOf(conversation.activities.items, 1);

      space = conversation;

      const destinationWithType = await alice.webex.meetings.meetingInfo.fetchMeetingInfo(space.url, 'CONVERSATION_URL');
      const destinationWithoutType = await alice.webex.meetings.meetingInfo.fetchMeetingInfo(space.url);

      assert.exists(destinationWithoutType);
      assert.exists(destinationWithType);
      assert.exists(destinationWithoutType.body.meetingNumber);
      assert.exists(destinationWithType.body.meetingNumber);
    });

    it('user "alice" starts a meeting', async () => {
      const wait = testUtils.waitForEvents([{
        scope: alice.webex.meetings,
        event: 'meeting:added',
        user: alice,
      }]);

      const createdMeeting = await testUtils.delayedPromise(alice.webex.meetings.create(space.url));

      await wait;

      assert.exists(createdMeeting);

      meeting = createdMeeting;
    });

    it('user "alice" joins the meeting', async () => {
      const wait = testUtils.waitForEvents([
        {scope: bob.webex.meetings, event: 'meeting:added', user: bob},
        {scope: chris.webex.meetings, event: 'meeting:added', user: chris},
      ]);

      await testUtils.delayedPromise(alice.meeting.join({enableMultistream: true}));

      await wait;

      assert.isTrue(!!alice.webex.meetings.meetingCollection.meetings[meeting.id].joinedWith);
    });

    it('users "bob" and "chris" join the meeting', async () => {
      await testUtils.waitForStateChange(alice.meeting, 'JOINED');

      const bobIdle = testUtils.waitForStateChange(bob.meeting, 'IDLE');
      const chrisIdle =  testUtils.waitForStateChange(chris.meeting, 'IDLE');

      await bobIdle;
      await chrisIdle;

      const bobJoined = testUtils.waitForStateChange(bob.meeting, 'JOINED');
      const chrisJoined =  testUtils.waitForStateChange(chris.meeting, 'JOINED');
      const bobJoin = bob.meeting.join({enableMultistream: true});
      const chrisJoin = chris.meeting.join({enableMultistream: true});

      await bobJoin;
      await chrisJoin;
      await bobJoined;
      await chrisJoined;

      assert.exists(bob.meeting.joinedWith);
      assert.exists(chris.meeting.joinedWith);
    });

    it('users "alice", "bob", and "chris" adds media', async () => {
      const addMediaAlice = testUtils.addMedia(alice, {expectedMediaReadyTypes: ['local']});
      const addMediaBob = testUtils.addMedia(bob, {expectedMediaReadyTypes: ['local']});
      const addMediaChris = testUtils.addMedia(chris, {expectedMediaReadyTypes: ['local']});

      await addMediaAlice;
      await addMediaBob;
      await addMediaChris;

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
    });

    it(`users "alice", "bob", and "chris" should be using the "${MEDIA_SERVERS.HOMER}" media server`, async () => {
      // await testUtils.waitForEvents([ // PENDING CORRECT EVENT NAMES
      //   {scope: alice.webex.meetings, event: 'media:negotiated', user: alice},
      //   {scope: bob.webex.meetings, event: 'media:negotiated', user: bob},
      //   {scope: chris.webex.meetings, event: 'media:negotiated', user: chris},
      // ]);

      assert.equal(alice.meeting.mediaProperties.webrtcMediaConnection.mediaServer, MEDIA_SERVERS.HOMER);
      assert.equal(bob.meeting.mediaProperties.webrtcMediaConnection.mediaServer, MEDIA_SERVERS.HOMER);
      assert.equal(chris.meeting.mediaProperties.webrtcMediaConnection.mediaServer, MEDIA_SERVERS.HOMER);
    });
  });
});
