import 'jsdom-global/register';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {ConnectionState} from '@webex/internal-media-core';

import {StatsAnalyzer, EVENTS} from '../../../../src/statsAnalyzer';
import NetworkQualityMonitor from '../../../../src/networkQualityMonitor';
import testUtils from '../../../utils/testUtils';
import {MEDIA_DEVICES, MQA_INTERVAL, _UNKNOWN_} from '@webex/plugin-meetings/src/constants';
import LoggerProxy from '../../../../src/common/logs/logger-proxy';
import LoggerConfig from '../../../../src/common/logs/logger-config';
import {CpuInfo} from '@webex/web-capabilities';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

const startStatsAnalyzer = async ({statsAnalyzer, mediaStatus, lastEmittedEvents = {}, pc}) => {
  statsAnalyzer.updateMediaStatus(mediaStatus);
  statsAnalyzer.startAnalyzer(pc);
  statsAnalyzer.lastEmittedStartStopEvent = lastEmittedEvents;

  await testUtils.flushPromises();
};

describe('plugin-meetings', () => {
  describe('StatsAnalyzer', () => {
    describe('parseStatsResult', () => {
      const sandbox = sinon.createSandbox();
      let statsAnalyzer;

      const initialConfig = {};
      const defaultStats = {};

      beforeEach(() => {
        const networkQualityMonitor = new NetworkQualityMonitor(initialConfig);

        statsAnalyzer = new StatsAnalyzer(
          {
            config: initialConfig,
            receiveSlotCallback: () => ({}),
            networkQualityMonitor,
            statsResults: defaultStats,
          },
        );
      });

      afterEach(() => {
        sandbox.reset();
      });

      it('should call processOutboundRTPResult', () => {
        const calledSpy = sandbox.spy(statsAnalyzer, 'processOutboundRTPResult');
        statsAnalyzer.parseGetStatsResult({type: 'outbound-rtp'}, 'video-send');
        assert(calledSpy.calledOnce);
      });

      it('should call processInboundRTPResult', () => {
        const calledSpy = sandbox.spy(statsAnalyzer, 'processInboundRTPResult');
        statsAnalyzer.parseGetStatsResult({type: 'inbound-rtp'}, 'video-recv');
        assert(calledSpy.calledOnce);
      });

      it('should call compareSentAndReceived', () => {
        const calledSpy = sandbox.spy(statsAnalyzer, 'compareSentAndReceived');
        statsAnalyzer.parseGetStatsResult({type: 'remote-outbound-rtp'}, 'video-send');
        assert(calledSpy.calledOnce);
      });

      it('should call parseCandidate', () => {
        const calledSpy = sandbox.spy(statsAnalyzer, 'parseCandidate');
        statsAnalyzer.parseGetStatsResult({type: 'local-candidate'}, 'video-send');
        assert(calledSpy.calledOnce);
      });

      it('processOutboundRTPResult should create the correct stats results for audio', () => {
        // establish the `statsResults` object.
        statsAnalyzer.parseGetStatsResult({type: 'none'}, 'audio-send', true);

        statsAnalyzer.processOutboundRTPResult(
          {
            bytesSent: 50000,
            codecId: 'RTCCodec_1_Outbound_111',
            headerBytesSent: 25000,
            id: 'RTCOutboundRTPAudioStream_123456789',
            kind: 'audio',
            mediaSourceId: 'RTCAudioSource_2',
            mediaType: 'audio',
            nackCount: 1,
            packetsSent: 3600,
            remoteId: 'RTCRemoteInboundRtpAudioStream_123456789',
            ssrc: 123456789,
            targetBitrate: 256000,
            timestamp: 1707341489336,
            trackId: 'RTCMediaStreamTrack_sender_2',
            transportId: 'RTCTransport_0_1',
            type: 'outbound-rtp',
            requestedBitrate: 10000,
          },
          'audio-send',
          true,
        );

        assert.strictEqual(statsAnalyzer.statsResults['audio-send'].send.headerBytesSent, 25000);
        assert.strictEqual(statsAnalyzer.statsResults['audio-send'].send.totalBytesSent, 50000);
        assert.strictEqual(statsAnalyzer.statsResults['audio-send'].send.totalNackCount, 1);
        assert.strictEqual(statsAnalyzer.statsResults['audio-send'].send.totalPacketsSent, 3600);
        assert.strictEqual(statsAnalyzer.statsResults['audio-send'].send.requestedBitrate, 10000);
      });

      it('processOutboundRTPResult should create the correct stats results for video', () => {
        // establish the `statsResults` object for video.
        statsAnalyzer.parseGetStatsResult({type: 'none'}, 'video-send', true);

        statsAnalyzer.processOutboundRTPResult(
          {
            bytesSent: 250000,
            codecId: 'RTCCodec_1_Outbound_107',
            headerBytesSent: 50000,
            id: 'RTCOutboundRTPVideoStream_987654321',
            kind: 'video',
            mediaSourceId: 'RTCVideoSource_3',
            mediaType: 'video',
            nackCount: 5,
            packetsSent: 15000,
            remoteId: 'RTCRemoteInboundRtpVideoStream_987654321',
            retransmittedBytesSent: 500,
            retransmittedPacketsSent: 10,
            ssrc: 987654321,
            targetBitrate: 1024000,
            timestamp: 1707341489336,
            trackId: 'RTCMediaStreamTrack_sender_3',
            transportId: 'RTCTransport_0_2',
            type: 'outbound-rtp',
            requestedBitrate: 50000,
          },
          'video-send',
          true,
        );

        assert.strictEqual(statsAnalyzer.statsResults['video-send'].send.headerBytesSent, 50000);
        assert.strictEqual(statsAnalyzer.statsResults['video-send'].send.totalBytesSent, 250000);
        assert.strictEqual(statsAnalyzer.statsResults['video-send'].send.totalNackCount, 5);
        assert.strictEqual(statsAnalyzer.statsResults['video-send'].send.totalPacketsSent, 15000);
        assert.strictEqual(statsAnalyzer.statsResults['video-send'].send.requestedBitrate, 50000);
        assert.strictEqual(
          statsAnalyzer.statsResults['video-send'].send.totalRtxPacketsSent,
          10,
        );
        assert.strictEqual(
          statsAnalyzer.statsResults['video-send'].send.totalRtxBytesSent,
          500,
        );
      });

      it('processInboundRTPResult should create the correct stats results for audio', () => {
        // establish the `statsResults` object.
        statsAnalyzer.parseGetStatsResult({type: 'none'}, 'audio-recv-1', false);

        statsAnalyzer.processInboundRTPResult(
          {
            audioLevel: 0,
            bytesReceived: 509,
            codecId: 'RTCCodec_6_Inbound_111',
            concealedSamples: 200000,
            concealmentEvents: 13,
            fecPacketsDiscarded: 1,
            fecPacketsReceived: 1,
            headerBytesReceived: 250,
            id: 'RTCInboundRTPAudioStream_123456789',
            insertedSamplesForDeceleration: 0,
            jitter: 0.012,
            jitterBufferDelay: 1000,
            jitterBufferEmittedCount: 10000,
            kind: 'audio',
            lastPacketReceivedTimestamp: 1707341488529,
            mediaType: 'audio',
            packetsDiscarded: 0,
            packetsLost: 0,
            packetsReceived: 12,
            remoteId: 'RTCRemoteOutboundRTPAudioStream_123456789',
            removedSamplesForAcceleration: 0,
            silentConcealedSamples: 200000,
            ssrc: 123456789,
            timestamp: 1707341489419,
            totalAudioEnergy: 133,
            totalSamplesDuration: 7,
            totalSamplesReceived: 300000,
            trackId: 'RTCMediaStreamTrack_receiver_76',
            transportId: 'RTCTransport_0_1',
            type: 'inbound-rtp',
            requestedBitrate: 10000,
          },
          'audio-recv-1',
          false,
        );

        assert.strictEqual(
          statsAnalyzer.statsResults['audio-recv-1'].recv.totalPacketsReceived,
          12,
        );
        assert.strictEqual(statsAnalyzer.statsResults['audio-recv-1'].recv.fecPacketsDiscarded, 1);
        assert.strictEqual(statsAnalyzer.statsResults['audio-recv-1'].recv.fecPacketsReceived, 1);
        assert.strictEqual(statsAnalyzer.statsResults['audio-recv-1'].recv.totalBytesReceived, 509);
        assert.strictEqual(statsAnalyzer.statsResults['audio-recv-1'].recv.requestedBitrate, 10000);
        assert.strictEqual(
          statsAnalyzer.statsResults['audio-recv-1'].recv.headerBytesReceived,
          250,
        );
        assert.strictEqual(statsAnalyzer.statsResults['audio-recv-1'].recv.audioLevel, 0);
        assert.strictEqual(statsAnalyzer.statsResults['audio-recv-1'].recv.totalAudioEnergy, 133);
        assert.strictEqual(
          statsAnalyzer.statsResults['audio-recv-1'].recv.totalSamplesReceived,
          300000,
        );
        assert.strictEqual(statsAnalyzer.statsResults['audio-recv-1'].recv.totalSamplesDecoded, 0);
        assert.strictEqual(
          statsAnalyzer.statsResults['audio-recv-1'].recv.concealedSamples,
          200000,
        );
      });

      it('processInboundRTPResult should create the correct stats results for video', () => {
        // establish the `statsResults` object for video.
        statsAnalyzer.parseGetStatsResult({type: 'none'}, 'video-recv', false);

        statsAnalyzer.processInboundRTPResult(
          {
            bytesReceived: 100000,
            codecId: 'RTCCodec_6_Inbound_107',
            fecPacketsDiscarded: 2,
            fecPacketsReceived: 2,
            headerBytesReceived: 10000,
            id: 'RTCInboundRTPVideoStream_987654321',
            jitter: 0.05,
            jitterBufferDelay: 5000,
            jitterBufferEmittedCount: 50000,
            kind: 'video',
            lastPacketReceivedTimestamp: 1707341488529,
            mediaType: 'video',
            packetsDiscarded: 5,
            packetsLost: 10,
            packetsReceived: 1500,
            remoteId: 'RTCRemoteOutboundRTPVideoStream_987654321',
            ssrc: 987654321,
            timestamp: 1707341489419,
            trackId: 'RTCMediaStreamTrack_receiver_3',
            transportId: 'RTCTransport_0_2',
            type: 'inbound-rtp',
            requestedBitrate: 50000,
            retransmittedBytesReceived: 500,
            retransmittedPacketsReceived: 10,
          },
          'video-recv',
          false,
        );

        assert.strictEqual(statsAnalyzer.statsResults['video-recv'].recv.totalPacketsReceived, 1500);
        assert.strictEqual(statsAnalyzer.statsResults['video-recv'].recv.fecPacketsDiscarded, 2);
        assert.strictEqual(statsAnalyzer.statsResults['video-recv'].recv.fecPacketsReceived, 2);
        assert.strictEqual(statsAnalyzer.statsResults['video-recv'].recv.totalBytesReceived, 100000);
        assert.strictEqual(statsAnalyzer.statsResults['video-recv'].recv.requestedBitrate, 50000);
        assert.strictEqual(statsAnalyzer.statsResults['video-recv'].recv.headerBytesReceived, 10000);
        assert.strictEqual(statsAnalyzer.statsResults['video-recv'].recv.totalRtxBytesReceived, 500);
        assert.strictEqual(statsAnalyzer.statsResults['video-recv'].recv.totalRtxPacketsReceived, 10);
      });


      it('parseAudioSource should create the correct stats results', () => {
        // establish the `statsResults` object.
        statsAnalyzer.parseGetStatsResult({type: 'none'}, 'audio-send', true);

        statsAnalyzer.parseAudioSource(
          {
            audioLevel: 0.03,
            echoReturnLoss: -30,
            echoReturnLossEnhancement: 0.17,
            id: 'RTCAudioSource_2',
            kind: 'audio',
            timestamp: 1707341488160.012,
            totalAudioEnergy: 0.001,
            totalSamplesDuration: 4.5,
            trackIdentifier: '2207e5bf-c595-4301-93f7-283994d8143f',
            type: 'media-source',
          },
          'audio-send',
          true,
        );

        assert.strictEqual(statsAnalyzer.statsResults['audio-send'].send.audioLevel, 0.03);
        assert.strictEqual(statsAnalyzer.statsResults['audio-send'].send.totalAudioEnergy, 0.001);
      });
    });

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
          {
            config: initialConfig,
            receiveSlotCallback: () => ({}),
            networkQualityMonitor,
            statsResults: defaultStats,
          },
        );

        sandBoxSpy = sandbox.spy(
          statsAnalyzer.networkQualityMonitor,
          'determineUplinkNetworkQuality',
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
          }),
        );
      });
    });

    describe('startAnalyzer', () => {
      let clock;
      let pc;
      let networkQualityMonitor;
      let statsAnalyzer;
      let mqeData;
      let loggerSpy;
      let receiveSlot;

      let receivedEventsData = {
        local: {},
        remote: {},
      };

      const initialConfig = {
        analyzerInterval: 1000,
      };

      let fakeStats;

      const sandbox = sinon.createSandbox();

      const resetReceivedEvents = () => {
        receivedEventsData = {
          local: {},
          remote: {},
        };
      };

      const registerStatsAnalyzerEvents = (statsAnalyzer) => {
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
      };

      before(() => {
        LoggerConfig.set({enable: false});
        LoggerProxy.set();
        loggerSpy = sandbox.spy(LoggerProxy.logger, 'info');
      });

      beforeEach(() => {
        clock = sinon.useFakeTimers();
        receiveSlot = undefined;

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
                    bytesSent: 1,
                    packetsSent: 0,
                    isRequested: true,
                  },
                  {
                    type: 'remote-inbound-rtp',
                    packetsLost: 0,
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
                    bytesReceived: 1,
                    fecPacketsDiscarded: 0,
                    fecPacketsReceived: 0,
                    packetsLost: 0,
                    packetsReceived: 0,
                    isRequested: true,
                    lastRequestedUpdateTimestamp: 0,
                  },
                  {
                    type: 'remote-outbound-rtp',
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
                    bytesSent: 1,
                    framesSent: 0,
                    packetsSent: 0,
                    isRequested: true,
                    lastRequestedUpdateTimestamp: 0,
                  },
                  {
                    type: 'remote-inbound-rtp',
                    packetsLost: 0,
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
                    bytesReceived: 1,
                    frameHeight: 720,
                    frameWidth: 1280,
                    framesDecoded: 0,
                    framesReceived: 0,
                    packetsLost: 0,
                    packetsReceived: 0,
                    isRequested: true,
                    lastRequestedUpdateTimestamp: 0,
                    isActiveSpeaker: false,
                    lastActiveSpeakerUpdateTimestamp: 0,
                  },
                  {
                    type: 'remote-outbound-rtp',
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
          share: {
            senders: [
              {
                localTrackLabel: 'fake-share',
                report: [
                  {
                    type: 'outbound-rtp',
                    bytesSent: 1,
                    framesSent: 0,
                    packetsSent: 0,
                    isRequested: true,
                    lastRequestedUpdateTimestamp: 0,
                    encoderImplementation: 'fake-encoder',
                  },
                  {
                    type: 'remote-inbound-rtp',
                    packetsLost: 0,
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
                    bytesReceived: 1,
                    frameHeight: 720,
                    frameWidth: 1280,
                    framesDecoded: 0,
                    framesReceived: 0,
                    packetsLost: 0,
                    packetsReceived: 0,
                    isRequested: true,
                    lastRequestedUpdateTimestamp: 0,
                  },
                  {
                    type: 'remote-outbound-rtp',
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
              senders: [fakeStats.share.senders[0]],
              receivers: [fakeStats.share.receivers[0]],
            },
          }),
        };

        networkQualityMonitor = new NetworkQualityMonitor(initialConfig);

        statsAnalyzer = new StatsAnalyzer({
          config: initialConfig, receiveSlotCallback: () => receiveSlot, networkQualityMonitor,
        });

        registerStatsAnalyzerEvents(statsAnalyzer);
      });

      afterEach(() => {
        sandbox.reset();
        clock.restore();
      });

      const mergeProperties = (
        target,
        properties,
        keyValue = 'fake-candidate-id',
        matchKey = 'type',
        matchValue = 'local-candidate',
      ) => {
        for (let key in target) {
          if (target.hasOwnProperty(key)) {
            if (typeof target[key] === 'object') {
              mergeProperties(target[key], properties, keyValue, matchKey, matchValue);
            }
            if (key === 'id' && target[key] === keyValue && target[matchKey] === matchValue) {
              Object.assign(target, properties);
            }
          }
        }
      };

      const progressTime = async (time = initialConfig.analyzerInterval) => {
        await clock.tickAsync(time);
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
        await startStatsAnalyzer({
          statsAnalyzer,
          pc,
          mediaStatus: {
            expected: {
              sendAudio: true,
            },
          },
        });

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
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {sendVideo: true}}});

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

      it('emits LOCAL_MEDIA_STARTED and LOCAL_MEDIA_STOPPED events for share', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {sendShare: true}}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // setup a mock to return some values higher the previous ones
        fakeStats.share.senders[0].report[0].framesSent += 1;

        await progressTime();

        // check that we got the LOCAL_MEDIA_STARTED event for audio
        checkReceivedEvent({expected: {local: {started: {type: 'share'}}}});

        // now advance the clock and the mock still returns same values, so only "stopped" event should be triggered
        resetReceivedEvents();
        await progressTime();
        checkReceivedEvent({expected: {local: {stopped: {type: 'share'}}}});
      });

      it('emits REMOTE_MEDIA_STARTED and REMOTE_MEDIA_STOPPED events for audio', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveAudio: true}}});

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
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

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

      it('emits REMOTE_MEDIA_STARTED and REMOTE_MEDIA_STOPPED events for share', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveShare: true}}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // setup a mock to return some values higher the previous ones
        fakeStats.share.receivers[0].report[0].framesDecoded += 1;

        await progressTime();
        // check that we got the REMOTE_MEDIA_STARTED event for video
        checkReceivedEvent({expected: {remote: {started: {type: 'share'}}}});

        // now advance the clock and the mock still returns same values, so only "stopped" event should be triggered
        resetReceivedEvents();
        await progressTime();

        checkReceivedEvent({expected: {remote: {stopped: {type: 'share'}}}});
      });

      it('emits the correct MEDIA_QUALITY events', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

        await progressTime();

        // Check that the mqe data has been emitted and is correctly computed.
        checkMqeData();
      });

      it('emits the correct transportType in MEDIA_QUALITY events', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

        await progressTime();

        assert.strictEqual(mqeData.audioTransmit[0].common.transportType, 'TCP');
        assert.strictEqual(mqeData.videoReceive[0].common.transportType, 'TCP');
      });

      it('emits the correct transportType in MEDIA_QUALITY events when using a TURN server', async () => {
        fakeStats.audio.senders[0].report[4].relayProtocol = 'tls';
        fakeStats.video.senders[0].report[4].relayProtocol = 'tls';
        fakeStats.audio.receivers[0].report[4].relayProtocol = 'tls';
        fakeStats.video.receivers[0].report[4].relayProtocol = 'tls';

        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

        await progressTime();

        assert.strictEqual(mqeData.audioTransmit[0].common.transportType, 'TLS');
        assert.strictEqual(mqeData.videoReceive[0].common.transportType, 'TLS');
      });

      it('emits the correct peripherals in MEDIA_QUALITY events', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

        await progressTime();

        assert.strictEqual(
          mqeData.intervalMetadata.peripherals.find((val) => val.name === MEDIA_DEVICES.MICROPHONE)
            .information,
          'fake-microphone',
        );
        assert.strictEqual(
          mqeData.intervalMetadata.peripherals.find((val) => val.name === MEDIA_DEVICES.CAMERA)
            .information,
          'fake-camera',
        );
      });

      it('emits the correct peripherals in MEDIA_QUALITY events when localTrackLabel is undefined', async () => {
        fakeStats.audio.senders[0].localTrackLabel = undefined;
        fakeStats.video.senders[0].localTrackLabel = undefined;

        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

        await progressTime();

        assert.strictEqual(
          mqeData.intervalMetadata.peripherals.find((val) => val.name === MEDIA_DEVICES.MICROPHONE)
            .information,
          _UNKNOWN_,
        );
        assert.strictEqual(
          mqeData.intervalMetadata.peripherals.find((val) => val.name === MEDIA_DEVICES.CAMERA)
            .information,
          _UNKNOWN_,
        );
      });

      describe('frame rate reporting in stats analyzer', () => {
        beforeEach(async () => {
          await startStatsAnalyzer({pc, statsAnalyzer});
        });

        it('should report a zero frame rate for both transmitted and received video at the start', async () => {
          assert.strictEqual(mqeData.videoTransmit[0].streams[0].common.transmittedFrameRate, 0);
          assert.strictEqual(mqeData.videoReceive[0].streams[0].common.receivedFrameRate, 0);
        });

        it('should accurately report the transmitted and received frame rate after video frames are processed', async () => {
          fakeStats.video.senders[0].report[0].framesSent += 300;
          fakeStats.video.receivers[0].report[0].framesReceived += 300;
          await progressTime(MQA_INTERVAL);

          // 300 frames in 60 seconds = 5 frames per second
          assert.strictEqual(mqeData.videoTransmit[0].streams[0].common.transmittedFrameRate, 500);
          assert.strictEqual(mqeData.videoReceive[0].streams[0].common.receivedFrameRate, 500);
        });
      });

      describe('RTP packets count in stats analyzer', () => {
        beforeEach(async () => {
          await startStatsAnalyzer({pc, statsAnalyzer});
        });

        it('should report zero RTP packets for all streams at the start of the stats analyzer', async () => {
          assert.strictEqual(mqeData.audioTransmit[0].common.rtpPackets, 0);
          assert.strictEqual(mqeData.audioTransmit[0].streams[0].common.rtpPackets, 0);
          assert.strictEqual(mqeData.audioReceive[0].common.rtpPackets, 0);
          assert.strictEqual(mqeData.audioReceive[0].streams[0].common.rtpPackets, 0);
          assert.strictEqual(mqeData.videoTransmit[0].common.rtpPackets, 0);
          assert.strictEqual(mqeData.videoTransmit[0].streams[0].common.rtpPackets, 0);
          assert.strictEqual(mqeData.videoReceive[0].common.rtpPackets, 0);
          assert.strictEqual(mqeData.videoReceive[0].streams[0].common.rtpPackets, 0);
        });

        it('should update the RTP packets count correctly after audio and video packets are sent', async () => {
          fakeStats.audio.senders[0].report[0].packetsSent += 5;
          fakeStats.video.senders[0].report[0].packetsSent += 5;
          await progressTime(MQA_INTERVAL);

          assert.strictEqual(mqeData.audioTransmit[0].common.rtpPackets, 5);
          assert.strictEqual(mqeData.audioTransmit[0].streams[0].common.rtpPackets, 5);
          assert.strictEqual(mqeData.videoTransmit[0].common.rtpPackets, 5);
          assert.strictEqual(mqeData.videoTransmit[0].streams[0].common.rtpPackets, 5);
        });

        it('should update the RTP packets count correctly after audio and video packets are received', async () => {
          fakeStats.audio.senders[0].report[0].packetsSent += 10;
          fakeStats.video.senders[0].report[0].packetsSent += 10;
          fakeStats.audio.receivers[0].report[0].packetsReceived += 10;
          fakeStats.video.receivers[0].report[0].packetsReceived += 10;
          await progressTime(MQA_INTERVAL);

          assert.strictEqual(mqeData.audioReceive[0].common.rtpPackets, 10);
          assert.strictEqual(mqeData.audioReceive[0].streams[0].common.rtpPackets, 10);
          assert.strictEqual(mqeData.videoReceive[0].common.rtpPackets, 10);
          assert.strictEqual(mqeData.videoReceive[0].streams[0].common.rtpPackets, 10);
        });
      });

      describe('FEC packet reporting in stats analyzer', () => {
        beforeEach(async () => {
          await startStatsAnalyzer({pc, statsAnalyzer});
        });

        it('should initially report zero FEC packets at the start of the stats analyzer', async () => {
          assert.strictEqual(mqeData.audioReceive[0].common.fecPackets, 0);
        });

        it('should accurately report the count of FEC packets received', async () => {
          fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 5;
          await progressTime(MQA_INTERVAL);

          assert.strictEqual(mqeData.audioReceive[0].common.fecPackets, 5);
        });

        it('should accurately update and reset the FEC packet count based on received packets over MQA intervals', async () => {
          fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 15;
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].common.fecPackets, 15);

          fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 45;
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].common.fecPackets, 45);

          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].common.fecPackets, 0);
        });
      });

      describe('RTP recovered packets emission', async() => {
        beforeEach(async() => {
          await startStatsAnalyzer({pc, statsAnalyzer});
        });

        it('should initially report zero RTP recovered packets', async() => {
          assert.strictEqual(mqeData.audioReceive[0].common.rtpRecovered, 0);
        })

        it('should report RTP recovered packets equal to FEC packets received', async() => {
          fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 10;

          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].common.rtpRecovered, 10);
        })

        it('should reset RTP recovered packets count after each interval', async () => {
          fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 100;
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].common.rtpRecovered, 100);

          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].common.rtpRecovered, 0);
        })

        it('should correctly calculate RTP recovered packets after discarding FEC packets', async () => {
          fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 100;
          fakeStats.audio.receivers[0].report[0].fecPacketsDiscarded += 20;

          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].common.rtpRecovered, 80);
        })
      })

      describe('packet loss metrics reporting in stats analyzer', () => {
        beforeEach(async () => {
          await startStatsAnalyzer({pc, statsAnalyzer});
        });

        it('should report zero packet loss for both audio and video at the start of the stats analyzer', async () => {
          assert.strictEqual(mqeData.audioReceive[0].common.mediaHopByHopLost, 0);
          assert.strictEqual(mqeData.audioReceive[0].common.rtpHopByHopLost, 0);
          assert.strictEqual(mqeData.videoReceive[0].common.mediaHopByHopLost, 0);
          assert.strictEqual(mqeData.videoReceive[0].common.rtpHopByHopLost, 0);
        });

        it('should update packet loss metrics correctly for both audio and video after packet loss is detected', async () => {
          fakeStats.audio.receivers[0].report[0].packetsLost += 5;
          fakeStats.video.receivers[0].report[0].packetsLost += 5;
          await progressTime(MQA_INTERVAL);

          assert.strictEqual(mqeData.audioReceive[0].common.mediaHopByHopLost, 5);
          assert.strictEqual(mqeData.audioReceive[0].common.rtpHopByHopLost, 5);
          assert.strictEqual(mqeData.videoReceive[0].common.mediaHopByHopLost, 5);
          assert.strictEqual(mqeData.videoReceive[0].common.rtpHopByHopLost, 5);
        });
      });

      describe('maximum remote loss rate reporting in stats analyzer', () => {
        beforeEach(async () => {
          await startStatsAnalyzer({pc, statsAnalyzer});
        });

        it('should report a zero maximum remote loss rate for both audio and video at the start', async () => {
          assert.strictEqual(mqeData.audioTransmit[0].common.maxRemoteLossRate, 0);
          assert.strictEqual(mqeData.videoTransmit[0].common.maxRemoteLossRate, 0);
        });

        it('should maintain a zero maximum remote loss rate for both audio and video after packets are sent without loss', async () => {
          fakeStats.audio.senders[0].report[0].packetsSent += 100;
          fakeStats.video.senders[0].report[0].packetsSent += 100;
          await progressTime(MQA_INTERVAL);

          assert.strictEqual(mqeData.audioTransmit[0].common.maxRemoteLossRate, 0);
          assert.strictEqual(mqeData.videoTransmit[0].common.maxRemoteLossRate, 0);
        });

        it('should accurately calculate the maximum remote loss rate for both audio and video after packet loss is detected', async () => {
          fakeStats.audio.senders[0].report[0].packetsSent += 200;
          fakeStats.audio.senders[0].report[1].packetsLost += 10;
          fakeStats.video.senders[0].report[0].packetsSent += 200;
          fakeStats.video.senders[0].report[1].packetsLost += 10;
          await progressTime(MQA_INTERVAL);

          assert.strictEqual(mqeData.audioTransmit[0].common.maxRemoteLossRate, 5);
          assert.strictEqual(mqeData.videoTransmit[0].common.maxRemoteLossRate, 5);
        });

        it('should reset the maximum remote loss rate across MQA intervals', async() => {
          fakeStats.audio.senders[0].report[0].packetsSent += 100;
          fakeStats.audio.senders[0].report[1].packetsLost += 10;
          fakeStats.video.senders[0].report[0].packetsSent += 50;
          fakeStats.video.senders[0].report[1].packetsLost += 5;
          await progressTime(MQA_INTERVAL);

          assert.strictEqual(mqeData.audioTransmit[0].common.maxRemoteLossRate, 10);
          assert.strictEqual(mqeData.videoTransmit[0].common.maxRemoteLossRate, 10);

          await progressTime(MQA_INTERVAL);

          assert.strictEqual(mqeData.audioTransmit[0].common.maxRemoteLossRate, 0);
          assert.strictEqual(mqeData.videoTransmit[0].common.maxRemoteLossRate, 0);

        })
      });

      it('has the correct localIpAddress set when the candidateType is host', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer});

        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), '');
        mergeProperties(fakeStats, {address: 'test', candidateType: 'host'});
        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), 'test');
      });

      it('has the correct localIpAddress set when the candidateType is prflx and relayProtocol is set', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer});

        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), '');
        mergeProperties(fakeStats, {
          relayProtocol: 'test',
          address: 'test2',
          candidateType: 'prflx',
        });
        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), 'test2');
      });

      it('has the correct localIpAddress set when the candidateType is prflx and relayProtocol is not set', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer});

        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), '');
        mergeProperties(fakeStats, {
          relatedAddress: 'relatedAddress',
          address: 'test2',
          candidateType: 'prflx',
        });
        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), 'relatedAddress');
      });

      it('has no localIpAddress set when the candidateType is invalid', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer});

        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), '');
        mergeProperties(fakeStats, {candidateType: 'invalid'});
        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), '');
      });

      it('has the correct share video encoder implementation as provided by the stats', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer});

        await progressTime();
        assert.strictEqual(statsAnalyzer.shareVideoEncoderImplementation, 'fake-encoder');
      });

      it('logs a message when audio send packets do not increase', async () => {
        await startStatsAnalyzer(
          {
            statsAnalyzer, pc, mediaStatus: {expected: {sendAudio: true}},
            lastEmittedEvents: {audio: {local: EVENTS.LOCAL_MEDIA_STARTED}},
          },
        );

        // don't increase the packets when time progresses.
        await progressTime();

        assert(
          loggerSpy.calledWith(
            'StatsAnalyzer:index#compareLastStatsResult --> No audio RTP packets sent',
          ),
        );
      });

      it('does not log a message when audio send packets increase', async () => {
        await startStatsAnalyzer({
            statsAnalyzer, pc,
            mediaStatus: {expected: {sendAudio: true}},
            lastEmittedEvents: {audio: {local: EVENTS.LOCAL_MEDIA_STOPPED}},
          },
        );

        fakeStats.audio.senders[0].report[0].packetsSent += 5;
        await progressTime();

        assert(
          loggerSpy.neverCalledWith(
            'StatsAnalyzer:index#compareLastStatsResult --> No audio RTP packets sent',
          ),
        );
      });

      it('logs a message when video send packets do not increase', async () => {
        await startStatsAnalyzer({
            statsAnalyzer, pc, mediaStatus: {expected: {sendVideo: true}},
            lastEmittedEvents: {video: {local: EVENTS.LOCAL_MEDIA_STARTED}},
          },
        );

        // don't increase the packets when time progresses.
        await progressTime();

        assert(
          loggerSpy.calledWith(
            'StatsAnalyzer:index#compareLastStatsResult --> No video RTP packets sent',
          ),
        );
      });

      it('does not log a message when video send packets increase', async () => {
        await startStatsAnalyzer(
          {
            statsAnalyzer, pc,
            mediaStatus: {
              expected: {
                sendVideo: true,
              },
            },
            lastEmittedEvents: {
              video: {
                local: EVENTS.LOCAL_MEDIA_STOPPED,
              },
            },
          });

        fakeStats.video.senders[0].report[0].packetsSent += 5;
        await progressTime();

        assert(
          loggerSpy.neverCalledWith(
            'StatsAnalyzer:index#compareLastStatsResult --> No video RTP packets sent',
          ),
        );
      });

      it('logs a message when share send packets do not increase', async () => {
        await startStatsAnalyzer({
            pc, mediaStatus: {expected: {sendShare: true}},
            lastEmittedEvents: {share: {local: EVENTS.LOCAL_MEDIA_STARTED}}, statsAnalyzer,
          },
        );

        // don't increase the packets when time progresses.
        await progressTime();

        assert(
          loggerSpy.calledWith(
            'StatsAnalyzer:index#compareLastStatsResult --> No share RTP packets sent',
          ),
        );
      });

      it('does not log a message when share send packets increase', async () => {
        await startStatsAnalyzer({
            pc, statsAnalyzer, mediaStatus: {expected: {sendShare: true}},
            lastEmittedEvents: {share: {local: EVENTS.LOCAL_MEDIA_STOPPED}},
          },
        );

        fakeStats.share.senders[0].report[0].packetsSent += 5;
        await progressTime();

        assert(
          loggerSpy.neverCalledWith(
            'StatsAnalyzer:index#compareLastStatsResult --> No share RTP packets sent',
          ),
        );
      });

      ['avatar', 'invalid', 'no source', 'bandwidth limited', 'policy violation'].forEach(
        (sourceState) => {
          it(`does not log a message when no packets are recieved for a receive slot with sourceState "${sourceState}"`, async () => {
            receiveSlot = {
              sourceState,
              csi: 2,
              id: '4',
            };

            await startStatsAnalyzer({pc, statsAnalyzer});

            // don't increase the packets when time progresses.
            await progressTime();

            assert.neverCalledWith(
              loggerSpy,
              'StatsAnalyzer:index#processInboundRTPResult --> No packets received for receive slot id: "4" and csi: 2. Total packets received on slot: ',
              0,
            );
          });
        },
      );

      it(`logs a message if no packets are sent`, async () => {
        receiveSlot = {
          sourceState: 'live',
          csi: 2,
          id: '4',
        };
        await startStatsAnalyzer({pc, statsAnalyzer});

        // don't increase the packets when time progresses.
        await progressTime();

        assert.calledWith(
          loggerSpy,
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for mediaType: video-recv-0, receive slot id: "4" and csi: 2. Total packets received on slot: ',
          0,
        );

        assert.calledWith(
          loggerSpy,
          'StatsAnalyzer:index#processInboundRTPResult --> No frames received for mediaType: video-recv-0,  receive slot id: "4" and csi: 2. Total frames received on slot: ',
          0,
        );

        assert.calledWith(
          loggerSpy,
          'StatsAnalyzer:index#processInboundRTPResult --> No frames decoded for mediaType: video-recv-0,  receive slot id: "4" and csi: 2. Total frames decoded on slot: ',
          0,
        );

        assert.calledWith(
          loggerSpy,
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for mediaType: audio-recv-0, receive slot id: "4" and csi: 2. Total packets received on slot: ',
          0,
        );

        assert.calledWith(
          loggerSpy,
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for mediaType: video-share-recv-0, receive slot id: "4" and csi: 2. Total packets received on slot: ',
          0,
        );

        assert.calledWith(
          loggerSpy,
          'StatsAnalyzer:index#processInboundRTPResult --> No frames received for mediaType: video-share-recv-0,  receive slot id: "4" and csi: 2. Total frames received on slot: ',
          0,
        );
        assert.calledWith(
          loggerSpy,
          'StatsAnalyzer:index#processInboundRTPResult --> No frames decoded for mediaType: video-share-recv-0,  receive slot id: "4" and csi: 2. Total frames decoded on slot: ',
          0,
        );
        assert.calledWith(
          loggerSpy,
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for mediaType: audio-share-recv-0, receive slot id: "4" and csi: 2. Total packets received on slot: ',
          0,
        );
      });

      it(`does not log a message if receiveSlot is undefined`, async () => {
        await startStatsAnalyzer({pc, statsAnalyzer});

        // don't increase the packets when time progresses.
        await progressTime();

        assert.neverCalledWith(
          loggerSpy,
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for receive slot "". Total packets received on slot: ',
          0,
        );
      });

      it('has the correct number of senders and receivers (2)', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

        await progressTime();

        assert.lengthOf(mqeData.audioTransmit, 2);
        assert.lengthOf(mqeData.audioReceive, 2);
        assert.lengthOf(mqeData.videoTransmit, 2);
        assert.lengthOf(mqeData.videoReceive, 2);
      });

      it('has one stream per sender/reciever', async () => {
        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

        await progressTime();

        assert.deepEqual(mqeData.audioTransmit[0].streams, [
          {
            common: {
              codec: 'opus',
              csi: [],
              requestedBitrate: 0,
              requestedFrames: 0,
              rtpPackets: 0,
              ssci: 0,
              transmittedBitrate: 0.13333333333333333,
              transmittedFrameRate: 0,
            },
            transmittedKeyFrames: 0,
            requestedKeyFrames: 0,
            requestedBitrate: 0,
          },
        ]);
        assert.deepEqual(mqeData.audioTransmit[1].streams, [
          {
            common: {
              codec: 'opus',
              csi: [],
              requestedBitrate: 0,
              requestedFrames: 0,
              rtpPackets: 0,
              ssci: 0,
              transmittedBitrate: 0.13333333333333333,
              transmittedFrameRate: 0,
            },
            transmittedKeyFrames: 0,
            requestedKeyFrames: 0,
            requestedBitrate: 0,
          },
        ]);
        assert.deepEqual(mqeData.audioReceive[0].streams, [
          {
            common: {
              codec: 'opus',
              concealedFrames: 0,
              csi: [],
              maxConcealRunLength: 0,
              optimalBitrate: 0,
              optimalFrameRate: 0,
              receivedBitrate: 0.13333333333333333,
              receivedFrameRate: 0,
              renderedFrameRate: 0,
              requestedBitrate: 0,
              requestedFrameRate: 0,
              rtpEndToEndLost: 0,
              maxRtpJitter: 0,
              meanRtpJitter: 0,
              rtpPackets: 0,
              ssci: 0,
              rtpJitter: 0,
              framesDropped: 0,
              framesReceived: 0,
            },
          },
        ]);
        assert.deepEqual(mqeData.audioReceive[1].streams, [
          {
            common: {
              codec: 'opus',
              concealedFrames: 0,
              csi: [],
              maxConcealRunLength: 0,
              optimalBitrate: 0,
              optimalFrameRate: 0,
              receivedBitrate: 0.13333333333333333,
              receivedFrameRate: 0,
              renderedFrameRate: 0,
              requestedBitrate: 0,
              requestedFrameRate: 0,
              rtpEndToEndLost: 0,
              maxRtpJitter: 0,
              meanRtpJitter: 0,
              rtpPackets: 0,
              ssci: 0,
              rtpJitter: 0,
              framesDropped: 0,
              framesReceived: 0,
            },
          },
        ]);
        assert.deepEqual(mqeData.videoTransmit[0].streams, [
          {
            common: {
              codec: 'H264',
              csi: [],
              duplicateSsci: 0,
              requestedBitrate: 0,
              requestedFrames: 0,
              rtpPackets: 0,
              ssci: 0,
              transmittedBitrate: 0.13333333333333333,
              transmittedFrameRate: 0,
            },
            h264CodecProfile: 'BP',
            isAvatar: false,
            isHardwareEncoded: false,
            localConfigurationChanges: 2,
            maxFrameQp: 0,
            maxNoiseLevel: 0,
            minRegionQp: 0,
            remoteConfigurationChanges: 0,
            requestedFrameSize: 0,
            requestedKeyFrames: 0,
            transmittedFrameSize: 0,
            transmittedHeight: 0,
            transmittedKeyFrames: 0,
            transmittedKeyFramesClient: 0,
            transmittedKeyFramesConfigurationChange: 0,
            transmittedKeyFramesFeedback: 0,
            transmittedKeyFramesLocalDrop: 0,
            transmittedKeyFramesOtherLayer: 0,
            transmittedKeyFramesPeriodic: 0,
            transmittedKeyFramesSceneChange: 0,
            transmittedKeyFramesStartup: 0,
            transmittedKeyFramesUnknown: 0,
            transmittedWidth: 0,
            requestedBitrate: 0,
          },
        ]);
        assert.deepEqual(mqeData.videoTransmit[1].streams, [
          {
            common: {
              codec: 'H264',
              csi: [],
              duplicateSsci: 0,
              requestedBitrate: 0,
              requestedFrames: 0,
              rtpPackets: 0,
              ssci: 0,
              transmittedBitrate: 0.13333333333333333,
              transmittedFrameRate: 0,
            },
            h264CodecProfile: 'BP',
            isAvatar: false,
            isHardwareEncoded: false,
            localConfigurationChanges: 2,
            maxFrameQp: 0,
            maxNoiseLevel: 0,
            minRegionQp: 0,
            remoteConfigurationChanges: 0,
            requestedBitrate: 0,
            requestedFrameSize: 0,
            requestedKeyFrames: 0,
            transmittedFrameSize: 0,
            transmittedHeight: 0,
            transmittedKeyFrames: 0,
            transmittedKeyFramesClient: 0,
            transmittedKeyFramesConfigurationChange: 0,
            transmittedKeyFramesFeedback: 0,
            transmittedKeyFramesLocalDrop: 0,
            transmittedKeyFramesOtherLayer: 0,
            transmittedKeyFramesPeriodic: 0,
            transmittedKeyFramesSceneChange: 0,
            transmittedKeyFramesStartup: 0,
            transmittedKeyFramesUnknown: 0,
            transmittedWidth: 0,
          },
        ]);
        assert.deepEqual(mqeData.videoReceive[0].streams, [
          {
            common: {
              codec: 'H264',
              concealedFrames: 0,
              csi: [],
              maxConcealRunLength: 0,
              optimalBitrate: 0,
              optimalFrameRate: 0,
              receivedBitrate: 0.13333333333333333,
              receivedFrameRate: 0,
              renderedFrameRate: 0,
              requestedBitrate: 0,
              requestedFrameRate: 0,
              rtpEndToEndLost: 0,
              rtpJitter: 0,
              rtpPackets: 0,
              ssci: 0,
              framesDropped: 0,
            },
            h264CodecProfile: 'BP',
            isActiveSpeaker: false,
            optimalFrameSize: 0,
            receivedFrameSize: 3600,
            receivedHeight: 720,
            receivedKeyFrames: 0,
            receivedKeyFramesForRequest: 0,
            receivedKeyFramesSourceChange: 0,
            receivedKeyFramesUnknown: 0,
            receivedWidth: 1280,
            requestedFrameSize: 0,
            requestedKeyFrames: 0,
          },
        ]);
        assert.deepEqual(mqeData.videoReceive[1].streams, [
          {
            common: {
              codec: 'H264',
              concealedFrames: 0,
              csi: [],
              maxConcealRunLength: 0,
              optimalBitrate: 0,
              optimalFrameRate: 0,
              receivedBitrate: 0.13333333333333333,
              receivedFrameRate: 0,
              renderedFrameRate: 0,
              requestedBitrate: 0,
              requestedFrameRate: 0,
              rtpEndToEndLost: 0,
              rtpJitter: 0,
              rtpPackets: 0,
              ssci: 0,
              framesDropped: 0,
            },
            h264CodecProfile: 'BP',
            isActiveSpeaker: false,
            optimalFrameSize: 0,
            receivedFrameSize: 3600,
            receivedHeight: 720,
            receivedKeyFrames: 0,
            receivedKeyFramesForRequest: 0,
            receivedKeyFramesSourceChange: 0,
            receivedKeyFramesUnknown: 0,
            receivedWidth: 1280,
            requestedFrameSize: 0,
            requestedKeyFrames: 0,
          },
        ]);
      });

      it('has three streams for video receivers when three exist', async () => {
        pc.getTransceiverStats = sinon.stub().resolves({
          audio: {
            senders: [fakeStats.audio.senders[0]],
            receivers: [fakeStats.audio.receivers[0]],
          },
          video: {
            senders: [fakeStats.video.senders[0]],
            receivers: [
              fakeStats.video.receivers[0],
              fakeStats.video.receivers[0],
              fakeStats.video.receivers[0],
            ],
          },
          screenShareAudio: {
            senders: [fakeStats.audio.senders[0]],
            receivers: [fakeStats.audio.receivers[0]],
          },
          screenShareVideo: {
            senders: [fakeStats.video.senders[0]],
            receivers: [fakeStats.video.receivers[0]],
          },
        });

        await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

        await progressTime();

        assert.deepEqual(mqeData.videoReceive[0].streams, [
          {
            common: {
              codec: 'H264',
              concealedFrames: 0,
              csi: [],
              maxConcealRunLength: 0,
              optimalBitrate: 0,
              optimalFrameRate: 0,
              receivedBitrate: 0.13333333333333333,
              receivedFrameRate: 0,
              renderedFrameRate: 0,
              requestedBitrate: 0,
              requestedFrameRate: 0,
              rtpEndToEndLost: 0,
              rtpJitter: 0,
              rtpPackets: 0,
              ssci: 0,
              framesDropped: 0,
            },
            h264CodecProfile: 'BP',
            isActiveSpeaker: false,
            optimalFrameSize: 0,
            receivedFrameSize: 3600,
            receivedHeight: 720,
            receivedKeyFrames: 0,
            receivedKeyFramesForRequest: 0,
            receivedKeyFramesSourceChange: 0,
            receivedKeyFramesUnknown: 0,
            receivedWidth: 1280,
            requestedFrameSize: 0,
            requestedKeyFrames: 0,
          },
          {
            common: {
              codec: 'H264',
              concealedFrames: 0,
              csi: [],
              maxConcealRunLength: 0,
              optimalBitrate: 0,
              optimalFrameRate: 0,
              receivedBitrate: 0.13333333333333333,
              receivedFrameRate: 0,
              renderedFrameRate: 0,
              requestedBitrate: 0,
              requestedFrameRate: 0,
              rtpEndToEndLost: 0,
              rtpJitter: 0,
              rtpPackets: 0,
              ssci: 0,
              framesDropped: 0,
            },
            h264CodecProfile: 'BP',
            isActiveSpeaker: false,
            optimalFrameSize: 0,
            receivedFrameSize: 3600,
            receivedHeight: 720,
            receivedKeyFrames: 0,
            receivedKeyFramesForRequest: 0,
            receivedKeyFramesSourceChange: 0,
            receivedKeyFramesUnknown: 0,
            receivedWidth: 1280,
            requestedFrameSize: 0,
            requestedKeyFrames: 0,
          },
          {
            common: {
              codec: 'H264',
              concealedFrames: 0,
              csi: [],
              maxConcealRunLength: 0,
              optimalBitrate: 0,
              optimalFrameRate: 0,
              receivedBitrate: 0.13333333333333333,
              receivedFrameRate: 0,
              renderedFrameRate: 0,
              requestedBitrate: 0,
              requestedFrameRate: 0,
              rtpEndToEndLost: 0,
              rtpJitter: 0,
              rtpPackets: 0,
              ssci: 0,
              framesDropped: 0,
            },
            h264CodecProfile: 'BP',
            isActiveSpeaker: false,
            optimalFrameSize: 0,
            receivedFrameSize: 3600,
            receivedHeight: 720,
            receivedKeyFrames: 0,
            receivedKeyFramesForRequest: 0,
            receivedKeyFramesSourceChange: 0,
            receivedKeyFramesUnknown: 0,
            receivedWidth: 1280,
            requestedFrameSize: 0,
            requestedKeyFrames: 0,
          },
        ]);
      });

      describe('stream count for simulcast', async () => {
        it('has three streams for video senders for simulcast', async () => {
          pc.getTransceiverStats = sinon.stub().resolves({
            audio: {
              senders: [fakeStats.audio.senders[0]],
              receivers: [fakeStats.audio.receivers[0]],
            },
            video: {
              senders: [
                {
                  localTrackLabel: 'fake-camera',
                  report: [
                    {
                      type: 'outbound-rtp',
                      bytesSent: 1,
                      framesSent: 0,
                      packetsSent: 0,
                      isRequested: true,
                    },
                    {
                      type: 'outbound-rtp',
                      bytesSent: 1,
                      framesSent: 0,
                      packetsSent: 1,
                      isRequested: true,
                    },
                    {
                      type: 'outbound-rtp',
                      bytesSent: 1000,
                      framesSent: 1,
                      packetsSent: 0,
                      isRequested: true,
                    },
                    {
                      type: 'remote-inbound-rtp',
                      packetsLost: 0,
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
          });

          await startStatsAnalyzer({
            pc,
            statsAnalyzer,
            mediaStatus: {
              expected: {
                receiveVideo: true,
              },
            },
          });

          await progressTime();

          assert.deepEqual(mqeData.videoTransmit[0].streams, [
            {
              common: {
                codec: 'H264',
                csi: [],
                duplicateSsci: 0,
                requestedBitrate: 0,
                requestedFrames: 0,
                rtpPackets: 0,
                ssci: 0,
                transmittedBitrate: 0.13333333333333333,
                transmittedFrameRate: 0,
              },
              h264CodecProfile: 'BP',
              isAvatar: false,
              isHardwareEncoded: false,
              localConfigurationChanges: 2,
              maxFrameQp: 0,
              maxNoiseLevel: 0,
              minRegionQp: 0,
              remoteConfigurationChanges: 0,
              requestedFrameSize: 0,
              requestedKeyFrames: 0,
              transmittedFrameSize: 0,
              transmittedHeight: 0,
              transmittedKeyFrames: 0,
              transmittedKeyFramesClient: 0,
              transmittedKeyFramesConfigurationChange: 0,
              transmittedKeyFramesFeedback: 0,
              transmittedKeyFramesLocalDrop: 0,
              transmittedKeyFramesOtherLayer: 0,
              transmittedKeyFramesPeriodic: 0,
              transmittedKeyFramesSceneChange: 0,
              transmittedKeyFramesStartup: 0,
              transmittedKeyFramesUnknown: 0,
              transmittedWidth: 0,
              requestedBitrate: 0,
            },
            {
              common: {
                codec: 'H264',
                csi: [],
                duplicateSsci: 0,
                requestedBitrate: 0,
                requestedFrames: 0,
                rtpPackets: 1,
                ssci: 0,
                transmittedBitrate: 0.13333333333333333,
                transmittedFrameRate: 0,
              },
              h264CodecProfile: 'BP',
              isAvatar: false,
              isHardwareEncoded: false,
              localConfigurationChanges: 2,
              maxFrameQp: 0,
              maxNoiseLevel: 0,
              minRegionQp: 0,
              remoteConfigurationChanges: 0,
              requestedFrameSize: 0,
              requestedKeyFrames: 0,
              transmittedFrameSize: 0,
              transmittedHeight: 0,
              transmittedKeyFrames: 0,
              transmittedKeyFramesClient: 0,
              transmittedKeyFramesConfigurationChange: 0,
              transmittedKeyFramesFeedback: 0,
              transmittedKeyFramesLocalDrop: 0,
              transmittedKeyFramesOtherLayer: 0,
              transmittedKeyFramesPeriodic: 0,
              transmittedKeyFramesSceneChange: 0,
              transmittedKeyFramesStartup: 0,
              transmittedKeyFramesUnknown: 0,
              transmittedWidth: 0,
              requestedBitrate: 0,
            },
            {
              common: {
                codec: 'H264',
                csi: [],
                duplicateSsci: 0,
                requestedBitrate: 0,
                requestedFrames: 0,
                rtpPackets: 0,
                ssci: 0,
                transmittedBitrate: 133.33333333333334,
                transmittedFrameRate: 2,
              },
              h264CodecProfile: 'BP',
              isAvatar: false,
              isHardwareEncoded: false,
              localConfigurationChanges: 2,
              maxFrameQp: 0,
              maxNoiseLevel: 0,
              minRegionQp: 0,
              remoteConfigurationChanges: 0,
              requestedFrameSize: 0,
              requestedKeyFrames: 0,
              transmittedFrameSize: 0,
              transmittedHeight: 0,
              transmittedKeyFrames: 0,
              transmittedKeyFramesClient: 0,
              transmittedKeyFramesConfigurationChange: 0,
              transmittedKeyFramesFeedback: 0,
              transmittedKeyFramesLocalDrop: 0,
              transmittedKeyFramesOtherLayer: 0,
              transmittedKeyFramesPeriodic: 0,
              transmittedKeyFramesSceneChange: 0,
              transmittedKeyFramesStartup: 0,
              transmittedKeyFramesUnknown: 0,
              transmittedWidth: 0,
              requestedBitrate: 0,
            },
          ]);
        });
      });
      describe('active speaker status emission', async () => {
        beforeEach(async () => {
          await startStatsAnalyzer({pc, statsAnalyzer});
          performance.timeOrigin = 1;
        });

        it('reports active speaker as true when the participant has been speaking', async () => {
          fakeStats.video.receivers[0].report[0].isActiveSpeaker = true;
          await progressTime(5 * MQA_INTERVAL);
          assert.strictEqual(mqeData.videoReceive[0].streams[0].isActiveSpeaker, true);
        });

        it('reports active speaker as false when the participant has not spoken', async () => {
          fakeStats.video.receivers[0].report[0].isActiveSpeaker = false;
          await progressTime(5 * MQA_INTERVAL);
          assert.strictEqual(mqeData.videoReceive[0].streams[0].isActiveSpeaker, false);
        });

        it('defaults to false when active speaker status is indeterminate', async () => {
          fakeStats.video.receivers[0].report[0].isActiveSpeaker = undefined;
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.videoReceive[0].streams[0].isActiveSpeaker, false);
        });

        it('updates active speaker to true following a recent status change to speaking', async () => {
          fakeStats.video.receivers[0].report[0].isActiveSpeaker = false;
          fakeStats.video.receivers[0].report[0].lastActiveSpeakerUpdateTimestamp = performance.timeOrigin + performance.now() + (30 * 1000);
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.videoReceive[0].streams[0].isActiveSpeaker, true);
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.videoReceive[0].streams[0].isActiveSpeaker, false);
        });
      });
      describe('sends streams according to their is requested flag', async () => {

        beforeEach(async () => {
          performance.timeOrigin = 0;
          await startStatsAnalyzer({pc, statsAnalyzer});
        });

        it('should send a stream if it is requested', async () => {
          fakeStats.audio.senders[0].report[0].isRequested = true;
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioTransmit[0].streams.length, 1);
        });

        it('should not sent a stream if its is requested flag is undefined', async () => {
          fakeStats.audio.senders[0].report[0].isRequested = undefined;
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioTransmit[0].streams.length, 0);
        });

        it('should not send a stream if it is not requested', async () => {
          fakeStats.audio.receivers[0].report[0].isRequested = false;
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].streams.length, 0);
        });

        it('should send the stream if it was recently requested', async () => {
          fakeStats.audio.receivers[0].report[0].lastRequestedUpdateTimestamp = performance.timeOrigin + performance.now() + (30 * 1000);
          fakeStats.audio.receivers[0].report[0].isRequested = false;
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].streams.length, 1);
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.audioReceive[0].streams.length, 0);
        });
      });

      describe('window and screen size emission', async () => {
        beforeEach(async () => {
          await startStatsAnalyzer({pc, statsAnalyzer});
        });

        it('should record the screen size from window.screen properties', async () => {
          sinon.stub(window.screen, 'width').get(() => 1280);
          sinon.stub(window.screen, 'height').get(() => 720);
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.intervalMetadata.screenWidth, 1280);
          assert.strictEqual(mqeData.intervalMetadata.screenHeight, 720);
          assert.strictEqual(mqeData.intervalMetadata.screenResolution, 3600);
        });

        it('should record the initial app window size from window properties', async () => {
          sinon.stub(window, 'innerWidth').get(() => 720);
          sinon.stub(window, 'innerHeight').get(() => 360);
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.intervalMetadata.appWindowWidth, 720);
          assert.strictEqual(mqeData.intervalMetadata.appWindowHeight, 360);
          assert.strictEqual(mqeData.intervalMetadata.appWindowSize, 1013);

          sinon.stub(window, 'innerWidth').get(() => 1080);
          sinon.stub(window, 'innerHeight').get(() => 720);
          await progressTime(MQA_INTERVAL);
          assert.strictEqual(mqeData.intervalMetadata.appWindowWidth, 1080);
          assert.strictEqual(mqeData.intervalMetadata.appWindowHeight, 720);
          assert.strictEqual(mqeData.intervalMetadata.appWindowSize, 3038);
        });
      });

      describe('sends multistreamEnabled', async () => {
        it('false if StatsAnalyzer initialized with default value for isMultistream', async () => {
          await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

          await progressTime();

          for (const data of [
            mqeData.audioTransmit,
            mqeData.audioReceive,
            mqeData.videoTransmit,
            mqeData.videoReceive,
          ]) {
            assert.strictEqual(data[0].common.common.multistreamEnabled, false);
          }
        });

        it('false if StatsAnalyzer initialized with false', async () => {
          statsAnalyzer = new StatsAnalyzer({
            config: initialConfig,
            receiveSlotCallback: () => receiveSlot,
            networkQualityMonitor,
            isMultistream: false,
          });
          registerStatsAnalyzerEvents(statsAnalyzer);
          await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: false}}});

          await progressTime();

          for (const data of [
            mqeData.audioTransmit,
            mqeData.audioReceive,
            mqeData.videoTransmit,
            mqeData.videoReceive,
          ]) {
            assert.strictEqual(data[0].common.common.multistreamEnabled, false);
          }
        });

        it('true if StatsAnalyzer initialized with multistream', async () => {
          statsAnalyzer = new StatsAnalyzer({
            config: initialConfig,
            receiveSlotCallback: () => receiveSlot,
            networkQualityMonitor,
            isMultistream: true,
          });
          registerStatsAnalyzerEvents(statsAnalyzer);
          await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

          await progressTime();

          for (const data of [
            mqeData.audioTransmit,
            mqeData.audioReceive,
            mqeData.videoTransmit,
            mqeData.videoReceive,
          ]) {
            assert.strictEqual(data[0].common.common.multistreamEnabled, true);
          }
        });
      });

      describe('CPU Information Reporting', async () => {
        let getNumLogicalCoresStub;

        beforeEach(async () => {
          getNumLogicalCoresStub = sinon.stub(CpuInfo, 'getNumLogicalCores');
        });

        afterEach(() => {
          getNumLogicalCoresStub.restore();
        });

        it('reports 1 of logical CPU cores when not available', async () => {
          getNumLogicalCoresStub.returns(undefined);
          await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

          await progressTime();
          assert.equal(mqeData.intervalMetadata.cpuInfo.numberOfCores, 1);
        });

        it('reports the number of logical CPU cores', async () => {
          getNumLogicalCoresStub.returns(12);
          await startStatsAnalyzer({pc, statsAnalyzer, mediaStatus: {expected: {receiveVideo: true}}});

          await progressTime();
          assert.equal(mqeData.intervalMetadata.cpuInfo.numberOfCores, 12);
        });
      });
    })
  });
});
