import 'jsdom-global/register';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {ConnectionState} from '@webex/internal-media-core';

import {StatsAnalyzer, EVENTS} from '../../../../src/statsAnalyzer';
import NetworkQualityMonitor from '../../../../src/networkQualityMonitor';
import testUtils from '../../../utils/testUtils';
import {MEDIA_DEVICES, _UNKNOWN_} from '@webex/plugin-meetings/src/constants';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('plugin-meetings', () => {
  describe('StatsAnalyzer', () => {
    describe('compareSentAndReceived()', () => {
      let statsAnalyzer;
      let sandBoxSpy;

      const initialConfig = {
        videoPacketLossRatioThreshold: 9,
      };

      const defaultStats = {
        resolutions: {},
        internal: {
          'video-send-1': {
            send: {
              totalPacketsLostOnReceiver: 10,
            },
          },
        },
        'video-send-1': {
          send: {
            packetsSent: 2,
            meanRemoteJitter: [],
            meanRoundTripTime: [],
          },
        },
      };

      const statusResult = {
        type: 'remote-inbound-rtp',
        packetsLost: 11,
        rttThreshold: 501,
        jitterThreshold: 501,
      };

      const sandbox = sinon.createSandbox();

      beforeEach(() => {
        const networkQualityMonitor = new NetworkQualityMonitor(initialConfig);

        statsAnalyzer = new StatsAnalyzer(
          initialConfig,
          () => ({}),
          networkQualityMonitor,
          defaultStats
        );

        sandBoxSpy = sandbox.spy(
          statsAnalyzer.networkQualityMonitor,
          'determineUplinkNetworkQuality'
        );
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should trigger determineUplinkNetworkQuality with specific arguments', async () => {
        await statsAnalyzer.parseGetStatsResult(statusResult, 'video-send-1', true);

        assert.calledOnce(statsAnalyzer.networkQualityMonitor.determineUplinkNetworkQuality);
        assert(
          sandBoxSpy.calledWith({
            mediaType: 'video-send-1',
            remoteRtpResults: statusResult,
            statsAnalyzerCurrentStats: statsAnalyzer.statsResults,
          })
        );
      });
    });

    describe('startAnalyzer', () => {
      let clock;
      let pc;
      let networkQualityMonitor;
      let statsAnalyzer;
      let mqeData;

      let receivedEventsData = {
        local: {},
        remote: {},
      };

      const initialConfig = {
        analyzerInterval: 1000,
      };

      let fakeStats;

      const resetReceivedEvents = () => {
        receivedEventsData = {
          local: {},
          remote: {},
        };
      };

      beforeEach(() => {
        clock = sinon.useFakeTimers();

        resetReceivedEvents();

        // bytesReceived and bytesSent need to be non-zero in order for StatsAnalyzer to parse any other values
        fakeStats = {
          audio: {
            senders: [
              {
                localTrackLabel: 'fake-microphone',
                report: [
                  {
                    type: 'outbound-rtp',
                    packetsSent: 0,
                    bytesSent: 1,
                  },
                  {
                    type: 'candidate-pair',
                    state: 'succeeded',
                    localCandidateId: 'fake-candidate-id',
                  },
                  {
                    type: 'candidate-pair',
                    state: 'failed',
                    localCandidateId: 'bad-candidate-id',
                  },
                  {
                    type: 'local-candidate',
                    id: 'fake-candidate-id',
                    protocol: 'tcp',
                  },
                ],
              },
            ],
            receivers: [
              {
                report: [
                  {
                    type: 'inbound-rtp',
                    packetsReceived: 0,
                    bytesReceived: 1,
                  },
                  {
                    type: 'candidate-pair',
                    state: 'succeeded',
                    localCandidateId: 'fake-candidate-id',
                  },
                  {
                    type: 'candidate-pair',
                    state: 'failed',
                    localCandidateId: 'bad-candidate-id',
                  },
                  {
                    type: 'local-candidate',
                    id: 'fake-candidate-id',
                    protocol: 'tcp',
                  },
                ],
              },
            ],
          },
          video: {
            senders: [
              {
                localTrackLabel: 'fake-camera',
                report: [
                  {
                    type: 'outbound-rtp',
                    framesSent: 1500,
                    bytesSent: 1,
                  },
                  {
                    type: 'candidate-pair',
                    state: 'succeeded',
                    localCandidateId: 'fake-candidate-id',
                  },
                  {
                    type: 'candidate-pair',
                    state: 'failed',
                    localCandidateId: 'bad-candidate-id',
                  },
                  {
                    type: 'local-candidate',
                    id: 'fake-candidate-id',
                    protocol: 'tcp',
                  },
                ],
              },
            ],
            receivers: [
              {
                report: [
                  {
                    type: 'inbound-rtp',
                    framesDecoded: 0,
                    bytesReceived: 1,
                    frameHeight: 720,
                    frameWidth: 1280,
                    framesReceived: 1500,
                  },
                  {
                    type: 'candidate-pair',
                    state: 'succeeded',
                    localCandidateId: 'fake-candidate-id',
                  },
                  {
                    type: 'candidate-pair',
                    state: 'failed',
                    localCandidateId: 'bad-candidate-id',
                  },
                  {
                    type: 'local-candidate',
                    id: 'fake-candidate-id',
                    protocol: 'tcp',
                  },
                ],
              },
            ],
          },
        };

        pc = {
          getConnectionState: sinon.stub().returns(ConnectionState.Connected),
          getTransceiverStats: sinon.stub().resolves({
            audio: {
              senders: [fakeStats.audio.senders[0]],
              receivers: [fakeStats.audio.receivers[0]],
            },
            video: {
              senders: [fakeStats.video.senders[0]],
              receivers: [fakeStats.video.receivers[0]],
            },
            screenShareAudio: {
              senders: [fakeStats.audio.senders[0]],
              receivers: [fakeStats.audio.receivers[0]],
            },
            screenShareVideo: {
              senders: [fakeStats.video.senders[0]],
              receivers: [fakeStats.video.receivers[0]],
            },
          }),
        };

        networkQualityMonitor = new NetworkQualityMonitor(initialConfig);

        statsAnalyzer = new StatsAnalyzer(initialConfig, () => ({}), networkQualityMonitor);

        statsAnalyzer.on(EVENTS.LOCAL_MEDIA_STARTED, (data) => {
          receivedEventsData.local.started = data;
        });
        statsAnalyzer.on(EVENTS.LOCAL_MEDIA_STOPPED, (data) => {
          receivedEventsData.local.stopped = data;
        });
        statsAnalyzer.on(EVENTS.REMOTE_MEDIA_STARTED, (data) => {
          receivedEventsData.remote.started = data;
        });
        statsAnalyzer.on(EVENTS.REMOTE_MEDIA_STOPPED, (data) => {
          receivedEventsData.remote.stopped = data;
        });
        statsAnalyzer.on(EVENTS.MEDIA_QUALITY, ({data}) => {
          mqeData = data;
        });
      });

      afterEach(() => {
        clock.restore();
      });

      const startStatsAnalyzer = async (mediaStatus) => {
        statsAnalyzer.updateMediaStatus(mediaStatus);
        statsAnalyzer.startAnalyzer(pc);

        await testUtils.flushPromises();
      };

      const progressTime = async () => {
        await clock.tickAsync(initialConfig.analyzerInterval);
        await testUtils.flushPromises();
      };

      const checkReceivedEvent = ({expected}) => {
        // check that we got the REMOTE_MEDIA_STARTED event for audio
        assert.deepEqual(receivedEventsData.local.started, expected.local?.started);
        assert.deepEqual(receivedEventsData.local.stopped, expected.local?.stopped);
        assert.deepEqual(receivedEventsData.remote.started, expected.remote?.started);
        assert.deepEqual(receivedEventsData.remote.stopped, expected.remote?.stopped);
      };

      const checkMqeData = () => {
        for (const data of [
          mqeData.audioTransmit,
          mqeData.audioReceive,
          mqeData.videoTransmit,
          mqeData.videoReceive,
        ]) {
          assert.strictEqual(data.length, 2);
          assert.strictEqual(data[0].common.common.isMain, true);
          assert.strictEqual(data[1].common.common.isMain, false);
        }

        assert.strictEqual(mqeData.videoReceive[0].streams[0].receivedFrameSize, 3600);
        assert.strictEqual(mqeData.videoReceive[0].streams[0].receivedHeight, 720);
        assert.strictEqual(mqeData.videoReceive[0].streams[0].receivedWidth, 1280);
      };

      it('emits LOCAL_MEDIA_STARTED and LOCAL_MEDIA_STOPPED events for audio', async () => {
        await startStatsAnalyzer({expected: {sendAudio: true}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // setup a mock to return some values higher the previous ones
        fakeStats.audio.senders[0].report[0].packetsSent += 10;

        await progressTime();

        // check that we got the LOCAL_MEDIA_STARTED event for audio
        checkReceivedEvent({expected: {local: {started: {type: 'audio'}}}});

        // now advance the clock and the mock still returns same values, so only "stopped" event should be triggered
        resetReceivedEvents();
        await progressTime();
        checkReceivedEvent({expected: {local: {stopped: {type: 'audio'}}}});
      });

      it('emits LOCAL_MEDIA_STARTED and LOCAL_MEDIA_STOPPED events for video', async () => {
        await startStatsAnalyzer({expected: {sendVideo: true}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // setup a mock to return some values higher the previous ones
        fakeStats.video.senders[0].report[0].framesSent += 1;

        await progressTime();

        // check that we got the LOCAL_MEDIA_STARTED event for audio
        checkReceivedEvent({expected: {local: {started: {type: 'video'}}}});

        // now advance the clock and the mock still returns same values, so only "stopped" event should be triggered
        resetReceivedEvents();
        await progressTime();
        checkReceivedEvent({expected: {local: {stopped: {type: 'video'}}}});
      });

      it('emits REMOTE_MEDIA_STARTED and REMOTE_MEDIA_STOPPED events for audio', async () => {
        await startStatsAnalyzer({expected: {receiveAudio: true}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // setup a mock to return some values higher the previous ones
        fakeStats.audio.receivers[0].report[0].packetsReceived += 5;

        await progressTime();
        // check that we got the REMOTE_MEDIA_STARTED event for audio
        checkReceivedEvent({expected: {remote: {started: {type: 'audio'}}}});

        // now advance the clock and the mock still returns same values, so only "stopped" event should be triggered
        resetReceivedEvents();
        await progressTime();

        checkReceivedEvent({expected: {remote: {stopped: {type: 'audio'}}}});
      });

      it('emits REMOTE_MEDIA_STARTED and REMOTE_MEDIA_STOPPED events for video', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // setup a mock to return some values higher the previous ones
        fakeStats.video.receivers[0].report[0].framesDecoded += 1;

        await progressTime();
        // check that we got the REMOTE_MEDIA_STARTED event for video
        checkReceivedEvent({expected: {remote: {started: {type: 'video'}}}});

        // now advance the clock and the mock still returns same values, so only "stopped" event should be triggered
        resetReceivedEvents();
        await progressTime();

        checkReceivedEvent({expected: {remote: {stopped: {type: 'video'}}}});
      });

      it('emits the correct MEDIA_QUALITY events', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        // Check that the mqe data has been emitted and is correctly computed.
        checkMqeData();
      });

      it('emits the correct transportType in MEDIA_QUALITY events', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        assert.strictEqual(mqeData.audioTransmit[0].common.transportType, 'TCP');
        assert.strictEqual(mqeData.videoReceive[0].common.transportType, 'TCP');
      });

      it('emits the correct transportType in MEDIA_QUALITY events when using a TURN server', async () => {
        fakeStats.audio.senders[0].report[3].relayProtocol = 'tls';
        fakeStats.video.senders[0].report[3].relayProtocol = 'tls';
        fakeStats.audio.receivers[0].report[3].relayProtocol = 'tls';
        fakeStats.video.receivers[0].report[3].relayProtocol = 'tls';

        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        assert.strictEqual(mqeData.audioTransmit[0].common.transportType, 'TLS');
        assert.strictEqual(mqeData.videoReceive[0].common.transportType, 'TLS');
      });

      it('emits the correct peripherals in MEDIA_QUALITY events', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        assert.strictEqual(
          mqeData.intervalMetadata.peripherals.find((val) => val.name === MEDIA_DEVICES.MICROPHONE)
            .information,
          'fake-microphone'
        );
        assert.strictEqual(
          mqeData.intervalMetadata.peripherals.find((val) => val.name === MEDIA_DEVICES.CAMERA)
            .information,
          'fake-camera'
        );
      });

      it('emits the correct peripherals in MEDIA_QUALITY events when localTrackLabel is undefined', async () => {
        fakeStats.audio.senders[0].localTrackLabel = undefined;
        fakeStats.video.senders[0].localTrackLabel = undefined;

        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        assert.strictEqual(
          mqeData.intervalMetadata.peripherals.find((val) => val.name === MEDIA_DEVICES.MICROPHONE)
            .information,
          _UNKNOWN_
        );
        assert.strictEqual(
          mqeData.intervalMetadata.peripherals.find((val) => val.name === MEDIA_DEVICES.CAMERA)
            .information,
          _UNKNOWN_
        );
      });

      it('emits the correct frameRate', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();
        assert.strictEqual(mqeData.videoReceive[0].streams[0].common.receivedFrameRate, 25);
        fakeStats.video.receivers[0].framesReceived = 3000;
        await progressTime();
        assert.strictEqual(mqeData.videoReceive[0].streams[0].common.receivedFrameRate, 25);
      });
    });
  });
});
