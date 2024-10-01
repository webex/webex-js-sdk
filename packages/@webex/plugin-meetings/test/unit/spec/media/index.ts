import * as InternalMediaCoreModule from '@webex/internal-media-core';
import Media from '@webex/plugin-meetings/src/media/index';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import StaticConfig from '@webex/plugin-meetings/src/common/config';

describe('createMediaConnection', () => {
  let clock;
  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  const fakeRoapMediaConnection = {
    id: 'roap media connection',
  };
  const fakeTrack = {
    id: 'any fake track',
  };
  const fakeAudioStream = {
    outputStream: {
      getTracks: () => {
        return [fakeTrack];
      },
    },
  };
  const fakeVideoStream = {
    outputStream: {
      getTracks: () => {
        return [fakeTrack];
      },
    },
  };
  const fakeShareVideoStream = {
    outputStream: {
      getTracks: () => {
        return [fakeTrack];
      },
    },
  };
  const fakeShareAudioStream = {
    outputStream: {
      getTracks: () => {
        return [fakeTrack];
      },
    },
  };
  afterEach(() => {
    sinon.restore();
    clock.uninstall();
  });

  it('creates a RoapMediaConnection when multistream is disabled', () => {
    const roapMediaConnectionConstructorStub = sinon
      .stub(InternalMediaCoreModule, 'RoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    StaticConfig.set({bandwidth: {audio: 123, video: 456, startBitrate: 999}});

    const ENABLE_EXTMAP = false;
    const ENABLE_RTX = true;

    Media.createMediaConnection(false, 'some debug id', 'meetingId', {
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
        url: 'turns:turn-server-url:443?transport=tcp',
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
            urls: 'turn:turn-server-url:5004?transport=tcp',
            username: 'turn username',
            credential: 'turn password',
          },
          {
            urls: 'turns:turn-server-url:443?transport=tcp',
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
      .stub(InternalMediaCoreModule, 'MultistreamRoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    const rtcMetrics = {
      addMetrics: sinon.stub(),
      closeMetrics: sinon.stub(),
      sendMetricsInQueue: sinon.stub(),
    };

    Media.createMediaConnection(true, 'some debug id', 'meeting id', {
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
      rtcMetrics,
      turnServerInfo: {
        url: 'turns:turn-server-url:443?transport=tcp',
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
            urls: 'turn:turn-server-url:5004?transport=tcp',
            username: 'turn username',
            credential: 'turn password',
          },
          {
            urls: 'turns:turn-server-url:443?transport=tcp',
            username: 'turn username',
            credential: 'turn password',
          },
        ],
        bundlePolicy: 'max-bundle',
      },
      'meeting id'
    );

    // check if rtcMetrics callbacks are configured correctly
    const addMetricsCallback = multistreamRoapMediaConnectionConstructorStub.getCalls()[0].args[2];
    const closeMetricsCallback = multistreamRoapMediaConnectionConstructorStub.getCalls()[0].args[3];
    const sendMetricsInQueueCallback = multistreamRoapMediaConnectionConstructorStub.getCalls()[0].args[4];

    assert.isFunction(addMetricsCallback);
    assert.isFunction(closeMetricsCallback);
    assert.isFunction(sendMetricsInQueueCallback);

    const fakeMetricsData = {id: 'metrics data'};

    addMetricsCallback(fakeMetricsData);
    assert.calledOnceWithExactly(rtcMetrics.addMetrics, fakeMetricsData);

    closeMetricsCallback();
    assert.calledOnce(rtcMetrics.closeMetrics);

    sendMetricsInQueueCallback();
    assert.calledOnce(rtcMetrics.sendMetricsInQueue);

  });

  [
    {testCase: 'turnServerInfo is undefined', turnServerInfo: undefined},
    {
      testCase: 'turnServerInfo.url is empty string',
      turnServerInfo: {url: '', username: 'turn username', password: 'turn password'},
    },
  ].forEach(({testCase, turnServerInfo}) => {
    it(`passes empty ICE servers array to MultistreamRoapMediaConnection if ${testCase} (multistream enabled)`, () => {
      const multistreamRoapMediaConnectionConstructorStub = sinon
        .stub(InternalMediaCoreModule, 'MultistreamRoapMediaConnection')
        .returns(fakeRoapMediaConnection);

      Media.createMediaConnection(true, 'debug string', 'meeting id', {
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
        turnServerInfo,
      });
      assert.calledOnce(multistreamRoapMediaConnectionConstructorStub);
      assert.calledWith(
        multistreamRoapMediaConnectionConstructorStub,
        {
          iceServers: [],
        },
        'meeting id'
      );
    });
  });

  it('does not pass bundlePolicy to MultistreamRoapMediaConnection if bundlePolicy is undefined', () => {
    const multistreamRoapMediaConnectionConstructorStub = sinon
      .stub(InternalMediaCoreModule, 'MultistreamRoapMediaConnection')
      .returns(fakeRoapMediaConnection);

    Media.createMediaConnection(true, 'debug string', 'meeting id', {
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
      bundlePolicy: undefined,
    });
    assert.calledOnce(multistreamRoapMediaConnectionConstructorStub);
    assert.calledWith(
      multistreamRoapMediaConnectionConstructorStub,
      {
        iceServers: [],
      },
      'meeting id'
    );
  });

  [
    {testCase: 'turnServerInfo is undefined', turnServerInfo: undefined},
    {
      testCase: 'turnServerInfo.url is empty string',
      turnServerInfo: {url: '', username: 'turn username', password: 'turn password'},
    },
  ].forEach(({testCase, turnServerInfo}) => {
    it(`passes empty ICE servers array to RoapMediaConnection if ${testCase} (multistream disabled)`, () => {
      const roapMediaConnectionConstructorStub = sinon
        .stub(InternalMediaCoreModule, 'RoapMediaConnection')
        .returns(fakeRoapMediaConnection);

      StaticConfig.set({bandwidth: {audio: 123, video: 456, startBitrate: 999}});

      const ENABLE_EXTMAP = false;
      const ENABLE_RTX = true;

      Media.createMediaConnection(false, 'some debug id', 'meeting id', {
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
        turnServerInfo,
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
});
