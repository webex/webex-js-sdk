import {assert} from '@webex/test-helper-chai';
import {Defer} from '@webex/common';

const addMedia = async (user, options = {}) => {

  const {microphone, camera} = options;

  if (options.multistream) {
    await user.meeting.addMedia({localStreams: {microphone, camera}});
  } else {
    const mediaReadyPromises = Array.isArray(options.expectedMediaReadyTypes)
      ? options.expectedMediaReadyTypes.reduce((output, expectedMediaReadyType) => {
        if (typeof expectedMediaReadyType !== 'string') {
          return output;
        }

        output[expectedMediaReadyType] = new Defer();

        return output;
      }, {})
      : {remoteAudio: new Defer(), remoteVideo: new Defer()};

    const mediaReady = (media) => {
      if (!media) {
        return;
      }
      if (mediaReadyPromises[media.type]) {
        mediaReadyPromises[media.type].resolve();
      }
    };

    user.meeting.on('media:ready', mediaReady);

    await user.meeting.addMedia({localStreams: {microphone, camera}});
    await Promise.all(Object.values(mediaReadyPromises).map((defer) => defer.promise));
 };


  assert.exists(user.meeting.mediaProperties.audioStream, 'audioStream not present');
  assert.exists(user.meeting.mediaProperties.videoStream, 'videoStream not present');

};

export default {
  addMedia
};