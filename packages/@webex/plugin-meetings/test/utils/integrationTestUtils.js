import {assert} from '@webex/test-helper-chai';
import {Defer} from '@webex/common';

import testUtils from './testUtils';

// SDP alone can take 35 seconds, followed by ICE/DTLS connection setup.
const MEDIA_OPERATION_TIMEOUT = 80000;
// A test can set up two participants in sequence, as in space-meeting.
const MEDIA_TEST_TIMEOUT = 180000;

const addMedia = async (user, options = {}) => {
  const {microphone, camera} = options;
  let expectedTypes = [];

  if (!options.multistream) {
    expectedTypes = Array.isArray(options.expectedMediaReadyTypes)
      ? options.expectedMediaReadyTypes
      : ['remoteAudio', 'remoteVideo'];
  }
  const pending = new Map(
    expectedTypes.filter((type) => typeof type === 'string').map((type) => [type, new Defer()])
  );
  let sdkPending = true;
  const mediaReady = (media) => {
    if (media && pending.has(media.type)) {
      pending.get(media.type).resolve();
      pending.delete(media.type);
    }
  };

  // Capture these promises before synchronous SDK events can remove entries.
  const ready = Promise.all(Array.from(pending.values(), (defer) => defer.promise));

  user.meeting.on('media:ready', mediaReady);
  try {
    const sdk = Promise.resolve(user.meeting.addMedia({localStreams: {microphone, camera}})).then(
      () => {
        sdkPending = false;
      }
    );

    await testUtils.withTimeout(
      Promise.all([sdk, ready]),
      MEDIA_OPERATION_TIMEOUT,
      () =>
        `Media setup timed out waiting for ${
          sdkPending ? 'SDK addMedia()' : Array.from(pending.keys()).join(', ')
        }`
    );

    assert.exists(user.meeting.mediaProperties.audioStream, 'audioStream not present');
    assert.exists(user.meeting.mediaProperties.videoStream, 'videoStream not present');
  } finally {
    user.meeting.off('media:ready', mediaReady);
  }
};

export default {
  addMedia,
  MEDIA_OPERATION_TIMEOUT,
  MEDIA_TEST_TIMEOUT,
};
