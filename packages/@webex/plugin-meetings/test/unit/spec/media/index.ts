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
  const fakeAudioTrack = {
    id: 'audio track',
    underlyingTrack: 'underlying audio track',
  };
  const fakeVideoTrack = {
    id: 'video track',
    underlyingTrack: 'underlying video track',
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
        send: {
          audio: fakeAudioTrack.underlyingTrack,
          video: fakeVideoTrack.underlyingTrack,
          screenShareVideo: undefined,
        },
        receive: {
          audio: true,
          video: true,
          screenShareVideo: true,
          remoteQualityLevel: 'HIGH',
        },
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
        enableMainAudio: true,
        enableMainVideo: true,
        bundlePolicy: 'max-bundle',
      },
      'some debug id'
    );
  });

  forEach([
    {sendAudio: true, receiveAudio: true, sendVideo: true, receiveVideo: true, enableMainAudio: true, enableMainVideo: true,},
    {sendAudio: true, receiveAudio: false, sendVideo: true, receiveVideo: false, enableMainAudio: true, enableMainVideo: true,},
    {sendAudio: false, receiveAudio: true, sendVideo: false, receiveVideo: true, enableMainAudio: true, enableMainVideo: true,},
    {sendAudio: false, receiveAudio: false, sendVideo: false, receiveVideo: false, enableMainAudio: false, enableMainVideo: false,},
  ], ({sendAudio, sendVideo, receiveAudio, receiveVideo, enableMainAudio, enableMainVideo}) => {
    it(`sets enableMainVideo to ${enableMainVideo} and enableMainAudio to ${enableMainAudio} when sendAudio: ${sendAudio} sendVideo: ${sendVideo} receiveAudio: ${receiveAudio} receiveVideo: ${receiveVideo}`, () => {
      const multistreamRoapMediaConnectionConstructorStub = sinon
        .stub(internalMediaModule, 'MultistreamRoapMediaConnection')
        .returns(fakeRoapMediaConnection);

      Media.createMediaConnection(true, 'some debug id', {
        mediaProperties: {
          mediaDirection: {
            sendAudio,
            sendVideo,
            sendShare: false,
            receiveAudio,
            receiveVideo,
            receiveShare: true,
          },
        },
      });
      assert.calledOnce(multistreamRoapMediaConnectionConstructorStub);
      assert.calledWith(
        multistreamRoapMediaConnectionConstructorStub,
        {
          iceServers: [],
          enableMainAudio,
          enableMainVideo,
        },
        'some debug id'
      );
    });
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
        enableMainAudio: true,
        enableMainVideo: true,
      },
      'debug string'
    );
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
        audioTrack: fakeAudioTrack,
        videoTrack: null,
        shareTrack: fakeVideoTrack,
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
        send: {
          audio: fakeAudioTrack.underlyingTrack,
          video: undefined,
          screenShareVideo: fakeVideoTrack.underlyingTrack,
        },
        receive: {
          audio: true,
          video: true,
          screenShareVideo: true,
          remoteQualityLevel: 'HIGH',
        },
      },
      'some debug id'
    );
  });
});
