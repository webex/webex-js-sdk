import 'jsdom-global/register';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {ConnectionState} from '@webex/internal-media-core';

import {StatsAnalyzer, EVENTS} from '../../../../src/statsAnalyzer';
import NetworkQualityMonitor from '../../../../src/networkQualityMonitor';
import testUtils from '../../../utils/testUtils';

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
      const statusResultOutboundRTP = {
        type: 'outbound-rtp',
        frameHeight: 720,
        frameWidth: 1280,
        packetsLost: 11,
        framesSent: 105,
        hugeFramesSent: 1,
        framesEncoded: 102,
        rttThreshold: 501,
        jitterThreshold: 501,
        jitterBufferDelay: 288.131459,
        jitterBufferEmittedCount: 4013,
        trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
        bytesSent: 1233,
        totalPacketsSent: 100,
      };

      const statusResultInboundRTP = {
        type: 'inbound-rtp',
        frameHeight: 720,
        frameWidth: 1280,
        packetsLost: 11,
        rttThreshold: 501,
        jitterThreshold: 501,
        framesDecoded: 4013,
        framesDropped: 0,
        framesReceived: 4016,
        jitterBufferDelay: 288.131459,
        jitterBufferEmittedCount: 4013,
        trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
        packetsReceived: 1022,
        bytesReceived: 1054,
      };

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
                report: [
                  {
                    type: 'outbound-rtp',
                    packetsSent: 0,
                    bytesSent: 1,
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
                ],
              },
            ],
          },
          video: {
            senders: [
              {
                report: [
                  {
                    type: 'outbound-rtp',
                    framesSent: 0,
                    bytesSent: 1,
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
                    framesReceived: 1,
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
              senders: [],
              receivers: [],
            },
            screenShareVideo: {
              senders: [],
              receivers: [],
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
        statsAnalyzer.on(EVENTS.NO_FRAMES_SENT, (data) => {
          receivedEventsData.noFramesSent = data;
        });
        statsAnalyzer.on(EVENTS.NO_VIDEO_ENCODED, (data) => {
          receivedEventsData.noVideoEncoded = data;
        });
        statsAnalyzer.on(EVENTS.NO_VIDEO_DECODED, (data) => {
          receivedEventsData.noVideoDecoded = data;
        });
        statsAnalyzer.on(EVENTS.NO_FRAMES_RECEIVED, (data) => {
          receivedEventsData.noFramesReceived = data;
        });
        statsAnalyzer.on(EVENTS.NO_AUDIO_RECEIVED, (data) => {
          receivedEventsData.noAudioReceived = data;
        });
        statsAnalyzer.on(EVENTS.NO_AUDIO_SENT, (data) => {
          receivedEventsData.noAudioSent = data;
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

      const checkStats = (type) => {
        const statsResult = {
          jitterBufferDelay: 288.131459,
          jitterBufferEmittedCount: 4013,
          trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
          avgJitterDelay: 0.07179951632195365,
          width: 1280,
          height: 720,
        };
        if (type === 'inbound-rtp') {
          statsResult.framesDecoded = 4013;
          statsResult.framesDropped = 0;
          statsResult.framesReceived = 4016;
          assert.deepEqual(statsAnalyzer.statsResults.resolutions.video.recv, statsResult);
        } else if (type === 'outbound-rtp') {
          statsResult.framesSent = 105;
          statsResult.hugeFramesSent = 1;
          assert.deepEqual(statsAnalyzer.statsResults.resolutions.video.send, statsResult);
        }
      };
      it('processes track results with audio', async () => {
        const statusResultOutboundRTPAudio = {
          type: 'outbound-rtp',
          availableBandwidth: 0,
          jitterBufferDelay: 288.131459,
          jitterBufferEmittedCount: 4013,
          trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
        };
        const emptySender = {
          trackLabel: '',
          maxPacketLossRatio: 0,
          availableBandwidth: 0,
          bytesSent: 0,
          meanRemoteJitter: [],
          meanRoundTripTime: [],
        };
        const expected = {
          availableBandwidth: 0,
          avgJitterDelay: 0.07179951632195365,
          bytesSent: 0,
          trackLabel: '',
          maxPacketLossRatio: 0,
          meanRemoteJitter: [],
          jitterBufferDelay: 288.131459,
          jitterBufferEmittedCount: 4013,
          trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
          meanRoundTripTime: [],
        };
        await startStatsAnalyzer({expected: {receiveAudio: true}});
        statsAnalyzer.statsResults.resolutions['audio-send'].send = emptySender;
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTPAudio, 'audio-send', true);
        assert.deepEqual(statsAnalyzer.statsResults.resolutions['audio-send'].send, expected);
      });

      it('emits NO_AUDIO_SENT when no audio RTP packets are sent', async () => {
        const statusResultOutboundRTPAudio = {
          type: 'outbound-rtp',
          availableBandwidth: 0,
          jitterBufferDelay: 288.131459,
          jitterBufferEmittedCount: 4013,
          trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
          totalPacketsSent: 100,
          packetsSent: 100,
          bytesSent: 102,
        };
        await startStatsAnalyzer({expected: {sendAudio: true}});

        statsAnalyzer.lastStatsResults['audio-send'].send.totalPacketsSent = 100;
        statsAnalyzer.lastEmittedStartStopEvent['audio'].local = EVENTS.LOCAL_MEDIA_STARTED;
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTPAudio, 'audio-send', true);
        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noAudioSent, {mediaType: 'audio'});
      });

      it('emits NO_AUDIO_SENT when there is no audio energy', async () => {
        const statusResultOutboundRTPAudio = {
          type: 'media-source',
          trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
          totalAudioEnergy: 0.002,
        };
        await startStatsAnalyzer({expected: {sendAudio: true}});

        statsAnalyzer.lastStatsResults['audio-send'].send.totalAudioEnergy = 0.002;
        statsAnalyzer.lastEmittedStartStopEvent['audio'].local = EVENTS.LOCAL_MEDIA_STARTED;
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTPAudio, 'audio-send', true);
        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noAudioSent, {mediaType: 'audio'});
      });

      it('emits NO_AUDIO_RECEIVED when no audio samples are received', async () => {
        const statusResultOutboundRTPAudio = {
          type: 'inbound-rtp',
          jitterBufferDelay: 288.131459,
          jitterBufferEmittedCount: 4013,
          trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
          packetsReceived: 100,
          bytesReceived: 102,
          totalSamplesReceived: 205,
        };

        await startStatsAnalyzer({expected: {receiveAudio: true}});

        statsAnalyzer.lastStatsResults['audio-recv-0'].recv.totalSamplesReceived = 205;
        statsAnalyzer.lastEmittedStartStopEvent['audio'].remote = EVENTS.REMOTE_MEDIA_STARTED;

        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTPAudio, 'audio-recv-0');
        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noAudioReceived, {mediaType: 'audio'});
      });

      it('emits NO_AUDIO_RECEIVED when no audio packets are received', async () => {
        const statusResultOutboundRTPAudio = {
          type: 'inbound-rtp',
          jitterBufferDelay: 288.131459,
          jitterBufferEmittedCount: 4013,
          trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
          packetsReceived: 100,
          bytesReceived: 102,
        };

        await startStatsAnalyzer({expected: {receiveAudio: true}});

        statsAnalyzer.lastStatsResults['audio-recv-0'].recv.totalPacketsReceived = 100;
        statsAnalyzer.lastEmittedStartStopEvent['audio'].remote = EVENTS.REMOTE_MEDIA_STARTED;

        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTPAudio, 'audio-recv-0');
        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noAudioReceived, {mediaType: 'audio'});
      });

      it('emits NO_AUDIO_SENT when there is no audio level', async () => {
        const statusResultOutboundRTPAudio = {
          type: 'media-source',
          trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
          audioLevel: 0.001,
        };
        await startStatsAnalyzer({expected: {sendAudio: true}});

        statsAnalyzer.lastStatsResults['audio-send'].send.audioLevel = 0.001;
        statsAnalyzer.lastEmittedStartStopEvent['audio'].local = EVENTS.LOCAL_MEDIA_STARTED;
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTPAudio, 'audio-send', true);
        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noAudioSent, {mediaType: 'audio'});
      });

      it('processes track results and populate statsResults.resolutions object when type is inbound-rtp with video', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});
        await statsAnalyzer.parseGetStatsResult(statusResultInboundRTP, 'video');
        checkStats('inbound-rtp');
      });
      it('processes track results and populate statsResults.resolutions object when type is outbound-rtp with video', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video', true);
        checkStats('outbound-rtp');
      });

      it('emits NO_VIDEO_ENCODED when frames are not being encoded', async () => {
        const expected = {mediaType: 'video'};
        await startStatsAnalyzer({expected: {sendVideo: true}});
        statsAnalyzer;
        statsAnalyzer.lastStatsResults['video-send'].send = {
          framesEncoded: 102,
          framesSent: 105,
        };
        statsAnalyzer.lastEmittedStartStopEvent.video.local = EVENTS.LOCAL_MEDIA_STARTED;
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video-send', true);

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noVideoEncoded, expected);
      });

      it('emits NO_VIDEO_DECODED when frames are not being decoded', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});
        statsAnalyzer.lastStatsResults['video-recv-0'].recv.framesDecoded = 4013;
        statsAnalyzer.lastStatsResults['video-recv-0'].recv.totalPacketsReceived = 10;

        statsAnalyzer.lastEmittedStartStopEvent.video.remote = EVENTS.REMOTE_MEDIA_STARTED;
        await statsAnalyzer.parseGetStatsResult(statusResultInboundRTP, 'video-recv-0');
        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noVideoDecoded, {mediaType: 'video'});
      });

      it('emits NO_FRAMES_SENT when frames are not being sent but frames are being encoded', async () => {
        await startStatsAnalyzer({expected: {sendVideo: true}});
        statsAnalyzer.lastEmittedStartStopEvent.video.local = EVENTS.LOCAL_MEDIA_STARTED;
        const expected = {mediaType: 'video'};
        statsAnalyzer.lastStatsResults['video-send'].send = {
          framesEncoded: 10,
          framesSent: 105,
          totalPacketsSent: 106,
        };
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video-send', true);

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesSent, expected);
      });
      it('emits NO_FRAMES_RECEIVED when frames are not being received', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});
        statsAnalyzer.lastStatsResults['video-recv-0'].recv = {
          framesReceived: 4016,
        };
        statsAnalyzer.statsResults['video-recv-0'].recv.totalPacketsReceived = 10;
        statsAnalyzer.lastEmittedStartStopEvent.video.remote = EVENTS.REMOTE_MEDIA_STARTED;

        await statsAnalyzer.parseGetStatsResult(statusResultInboundRTP, 'video');
        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesReceived, {mediaType: 'video'});
      });

      it('doesnot emits NO_FRAMES_SENT when last emitted event is LOCAL_MEDIA_STOPPED', async () => {
        statsAnalyzer.lastEmittedStartStopEvent.video.local = EVENTS.LOCAL_MEDIA_STOPPED;

        await startStatsAnalyzer({expected: {sendVideo: true}});
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video-send', true);

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesSent, undefined);
      });

      it('emits NO_FRAMES_SENT when frames are not being sent but frames are being encoded for share', async () => {
        const expected = {mediaType: 'share'};
        await startStatsAnalyzer({expected: {sendShare: true}});
        statsAnalyzer.lastEmittedStartStopEvent.share.local = EVENTS.LOCAL_MEDIA_STARTED;
        statsAnalyzer.lastStatsResults['video-share-send'] = {
          send: {
            framesEncoded: 10,
            framesSent: 105,
            totalPacketsSent: 106,
          },
        };

        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video-share-send', true);

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesSent, expected);
      });

      it('emits NO_VIDEO_ENCODED when frames are not being encoded for share', async () => {
        const expected = {mediaType: 'share'};
        await startStatsAnalyzer({expected: {sendShare: true}});
        statsAnalyzer.lastEmittedStartStopEvent.share.local = EVENTS.LOCAL_MEDIA_STARTED;
        statsAnalyzer.lastStatsResults['video-share-send'] = {
          send: {
            framesSent: 105,
            framesEncoded: 102,
            totalPacketsSent: 106,
          },
        };

        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video-share-send', true);
        statusResultOutboundRTP.framesSent = await statsAnalyzer.parseGetStatsResult(
          statusResultOutboundRTP,
          'video-share-send',
          true
        );

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noVideoEncoded, expected);
      });

      it('doesnot emits NO_FRAMES_SENT when last emitted event is LOCAL_MEDIA_STOPPED for share', async () => {
        statsAnalyzer.lastEmittedStartStopEvent.share.local = EVENTS.LOCAL_MEDIA_STOPPED;

        await startStatsAnalyzer({expected: {sendShare: true}});
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video-share-send', true);

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesSent, undefined);
      });
      it('emits NO_VIDEO_DECODED when frames are not being decoded for share', async () => {
        await startStatsAnalyzer({expected: {sendShare: true}});
        statsAnalyzer.lastStatsResults['video-share-recv-0'] = {
          recv: {},
        };

        statsAnalyzer.lastStatsResults['video-share-recv-0'].recv.framesDecoded = 4013;
        statsAnalyzer.lastStatsResults['video-share-recv-0'].recv.totalPacketsReceived = 10;

        statsAnalyzer.lastEmittedStartStopEvent.share.remote = EVENTS.REMOTE_MEDIA_STARTED;
        await statsAnalyzer.parseGetStatsResult(statusResultInboundRTP, 'video-share-recv-0');
        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noVideoDecoded, {mediaType: 'share'});
      });

      it('emits NO_FRAMES_RECEIVED when frames are not being received for share', async () => {
        await startStatsAnalyzer({expected: {sendShare: true}});
        statsAnalyzer.lastStatsResults['video-share-recv-0'] = {
          recv: {},
        };
        statsAnalyzer.lastStatsResults['video-share-recv-0'].recv.framesReceived = 4016;
        statsAnalyzer.statsResults['video-share-recv-0'].recv.totalPacketsReceived = 10;
        statsAnalyzer.lastEmittedStartStopEvent.share.remote = EVENTS.REMOTE_MEDIA_STARTED;

        await statsAnalyzer.parseGetStatsResult(statusResultInboundRTP, 'video');
        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesReceived, {mediaType: 'share'});
      });
    });
  });
});
