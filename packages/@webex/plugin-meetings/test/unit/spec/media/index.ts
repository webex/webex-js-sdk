import * as internalMediaModule from '@webex/internal-media-core';
import Media from '@webex/plugin-meetings/src/media/index';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import StaticConfig from '@webex/plugin-meetings/src/common/config';
import { forEach } from 'lodash';

describe('createMediaConnection', () => {
  const fakeRoapMediaConnection = {
    id: 'roap media connection',
  };
  const fakeTrack = {
    id: 'any fake track'
  }
  const fakeAudioStream = {
    outputTrack: fakeTrack,
  };
  const fakeVideoStream = {
    outputTrack: fakeTrack,
  };
  const fakeShareVideoStream = {
    outputTrack: fakeTrack,
  };
  const fakeShareAudioStream = {
    outputTrack: fakeTrack,
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

    Media.createMediaConnection(false, 'some debug id', {
      mediaProperties: {
        mediaDirection: {
          sendAudio: false,
          sendVideo: true,
          sendShare: false,
          receiveAudio: false,
          receiveVideo: true,
          receiveShare: true,
        },
        audioStream: fakeAudioStream,
        videoStream: fakeVideoStream,
        shareVideoTrack: null,
        shareAudioTrack: null,
      },
      remoteQualityLevel: 'HIGH',
      enableRtx: ENABLE_RTX,
      enableExtmap: ENABLE_EXTMAP,
      turnServerInfo: {
        url: 'turn server url',
        username: 'turn username',
        password: 'turn password',
      },
    });
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
        localTracks: {
          audio: fakeTrack,
          video: fakeTrack,
          screenShareVideo: undefined,
          screenShareAudio: undefined,
        },
        direction: {
          audio: 'inactive',
          video: 'sendrecv',
          screenShareVideo: 'recvonly',
        },
        remoteQualityLevel: 'HIGH',
      },
      'some debug id'
    );
  });

  it('creates a MultistreamRoapMediaConnection when multistream is enabled', () => {
    const multistreamRoapMediaConnectionConstructorStub = sinon
      .stub(internalMediaModule, 'MultistreamRoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    Media.createMediaConnection(true, 'some debug id', {
      mediaProperties: {
        mediaDirection: {
          sendAudio: true,
          sendVideo: true,
          sendShare: false,
          receiveAudio: true,
          receiveVideo: true,
          receiveShare: true,
        }
      },
      turnServerInfo: {
        url: 'turn server url',
        username: 'turn username',
        password: 'turn password',
      },
      bundlePolicy: 'max-bundle',
    });
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
        bundlePolicy: 'max-bundle',
      },
      'some debug id'
    );
  });

  it('passes empty ICE servers array to MultistreamRoapMediaConnection if turnServerInfo is undefined (multistream enabled)', () => {
    const multistreamRoapMediaConnectionConstructorStub = sinon
      .stub(internalMediaModule, 'MultistreamRoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    Media.createMediaConnection(true, 'debug string', {
      mediaProperties: {
        mediaDirection: {
          sendAudio: true,
          sendVideo: true,
          sendShare: false,
          receiveAudio: true,
          receiveVideo: true,
          receiveShare: true,
        },
      },
    });
    assert.calledOnce(multistreamRoapMediaConnectionConstructorStub);
    assert.calledWith(
      multistreamRoapMediaConnectionConstructorStub,
      {
        iceServers: [],
      },
      'debug string'
    );

    it('does not pass bundlePolicy to MultistreamRoapMediaConnection if bundlePolicy is undefined', () => {
      const multistreamRoapMediaConnectionConstructorStub = sinon
        .stub(internalMediaModule, 'MultistreamRoapMediaConnection')
        .returns(fakeRoapMediaConnection);

      Media.createMediaConnection(true, 'debug string', {
        mediaProperties: {
          mediaDirection: {
            sendAudio: true,
            sendVideo: true,
            sendShare: false,
            receiveAudio: true,
            receiveVideo: true,
            receiveShare: true,
          },
        },
        bundlePolicy: undefined
      });
      assert.calledOnce(multistreamRoapMediaConnectionConstructorStub);
      assert.calledWith(
        multistreamRoapMediaConnectionConstructorStub,
        {
          iceServers: [],
        },
        'debug string'
      );
    });
  });

  it('passes empty ICE servers array to RoapMediaConnection if turnServerInfo is undefined (multistream disabled)', () => {
    const roapMediaConnectionConstructorStub = sinon
      .stub(internalMediaModule, 'RoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    StaticConfig.set({bandwidth: {audio: 123, video: 456, startBitrate: 999}});

    const ENABLE_EXTMAP = false;
    const ENABLE_RTX = true;

    Media.createMediaConnection(false, 'some debug id', {
      mediaProperties: {
        mediaDirection: {
          sendAudio: true,
          sendVideo: true,
          sendShare: true,
          receiveAudio: true,
          receiveVideo: true,
          receiveShare: true,
        },
        audioStream: fakeAudioStream,
        videoStream: null,
        shareVideoStream: fakeShareVideoStream,
        shareAudioStream: fakeShareAudioStream,
      },
      remoteQualityLevel: 'HIGH',
      enableRtx: ENABLE_RTX,
      enableExtmap: ENABLE_EXTMAP,
      turnServerInfo: undefined,
    });
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
        localTracks: {
          audio: fakeTrack,
          video: undefined,
          screenShareVideo: fakeTrack,
          screenShareAudio: fakeTrack,
        },
        direction: {
          audio: 'sendrecv',
          video: 'sendrecv',
          screenShareVideo: 'sendrecv',
        },
        remoteQualityLevel: 'HIGH',
      },
      'some debug id'
    );
  });
});
