import * as internalMediaModule from '@webex/plugin-meetings/src/media/internal-media-core-wrapper';
import Media from '@webex/plugin-meetings/src/media/index';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import StaticConfig from '@webex/plugin-meetings/src/common/config';

describe('createMediaConnection', () => {
  const fakeRoapMediaConnection = {
    id: 'roap media connection',
  };
  const fakeAudioTrack = {
    id: 'audio track',
  };
  const fakeVideoTrack = {
    id: 'video track',
  };

  afterEach(() => {
    sinon.restore();
  });

  it('creates a RoapMediaConnection when multistream is disabled', () => {
    const roapMediaConnectionConstructorStub = sinon
      .stub(internalMediaModule, 'RoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    StaticConfig.set({bandwidth: {audio: 123, video: 456, startBitrate: 999}});

    const ENABLE_EXTMAP = false;
    const ENABLE_RTX = true;

    Media.createMediaConnection(
      {
        mediaDirection: {
          sendAudio: true,
          sendVideo: true,
          sendShare: false,
          receiveAudio: true,
          receiveVideo: true,
          receiveShare: true,
        },
        audioTrack: fakeAudioTrack,
        videoTrack: fakeVideoTrack,
        shareTrack: null,
      },
      {
        isMultistream: false,
        remoteQualityLevel: 'HIGH',
        enableRtx: ENABLE_RTX,
        enableExtmap: ENABLE_EXTMAP,
        turnServerInfo: {
          url: 'turn server url',
          username: 'turn username',
          password: 'turn password',
        },
      }
    );
    assert.calledOnce(roapMediaConnectionConstructorStub);
    assert.calledWith(
      roapMediaConnectionConstructorStub,
      {
        iceServers: [
          {
            urls: 'turn server url',
            username: 'turn username',
            credential: 'turn password',
          },
        ],
        skipInactiveTransceivers: false,
        requireH264: true,
        sdpMunging: {
          convertPort9to0: false,
          addContentSlides: true,
          bandwidthLimits: {
            audio: 123,
            video: 456,
          },
          startBitrate: 999,
          periodicKeyframes: 20,
          disableExtmap: !ENABLE_EXTMAP,
          disableRtx: !ENABLE_RTX,
        },
      },
      {
        send: {
          audio: fakeAudioTrack,
          video: fakeVideoTrack,
          screenShareVideo: null,
        },
        receive: {
          audio: true,
          video: true,
          screenShareVideo: true,
          remoteQualityLevel: 'HIGH',
        },
      },
      'mc'
    );
  });

  it('creates a MultistreamRoapMediaConnection when multistream is enabled', () => {
    const multistreamRoapMediaConnectionConstructorStub = sinon
      .stub(internalMediaModule, 'MultistreamRoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    Media.createMediaConnection(
      {},
      {
        isMultistream: true,
        turnServerInfo: {
          url: 'turn server url',
          username: 'turn username',
          password: 'turn password',
        },
      }
    );
    assert.calledOnce(multistreamRoapMediaConnectionConstructorStub);
    assert.calledWith(
      multistreamRoapMediaConnectionConstructorStub,
      {
        iceServers: [
          {
            urls: 'turn server url',
            username: 'turn username',
            credential: 'turn password',
          },
        ],
      },
      'mc'
    );
  });

  it('passes empty ICE servers array to MultistreamRoapMediaConnection if turnServerInfo is undefined (multistream enabled)', () => {
    const multistreamRoapMediaConnectionConstructorStub = sinon
      .stub(internalMediaModule, 'MultistreamRoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    Media.createMediaConnection(
      {},
      {
        isMultistream: true,
        turnServerInfo: undefined,
      }
    );
    assert.calledOnce(multistreamRoapMediaConnectionConstructorStub);
    assert.calledWith(
      multistreamRoapMediaConnectionConstructorStub,
      {
        iceServers: [],
      },
      'mc'
    );
  });

  it('passes empty ICE servers array to RoapMediaConnection if turnServerInfo is undefined (multistream disabled)', () => {
    const roapMediaConnectionConstructorStub = sinon
      .stub(internalMediaModule, 'RoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    StaticConfig.set({bandwidth: {audio: 123, video: 456, startBitrate: 999}});

    const ENABLE_EXTMAP = false;
    const ENABLE_RTX = true;

    Media.createMediaConnection(
      {
        mediaDirection: {
          sendAudio: true,
          sendVideo: true,
          sendShare: true,
          receiveAudio: true,
          receiveVideo: true,
          receiveShare: true,
        },
        audioTrack: fakeAudioTrack,
        videoTrack: null,
        shareTrack: fakeVideoTrack,
      },
      {
        isMultistream: false,
        remoteQualityLevel: 'HIGH',
        enableRtx: ENABLE_RTX,
        enableExtmap: ENABLE_EXTMAP,
        turnServerInfo: undefined,
      }
    );
    assert.calledOnce(roapMediaConnectionConstructorStub);
    assert.calledWith(
      roapMediaConnectionConstructorStub,
      {
        iceServers: [],
        skipInactiveTransceivers: false,
        requireH264: true,
        sdpMunging: {
          convertPort9to0: false,
          addContentSlides: true,
          bandwidthLimits: {
            audio: 123,
            video: 456,
          },
          startBitrate: 999,
          periodicKeyframes: 20,
          disableExtmap: !ENABLE_EXTMAP,
          disableRtx: !ENABLE_RTX,
        },
      },
      {
        send: {
          audio: fakeAudioTrack,
          video: null,
          screenShareVideo: fakeVideoTrack,
        },
        receive: {
          audio: true,
          video: true,
          screenShareVideo: true,
          remoteQualityLevel: 'HIGH',
        },
      },
      'mc'
    );
  });
});
