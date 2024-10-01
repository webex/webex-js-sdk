import 'jsdom-global/register';
import { config } from 'dotenv';
import {assert} from '@webex/test-helper-chai';
import {skipInNode} from '@webex/test-helper-mocha';
import BrowserDetection from '@webex/plugin-meetings/dist/common/browser-detection';
import {createCameraStream, createMicrophoneStream} from '@webex/plugin-meetings';

import {MEDIA_SERVERS} from '../../utils/constants';
import testUtils from '../../utils/testUtils';
import integrationTestUtils from '../../utils/integrationTestUtils';
import webexTestUsers from '../../utils/webex-test-users';

config();

const localTracks = {
  alice: {
    microphone: undefined,
    camera: undefined,
  },
  bob: {
    microphone: undefined,
    camera: undefined,
  },
  chris: {
    microphone: undefined,
    camera: undefined,
  },
};

skipInNode(describe)('plugin-meetings', () => {
  const {isBrowser} = BrowserDetection();

  // `addMedia()` fails on FF, this needs to be debuged and fixed in a later change
  if (!isBrowser('firefox')) {
    describe('converged-space-meeting', () => {
      let shouldSkip = false;
      let users, alice, bob, chris;
      let meeting = null;
      let space = null;
      let mediaReadyListener = null;

      before('setup users', async () => {
        const userSet = await webexTestUsers.generateTestUsers({
          count: 3,
          whistler: process.env.WHISTLER || process.env.JENKINS,
          config
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
      beforeEach('check if should skip test', function() {
        if (shouldSkip) {
          this.skip();
        }
      });

      // Store to the describe scope if a test has failed for skipping.
      // This beforeEach() instance function must use the `function` declaration to preserve the
      // `this` context. `() => {}` will not generate the correct `this` context
      afterEach('check if test failed', function() {
        if (this.currentTest.state === 'failed') {
          shouldSkip = true;
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

      it('users "alice", "bob", and "chris" create local tracks', async () => {
        localTracks.alice.microphone = await createMicrophoneStream();
        localTracks.alice.camera = await createCameraStream();

        localTracks.bob.microphone = await createMicrophoneStream();
        localTracks.bob.camera = await createCameraStream();

        localTracks.chris.microphone = await createMicrophoneStream();
        localTracks.chris.camera = await createCameraStream();
      });

      it('users "alice", "bob", and "chris" add media', async () => {
        mediaReadyListener = testUtils.waitForEvents([
          {scope: alice.meeting, event: 'media:negotiated'},
          {scope: bob.meeting, event: 'media:negotiated'},
          {scope: chris.meeting, event: 'media:negotiated'},
        ]);

        const addMediaAlice = integrationTestUtils.addMedia(alice, {multistream: true, microphone: localTracks.alice.microphone, camera: localTracks.alice.camera});
        const addMediaBob = integrationTestUtils.addMedia(bob, {multistream: true, microphone: localTracks.bob.microphone, camera: localTracks.bob.camera});
        const addMediaChris = integrationTestUtils.addMedia(chris, {multistream: true, microphone: localTracks.chris.microphone, camera: localTracks.chris.camera});

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
        await mediaReadyListener;

        assert.equal(alice.meeting.mediaProperties.webrtcMediaConnection.mediaServer, MEDIA_SERVERS.HOMER);
        assert.equal(bob.meeting.mediaProperties.webrtcMediaConnection.mediaServer, MEDIA_SERVERS.HOMER);
        assert.equal(chris.meeting.mediaProperties.webrtcMediaConnection.mediaServer, MEDIA_SERVERS.HOMER);
      });

      it('users "alice", "bob", and "chris" stop their local tracks', () => {
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
  }
});
