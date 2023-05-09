import {assert} from '@webex/test-helper-chai';
import {Defer} from '@webex/common';
import {LocalCameraTrack,  LocalMicrophoneTrack} from '@webex/plugin-meetings';

const addMedia = async (user, options = {}) => {
  const [localStream, localShare] = await user.meeting
  .getMediaStreams({
    sendAudio: true,
    sendVideo: true,
    sendShare: false,
  });

  if (options.multistream) {
    await user.meeting.addMedia({});
    await user.meeting.publishTracks({microphone: new LocalMicrophoneTrack(new MediaStream([localStream.getAudioTracks()?.[0]])), camera: new LocalCameraTrack(new MediaStream([localStream.getVideoTracks()?.[0]]))});

  } else {
    const mediaReadyPromises = Array.isArray(options.expectedMediaReadyTypes)
      ? options.expectedMediaReadyTypes.reduce((output, expectedMediaReadyType) => {
        if (typeof expectedMediaReadyType !== 'string') {
          return output;
        }

        output[expectedMediaReadyType] = new Defer();

        return output;
      }, {})
      : {local: new Defer(), remoteAudio: new Defer(), remoteVideo: new Defer()};

    const mediaReady = (media) => {
      if (!media) {
        return;
      }
      if (mediaReadyPromises[media.type]) {
        mediaReadyPromises[media.type].resolve();
      }
    };

    user.meeting.on('media:ready', mediaReady);

    await user.meeting.addMedia({
      mediaSettings: {
        sendAudio: true,
        sendVideo: true,
        sendShare: false,
        receiveShare: true,
        receiveAudio: true,
        receiveVideo: true,
      },
      localShare,
      localStream,
    });
    await Promise.all(Object.values(mediaReadyPromises).map((defer) => defer.promise));
 };


  assert.exists(user.meeting.mediaProperties.audioTrack, 'audioTrack not present');
  assert.exists(user.meeting.mediaProperties.videoTrack, 'videoTrack not present');

};

export default {
  addMedia
};