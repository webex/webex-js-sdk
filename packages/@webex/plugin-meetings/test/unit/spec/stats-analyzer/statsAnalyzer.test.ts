import { setImmediate } from "timers";
import { ConnectionState, StreamState } from '@webex/internal-media-core';
import { MEDIA_DEVICES, _UNKNOWN_, MQA_INTERVAL } from '../../../../src/constants';
import LoggerProxy from '../../../../src/common/logs/logger-proxy';
import LoggerConfig from "../../../../src/common/logs/logger-config";
import { StatsAnalyzer, EVENTS } from '../../../../src/statsAnalyzer';
import NetworkQualityMonitor from '../../../../src/networkQualityMonitor';
import { ReceiveSlot } from '../../../../src/multistream/receiveSlot';

jest.mock('../../../../src/common/logs/logger-proxy');
const flushPromises = () => new Promise(setImmediate);

describe('plugin-meetings', () => {
  describe('StatsAnalyzer', () => {
    describe('parseStatsResult', () => {
        let statsAnalyzer: StatsAnalyzer;

        const initialConfig: Record<string, any> = {};
        const defaultStats: Record<string, any> = {};


        beforeEach(() => {
          const networkQualityMonitor = new NetworkQualityMonitor(initialConfig);
          statsAnalyzer = new StatsAnalyzer(
            initialConfig,
            () => undefined,
            networkQualityMonitor,
            defaultStats
          );
        });

        afterEach(() => {
          jest.clearAllMocks();
        });

        it('should call processOutboundRTPResult', () => {
          statsAnalyzer['processOutboundRTPResult'] = jest.fn();
          statsAnalyzer['parseGetStatsResult']({type: 'outbound-rtp'}, 'video-send', true);
          expect(statsAnalyzer['processOutboundRTPResult']).toHaveBeenCalledTimes(1);
        });

        it('should call processInboundRTPResult', () => {
          statsAnalyzer['processInboundRTPResult'] = jest.fn();
          statsAnalyzer['parseGetStatsResult']({type: 'inbound-rtp'}, 'video-recv', true);
          expect(statsAnalyzer['processInboundRTPResult']).toHaveBeenCalledTimes(1);
        });

        it('should call compareSentAndReceived', () => {
          statsAnalyzer['compareSentAndReceived'] = jest.fn();
          statsAnalyzer['parseGetStatsResult']({type: 'remote-outbound-rtp'}, 'video-send', true);
          expect(statsAnalyzer['compareSentAndReceived']).toHaveBeenCalledTimes(1);
        });

        it('should call parseCandidate', () => {
          statsAnalyzer['parseCandidate'] = jest.fn();
          statsAnalyzer['parseGetStatsResult']({type: 'local-candidate'}, 'video-send', true);
          expect(statsAnalyzer['parseCandidate']).toHaveBeenCalledTimes(1);
        });

        it('processOutboundRTPResult should create the correct stats results for audio', () => {
          statsAnalyzer['parseGetStatsResult']({type: 'none'}, 'audio-send', true);

          statsAnalyzer['processOutboundRTPResult'](
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
          );

          expect(statsAnalyzer.statsResults['audio-send'].send.headerBytesSent).toBe(25000);
          expect(statsAnalyzer.statsResults['audio-send'].send.totalBytesSent).toBe(50000);
          expect(statsAnalyzer.statsResults['audio-send'].send.totalNackCount).toBe(1);
          expect(statsAnalyzer.statsResults['audio-send'].send.totalPacketsSent).toBe(3600);
          expect(statsAnalyzer.statsResults['audio-send'].send.requestedBitrate).toBe(10000);
        });

        it('processOutboundRTPResult should create the correct stats results for video', () => {
          statsAnalyzer['parseGetStatsResult']({type: 'none'}, 'video-send', true);

          statsAnalyzer['processOutboundRTPResult'](
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
          );

          expect(statsAnalyzer.statsResults['video-send'].send.headerBytesSent).toBe(50000);
          expect(statsAnalyzer.statsResults['video-send'].send.totalBytesSent).toBe(250000);
          expect(statsAnalyzer.statsResults['video-send'].send.totalNackCount).toBe(5);
          expect(statsAnalyzer.statsResults['video-send'].send.totalPacketsSent).toBe(15000);
          expect(statsAnalyzer.statsResults['video-send'].send.requestedBitrate).toBe(50000);
          expect(statsAnalyzer.statsResults['video-send'].send.totalRtxPacketsSent).toBe(10);
          expect(statsAnalyzer.statsResults['video-send'].send.totalRtxBytesSent).toBe(500);
        });

        it('processInboundRTPResult should create the correct stats results for audio', () => {

          statsAnalyzer['parseGetStatsResult']({type: 'none'}, 'audio-recv-1', false);

          statsAnalyzer['processInboundRTPResult'](
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
          );

          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.totalPacketsReceived).toBe(12);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.fecPacketsDiscarded).toBe(1);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.fecPacketsReceived).toBe(1);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.totalBytesReceived).toBe(509);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.requestedBitrate).toBe(10000);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.headerBytesReceived).toBe(250);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.audioLevel).toBe(0);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.totalAudioEnergy).toBe(133);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.totalSamplesReceived).toBe(300000);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.totalSamplesDecoded).toBe(0);
          expect(statsAnalyzer.statsResults['audio-recv-1'].recv.concealedSamples).toBe(200000);
        });

        it('processInboundRTPResult should create the correct stats results for video', () => {
          statsAnalyzer['parseGetStatsResult']({type: 'none'}, 'video-recv', false);

          statsAnalyzer['processInboundRTPResult'](
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
          );

          expect(statsAnalyzer.statsResults['video-recv'].recv.totalPacketsReceived).toBe(1500);
          expect(statsAnalyzer.statsResults['video-recv'].recv.fecPacketsDiscarded).toBe(2);
          expect(statsAnalyzer.statsResults['video-recv'].recv.fecPacketsReceived).toBe(2);
          expect(statsAnalyzer.statsResults['video-recv'].recv.totalBytesReceived).toBe(100000);
          expect(statsAnalyzer.statsResults['video-recv'].recv.requestedBitrate).toBe(50000);
          expect(statsAnalyzer.statsResults['video-recv'].recv.headerBytesReceived).toBe(10000);
          expect(statsAnalyzer.statsResults['video-recv'].recv.totalRtxBytesReceived).toBe(500);
          expect(statsAnalyzer.statsResults['video-recv'].recv.totalRtxPacketsReceived).toBe(10);
        });

        it('parseAudioSource should create the correct stats results', () => {
          statsAnalyzer['parseGetStatsResult']({type: 'none'}, 'audio-send', true);

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
          );

          expect(statsAnalyzer.statsResults['audio-send'].send.audioLevel).toBe(0.03);
          expect(statsAnalyzer.statsResults['audio-send'].send.totalAudioEnergy).toBe(0.001);
        });
      }
    );
    describe('compareSentAndReceived()', () => {
      let statsAnalyzer: StatsAnalyzer;
      let mockDetermineUplinkNetworkQuality = jest.fn();

      const initialConfig: Record<string, any> = {
        videoPacketLossRatioThreshold: 9,
      };

      const defaultStats: Record<string, any> = {
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

      const statusResult: Record<string, any>  = {
        type: 'remote-inbound-rtp',
        packetsLost: 11,
        rttThreshold: 501,
        jitterThreshold: 501,
      };

      beforeEach(() => {
        const networkQualityMonitor = new NetworkQualityMonitor(initialConfig);
        statsAnalyzer = new StatsAnalyzer(
          initialConfig,
          () => undefined,
          networkQualityMonitor,
          defaultStats
        );

        statsAnalyzer.networkQualityMonitor.determineUplinkNetworkQuality = mockDetermineUplinkNetworkQuality;
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('should trigger determineUplinkNetworkQuality with specific arguments', async () => {
        statsAnalyzer['parseGetStatsResult'](statusResult, 'video-send-1', true);

        expect(mockDetermineUplinkNetworkQuality).toHaveBeenCalledTimes(1);
        expect(mockDetermineUplinkNetworkQuality).toHaveBeenCalledWith({
          mediaType: 'video-send-1',
          remoteRtpResults: statusResult,
          statsAnalyzerCurrentStats: statsAnalyzer.statsResults,
        });
      });
    });
    describe('startAnalyzer', () => {
      let pc: {
        getConnectionState: jest.Mock<Promise<ConnectionState>>;
        getTransceiverStats: { mockResolvedValue: (stats: Record<string, { senders: any[]; receivers: any[]; }>) => void };
      };
      let networkQualityMonitor: NetworkQualityMonitor;
      let statsAnalyzer: StatsAnalyzer;
      let mqeData: Record<'audioTransmit' | 'audioReceive' | 'videoTransmit' | 'videoReceive', string | any[]> & { intervalMetadata: Record<string, any> };
      let loggerSpy: jest.SpyInstance;
      let receiveSlot: Partial<ReceiveSlot>;

      let receivedEventsData: Record<string, any> = {
        local: {},
        remote: {},
      };

      const initialConfig: Record<string, any> = {
        analyzerInterval: 1000,
      };

      let fakeStats: Record<string, any>;
      const resetReceivedEvents = () => {
        receivedEventsData = {
          local: {},
          remote: {},
        };
      };
      beforeAll(() => {
        LoggerConfig.set({enable: false});
        LoggerProxy.set();
        loggerSpy = jest.spyOn(LoggerProxy.logger, 'info');
      });

      beforeEach(() => {
        jest.useFakeTimers();
        receiveSlot = undefined;

        resetReceivedEvents();

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
          getConnectionState: jest.fn().mockReturnValue(ConnectionState.Connected),
          getTransceiverStats: jest.fn().mockResolvedValue({
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

        // @ts-ignore
        statsAnalyzer = new StatsAnalyzer(initialConfig, () => receiveSlot, networkQualityMonitor);

        statsAnalyzer['on'](EVENTS.LOCAL_MEDIA_STARTED, (data: unknown) => {
          receivedEventsData.local['started'] = data;
        });
        statsAnalyzer['on'](EVENTS.LOCAL_MEDIA_STOPPED, (data: unknown) => {
          receivedEventsData.local['stopped'] = data;
        });
        statsAnalyzer['on'](EVENTS.REMOTE_MEDIA_STARTED, (data: unknown) => {
          receivedEventsData.remote['started'] = data;
        });
        statsAnalyzer['on'](EVENTS.REMOTE_MEDIA_STOPPED, (data: unknown) => {
          receivedEventsData.remote['stopped'] = data;
        });
        statsAnalyzer['on'](EVENTS.MEDIA_QUALITY, ({data}) => {
          mqeData = data;
        });
      });

      afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
      });

      const startStatsAnalyzer = async (mediaStatus?: unknown, lastEmittedEvents?: unknown) => {
        statsAnalyzer.updateMediaStatus(mediaStatus);
        statsAnalyzer.startAnalyzer(pc);
        console.log(statsAnalyzer.startAnalyzer(pc));
        statsAnalyzer.lastEmittedStartStopEvent = lastEmittedEvents || {};

        await flushPromises();
      };

      const mergeProperties = (
        target: Record<string, any>,
        properties: Record<string, any>,
        keyValue = 'fake-candidate-id',
        matchKey = 'type',
        matchValue = 'local-candidate'
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
        jest.advanceTimersByTime(time);
        await flushPromises();
      };
      const checkReceivedEvent = ({ expected }) => {
        // check that we got the REMOTE_MEDIA_STARTED event for audio
        expect(receivedEventsData.local['started']).toEqual(expected.local?.started);
        expect(receivedEventsData.local['stopped']).toEqual(expected.local?.stopped);
        expect(receivedEventsData.remote['started']).toEqual(expected.remote?.started);
        expect(receivedEventsData.remote['stopped']).toEqual(expected.remote?.stopped);
      };
      const checkMqeData = () => {
        for (const data of [
          mqeData.audioTransmit,
          mqeData.audioReceive,
          mqeData.videoTransmit,
          mqeData.videoReceive,
        ]) {
          expect(data.length).toBe(2);
          expect(data[0].common.common.isMain).toBe(true);
          expect(data[1].common.common.isMain).toBe(false);
        }

        expect(mqeData.videoReceive[0].streams[0].receivedFrameSize).toBe(3600);
        expect(mqeData.videoReceive[0].streams[0].receivedHeight).toBe(720);
        expect(mqeData.videoReceive[0].streams[0].receivedWidth).toBe(1280);
      };

      it('emits LOCAL_MEDIA_STARTED and LOCAL_MEDIA_STOPPED events for audio', async () => {
        await startStatsAnalyzer({expected: {sendAudio: true}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // set up a mock to return some values higher the previous ones
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

        // set up a mock to return some values higher the previous ones
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
        await startStatsAnalyzer({expected: {sendShare: true}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // set up a mock to return some values higher the previous ones
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
        await startStatsAnalyzer({expected: {receiveAudio: true}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // set up a mock to return some values higher the previous ones
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

        // set up a mock to return some values higher the previous ones
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
        await startStatsAnalyzer({expected: {receiveShare: true}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // set up a mock to return some values higher the previous ones
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

        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        // Check that the mqe data has been emitted and is correctly computed.
        checkMqeData();

      });

      it('emits the correct transportType in MEDIA_QUALITY events', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        expect(mqeData.audioTransmit[0].common.transportType).toBe('TCP');
        expect(mqeData.videoReceive[0].common.transportType).toBe('TCP');
      });

      it('emits the correct transportType in MEDIA_QUALITY events when using a TURN server', async () => {
        fakeStats.audio.senders[0].report[4].relayProtocol = 'tls';
        fakeStats.video.senders[0].report[4].relayProtocol = 'tls';
        fakeStats.audio.receivers[0].report[4].relayProtocol = 'tls';
        fakeStats.video.receivers[0].report[4].relayProtocol = 'tls';
        console.log(mqeData.audioTransmit[0].common);

        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();
        console.log(mqeData.audioTransmit[0].common);

        expect(mqeData.audioTransmit[0].common.transportType).toBe('TLS');
        expect(mqeData.videoReceive[0].common.transportType).toBe('TLS');
      });

      it('emits the correct peripherals in MEDIA_QUALITY events', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        const microphonePeripheral = mqeData.intervalMetadata.peripherals.find(
          (val: { name: string; }) => val.name === MEDIA_DEVICES.MICROPHONE
        );
        const cameraPeripheral = mqeData.intervalMetadata.peripherals.find(
          (val: { name: string; }) => val.name === MEDIA_DEVICES.CAMERA
        );

        expect(microphonePeripheral.information).toBe('fake-microphone');
        expect(cameraPeripheral.information).toBe('fake-camera');
      });

      it('emits the correct peripherals in MEDIA_QUALITY events when localTrackLabel is undefined', async () => {
        fakeStats.audio.senders[0].localTrackLabel = undefined;
        fakeStats.video.senders[0].localTrackLabel = undefined;

        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        const microphonePeripheral = mqeData.intervalMetadata.peripherals.find(
          (val: { name: string; }) => val.name === MEDIA_DEVICES.MICROPHONE
        );
        const cameraPeripheral = mqeData.intervalMetadata.peripherals.find(
          (val: { name: string; }) => val.name === MEDIA_DEVICES.CAMERA
        );

        expect(microphonePeripheral.information).toBe(_UNKNOWN_);
        expect(cameraPeripheral.information).toBe(_UNKNOWN_);
      });

      it('should report a zero frame rate for both transmitted and received video at the start', async () => {
        await startStatsAnalyzer();
        expect(mqeData.videoTransmit[0].streams[0].common.transmittedFrameRate).toBe(0);
        expect(mqeData.videoReceive[0].streams[0].common.receivedFrameRate).toBe(0);
      });

      it('should accurately report the transmitted and received frame rate after video frames are processed', async () => {
        fakeStats.video.senders[0].report[0].framesSent += 300;
        fakeStats.video.receivers[0].report[0].framesReceived += 300;

        await startStatsAnalyzer();
        await progressTime();

        expect(mqeData.videoTransmit[0].streams[0].common.transmittedFrameRate).toBe(5);
        expect(mqeData.videoReceive[0].streams[0].common.receivedFrameRate).toBe(5);
      });

      it('should report zero RTP packets for all streams at the start of the stats analyzer', async () => {
        expect(mqeData.audioTransmit[0].common.rtpPackets).toBe(0);
        expect(mqeData.audioTransmit[0].streams[0].common.rtpPackets).toBe(0);
        expect(mqeData.audioReceive[0].common.rtpPackets).toBe(0);
        expect(mqeData.audioReceive[0].streams[0].common.rtpPackets).toBe(0);
        expect(mqeData.videoTransmit[0].common.rtpPackets).toBe(0);
        expect(mqeData.videoTransmit[0].streams[0].common.rtpPackets).toBe(0);
        expect(mqeData.videoReceive[0].common.rtpPackets).toBe(0);
        expect(mqeData.videoReceive[0].streams[0].common.rtpPackets).toBe(0);
      });

      it('should update the RTP packets count correctly after audio and video packets are sent', async () => {
        fakeStats.audio.senders[0].report[0].packetsSent += 5;
        fakeStats.video.senders[0].report[0].packetsSent += 5;
        await startStatsAnalyzer();
        await progressTime();

        expect(mqeData.audioTransmit[0].common.rtpPackets).toBe(5);
        expect(mqeData.audioTransmit[0].streams[0].common.rtpPackets).toBe(5);
        expect(mqeData.videoTransmit[0].common.rtpPackets).toBe(5);
        expect(mqeData.videoTransmit[0].streams[0].common.rtpPackets).toBe(5);
      });
      it('should update the RTP packets count correctly after audio and video packets are received', async () => {
        fakeStats.audio.senders[0].report[0].packetsSent += 10;
        fakeStats.video.senders[0].report[0].packetsSent += 10;
        fakeStats.audio.receivers[0].report[0].packetsReceived += 10;
        fakeStats.video.receivers[0].report[0].packetsReceived += 10;

        await startStatsAnalyzer();
        await progressTime();

        expect(mqeData.audioReceive[0].common.rtpPackets).toBe(10);
        expect(mqeData.audioReceive[0].streams[0].common.rtpPackets).toBe(10);
        expect(mqeData.videoReceive[0].common.rtpPackets).toBe(10);
        expect(mqeData.videoReceive[0].streams[0].common.rtpPackets).toBe(10);
      });

      it('should initially report zero FEC packets at the start of the stats analyzer', async () => {
        expect(mqeData.audioReceive[0].common.fecPackets).toBe(0);
      });

      it('should accurately report the count of FEC packets received', async () => {
        fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 5;

        await startStatsAnalyzer();
        await progressTime();

        expect(mqeData.audioReceive[0].common.fecPackets).toBe(5);
      });

      it('should correctly adjust the FEC packet count when packets are discarded', async () => {
        fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 15;
        fakeStats.audio.receivers[0].report[0].fecPacketsDiscarded += 5;

        await startStatsAnalyzer();
        await progressTime();

        expect(mqeData.audioReceive[0].common.fecPackets).toBe(10);
      });

      it('should report zero packet loss for both audio and video at the start of the stats analyzer', async () => {
        expect(mqeData.audioReceive[0].common.mediaHopByHopLost).toBe(0);
        expect(mqeData.audioReceive[0].common.rtpHopByHopLost).toBe(0);
        expect(mqeData.videoReceive[0].common.mediaHopByHopLost).toBe(0);
        expect(mqeData.videoReceive[0].common.rtpHopByHopLost).toBe(0);
      });

      it('should update packet loss metrics correctly for both audio and video after packet loss is detected', async () => {
        fakeStats.audio.receivers[0].report[0].packetsLost += 5;
        fakeStats.video.receivers[0].report[0].packetsLost += 5;

        await startStatsAnalyzer();
        await progressTime()

        expect(mqeData.audioReceive[0].common.mediaHopByHopLost).toBe(5);
        expect(mqeData.audioReceive[0].common.rtpHopByHopLost).toBe(5);
        expect(mqeData.videoReceive[0].common.mediaHopByHopLost).toBe(5);
        expect(mqeData.videoReceive[0].common.rtpHopByHopLost).toBe(5);
      });

      it('should report a zero remote loss rate for both audio and video at the start', async () => {
        expect(mqeData.audioTransmit[0].common.remoteLossRate).toBe(0);
        expect(mqeData.videoTransmit[0].common.remoteLossRate).toBe(0);
      });

      it('should maintain a zero remote loss rate for both audio and video after packets are sent without loss', async () => {
        fakeStats.audio.senders[0].report[0].packetsSent += 100;
        fakeStats.video.senders[0].report[0].packetsSent += 100;

        await startStatsAnalyzer();
        await progressTime()

        expect(mqeData.audioTransmit[0].common.remoteLossRate).toBe(0);
        expect(mqeData.videoTransmit[0].common.remoteLossRate).toBe(0);
      });
      it('should accurately calculate the remote loss rate for both audio and video after packet loss is detected', async () => {
        fakeStats.audio.senders[0].report[0].packetsSent += 200;
        fakeStats.audio.senders[0].report[1].packetsLost += 10;
        fakeStats.video.senders[0].report[0].packetsSent += 200;
        fakeStats.video.senders[0].report[1].packetsLost += 10;
        await startStatsAnalyzer();
        await progressTime()

        // Assuming the calculation for remoteLossRate is (packetsLost / packetsSent) * 100
        // and that the mqeData is updated accordingly elsewhere in the code.
        expect(mqeData.audioTransmit[0].common.remoteLossRate).toBe(5);
        expect(mqeData.videoTransmit[0].common.remoteLossRate).toBe(5);
      });

      it('has the correct localIpAddress set when the candidateType is host', async () => {
        await startStatsAnalyzer();

        await progressTime();
        expect(statsAnalyzer.getLocalIpAddress()).toBe('');
        mergeProperties(fakeStats, { address: 'test', candidateType: 'host' });
        await progressTime();
        expect(statsAnalyzer.getLocalIpAddress()).toBe('test');
      });
      it('has the correct localIpAddress set when the candidateType is prflx and relayProtocol is set', async () => {
        await startStatsAnalyzer();

        await progressTime();
        expect(statsAnalyzer.getLocalIpAddress()).toBe('');
        mergeProperties(fakeStats, {
          relayProtocol: 'test',
          address: 'test2',
          candidateType: 'prflx',
        });
        await progressTime();
        expect(statsAnalyzer.getLocalIpAddress()).toBe('test2');
      });

      it('has the correct localIpAddress set when the candidateType is prflx and relayProtocol is not set', async () => {
        await startStatsAnalyzer();

        await progressTime();
        expect(statsAnalyzer.getLocalIpAddress()).toBe('');
        mergeProperties(fakeStats, {
          relatedAddress: 'relatedAddress',
          address: 'test2',
          candidateType: 'prflx',
        });
        await progressTime();
        expect(statsAnalyzer.getLocalIpAddress()).toBe('relatedAddress');
      });

      it('has no localIpAddress set when the candidateType is invalid', async () => {
        await startStatsAnalyzer();

        await progressTime();
        expect(statsAnalyzer.getLocalIpAddress()).toBe('');
        mergeProperties(fakeStats, { candidateType: 'invalid' });
        await progressTime();
        expect(statsAnalyzer.getLocalIpAddress()).toBe('');
      });

      it('logs a message when audio send packets do not increase', async () => {
        await startStatsAnalyzer(
          { expected: { sendAudio: true } },
          { audio: { local: EVENTS.LOCAL_MEDIA_STARTED } }
        );

        // don't increase the packets when time progresses.
        await progressTime();

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#compareLastStatsResult --> No audio RTP packets sent', 0
        );
      });

      it('does not log a message when audio send packets increase', async () => {
        await startStatsAnalyzer(
          { expected: { sendAudio: true } },
          { audio: { local: EVENTS.LOCAL_MEDIA_STOPPED } }
        );

        fakeStats.audio.senders[0].report[0].packetsSent += 5;
        await progressTime();

        expect(loggerSpy).not.toHaveBeenCalledWith(
          'StatsAnalyzer:index#compareLastStatsResult --> No audio RTP packets sent'
        );
      });

      it('logs a message when video send packets do not increase', async () => {
        await startStatsAnalyzer(
          { expected: { sendVideo: true } },
          { video: { local: EVENTS.LOCAL_MEDIA_STARTED } }
        );

        // don't increase the packets when time progresses.
        await progressTime();

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#compareLastStatsResult --> No video RTP packets sent', 0
        );
      });

      it('does not log a message when video send packets increase', async () => {
        await startStatsAnalyzer(
          { expected: { sendVideo: true } },
          { video: { local: EVENTS.LOCAL_MEDIA_STOPPED } }
        );

        fakeStats.video.senders[0].report[0].packetsSent += 5;
        await progressTime();

        expect(loggerSpy).not.toHaveBeenCalledWith(
          'StatsAnalyzer:index#compareLastStatsResult --> No video RTP packets sent'
        );
      });

      it('logs a message when share send packets do not increase', async () => {
        await startStatsAnalyzer(
          { expected: { sendShare: true } },
          { share: { local: EVENTS.LOCAL_MEDIA_STARTED } }
        );

        // don't increase the packets when time progresses.
        await progressTime();

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#compareLastStatsResult --> No share RTP packets sent', 0
        );
      });

      it('does not log a message when share send packets increase', async () => {
        await startStatsAnalyzer(
          { expected: { sendShare: true } },
          { share: { local: EVENTS.LOCAL_MEDIA_STOPPED } }
        );

        fakeStats.share.senders[0].report[0].packetsSent += 5;
        await progressTime();

        expect(loggerSpy).not.toHaveBeenCalledWith(
          'StatsAnalyzer:index#compareLastStatsResult --> No share RTP packets sent'
        );
      });

      const streamStates: StreamState[] = ['no source', 'invalid source', 'avatar', 'bandwidth disabled', 'policy violation'];
      streamStates.forEach((sourceState) => {
        it(`does not log a message for sourceState "${sourceState}" with no packets received`, async () => {
          receiveSlot = { sourceState, csi: 2, id: '4' };

          await startStatsAnalyzer();
          await progressTime();

          expect(loggerSpy).not.toHaveBeenCalledWith(
            `No packets received for receive slot id: "4" and csi: "2". Total packets received on slot:`
          );
        });
      });

      it('logs a message if no packets are sent', async () => {

        receiveSlot = {
          sourceState: 'live',
          csi: 2,
          id: '4',
        };
        await startStatsAnalyzer();

        // don't increase the packets when time progresses.
        await progressTime();

        // Assertions using Jest's expect function
        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for mediaType: video-recv-0, receive slot id: "4" and csi: 2. Total packets received on slot: ',
          0
        );

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#processInboundRTPResult --> No frames received for mediaType: video-recv-0,  receive slot id: "4" and csi: 2. Total frames received on slot: ',
          0
        );

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#processInboundRTPResult --> No frames decoded for mediaType: video-recv-0,  receive slot id: "4" and csi: 2. Total frames decoded on slot: ',
          0
        );

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for mediaType: audio-recv-0, receive slot id: "4" and csi: 2. Total packets received on slot: ',
          0
        );

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for mediaType: video-share-recv-0, receive slot id: "4" and csi: 2. Total packets received on slot: ',
          0
        );

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#processInboundRTPResult --> No frames received for mediaType: video-share-recv-0,  receive slot id: "4" and csi: 2. Total frames received on slot: ',
          0
        );

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#processInboundRTPResult --> No frames decoded for mediaType: video-share-recv-0,  receive slot id: "4" and csi: 2. Total frames decoded on slot: ',
          0
        );

        expect(loggerSpy).toHaveBeenCalledWith(
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for mediaType: audio-share-recv-0, receive slot id: "4" and csi: 2. Total packets received on slot: ',
          0
        );

        loggerSpy.mockRestore();
      });

      it(`does not log a message if receiveSlot is undefined`, async () => {
        await startStatsAnalyzer();

        // don't increase the packets when time progresses.
        await progressTime();

        expect(loggerSpy).not.toHaveBeenCalledWith(
          'StatsAnalyzer:index#processInboundRTPResult --> No packets received for receive slot "". Total packets received on slot: ',
          0
        );
      });

      it('has the correct number of senders and receivers (2)', async () => {
        await startStatsAnalyzer({ expected: { receiveVideo: true } });

        await progressTime();

        expect(mqeData.audioTransmit.length).toBe(2);
        expect(mqeData.audioReceive.length).toBe(2);
        expect(mqeData.videoTransmit.length).toBe(2);
        expect(mqeData.videoReceive.length).toBe(2);
      });

      it('has one stream per sender/receiver', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await progressTime();

        expect(mqeData.audioTransmit[0].streams).toEqual([
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
        expect(mqeData.audioTransmit[1].streams).toEqual([
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
        expect(mqeData.audioReceive[0].streams).toEqual([
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
        expect(mqeData.audioReceive[1].streams).toEqual([
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
        expect(mqeData.videoTransmit[0].streams).toEqual([
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
        expect(mqeData.videoTransmit[1].streams).toEqual([
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
        expect(mqeData.videoReceive[0].streams).toEqual([
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
        expect(mqeData.videoReceive[1].streams).toEqual([
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
        pc.getTransceiverStats.mockResolvedValue({
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

        await startStatsAnalyzer({expected: {receiveVideo: true}});
        await progressTime();

        expect(mqeData.videoReceive[0].streams).toEqual([
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

      it('has three streams for video senders for simulcast', async () => {
        pc.getTransceiverStats.mockResolvedValue({
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

        await startStatsAnalyzer({expected: {receiveVideo: true}});
        await progressTime();

        expect(mqeData.videoTransmit[0].streams).toEqual([
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
              transmittedFrameRate: 0
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
          }
        ]);
      });

      it('reports active speaker as true when the participant has been speaking', async () => {
        fakeStats.video.receivers[0].report[0].isActiveSpeaker = true;

        await startStatsAnalyzer();
        await progressTime(5 * MQA_INTERVAL);

        expect(mqeData.videoReceive[0].streams[0].isActiveSpeaker).toBe(true);
      });

      it('reports active speaker as false when the participant has not spoken', async () => {
        fakeStats.video.receivers[0].report[0].isActiveSpeaker = false;

        await startStatsAnalyzer();
        await progressTime(5 * MQA_INTERVAL);

        expect(mqeData.videoReceive[0].streams[0].isActiveSpeaker).toBe(false);
      });

      it('defaults to false when active speaker status is indeterminate', async () => {
        fakeStats.video.receivers[0].report[0].isActiveSpeaker = undefined;

        await startStatsAnalyzer();
        await progressTime();

        expect(mqeData.videoReceive[0].streams[0].isActiveSpeaker).toBe(false);
      });
      it('updates active speaker to true following a recent status change to speaking', async () => {
        Object.defineProperty(performance, 'timeOrigin', { value: 1, configurable: true });
        fakeStats.video.receivers[0].report[0].isActiveSpeaker = false;
        fakeStats.video.receivers[0].report[0].lastActiveSpeakerUpdateTimestamp = performance.timeOrigin + performance.now() + (30 * 1000);

        await startStatsAnalyzer();
        await progressTime(MQA_INTERVAL);

        expect(mqeData.videoReceive[0].streams[0].isActiveSpeaker).toEqual(true);
        fakeStats.video.receivers[0].report[0].lastActiveSpeakerUpdateTimestamp = performance.timeOrigin + performance.now() + (60 * 1000);

        await progressTime(MQA_INTERVAL);

        expect(mqeData.videoReceive[0].streams[0].isActiveSpeaker).toEqual(false);
      });

      it('should send a stream if it is requested', async () => {
        fakeStats.audio.senders[0].report[0].isRequested = true;

        await startStatsAnalyzer();
        await progressTime(MQA_INTERVAL);

        expect(mqeData.audioTransmit[0].streams.length).toBe(1);
      });

      it('should not send a stream if its is requested flag is undefined', async () => {

        fakeStats.audio.senders[0].report[0].isRequested = undefined;

        await startStatsAnalyzer();
        await progressTime(MQA_INTERVAL);

        expect(mqeData.audioTransmit[0].streams.length).toEqual(0);
      });

      it('should not send a stream if it is not requested', async () => {
        // await startStatsAnalyzer();
        fakeStats.audio.receivers[0].report[0].isRequested = false;

        await startStatsAnalyzer();
        await progressTime(MQA_INTERVAL);

        expect(mqeData.audioReceive[0].streams.length).toEqual(0);
      });

      it('should send the stream if it was recently requested', async () => {
        Object.defineProperty(performance, 'timeOrigin', { value: 1, configurable: true });
        fakeStats.audio.receivers[0].report[0].lastRequestedUpdateTimestamp = performance.timeOrigin + performance.now() + (30 * 1000);
        fakeStats.audio.receivers[0].report[0].isRequested = false;

        await startStatsAnalyzer();
        await progressTime(MQA_INTERVAL);

        expect(mqeData.audioReceive[0].streams.length).toEqual(1);

        fakeStats.audio.receivers[0].report[0].lastRequestedUpdateTimestamp = performance.timeOrigin + performance.now() + (60 * 1000);

        await progressTime(MQA_INTERVAL);

        expect(mqeData.audioReceive[0].streams.length).toEqual(0);

      });

      it('should record the screen size from window.screen properties', async () => {
        Object.defineProperty(window.screen, 'width', { value: 1280, configurable: true });
        Object.defineProperty(window.screen, 'height', { value: 720, configurable: true });

        await startStatsAnalyzer();
        await progressTime(MQA_INTERVAL);

        expect(mqeData.intervalMetadata.screenWidth).toBe(1280);
        expect(mqeData.intervalMetadata.screenHeight).toBe(720);
        expect(mqeData.intervalMetadata.screenResolution).toBe(3600);
      });

      it('should record the initial app window size from window properties', async () => {
        Object.defineProperty(window, 'innerWidth', { value: 720, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 360, configurable: true });

        await startStatsAnalyzer();
        await progressTime(MQA_INTERVAL);

        expect(mqeData.intervalMetadata.appWindowWidth).toBe(720);
        expect(mqeData.intervalMetadata.appWindowHeight).toBe(360);
        expect(mqeData.intervalMetadata.appWindowSize).toBe(1013);
      });
    });
  });
});
