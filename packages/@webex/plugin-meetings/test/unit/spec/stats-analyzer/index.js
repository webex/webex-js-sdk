import 'jsdom-global/register';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

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
        internal: {
          video: {
            send: {
              totalPacketsLostOnReceiver: 10,
            },
          },
        },
        video: {
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

        statsAnalyzer = new StatsAnalyzer(initialConfig, networkQualityMonitor, defaultStats);

        sandBoxSpy = sandbox.spy(
          statsAnalyzer.networkQualityMonitor,
          'determineUplinkNetworkQuality'
        );
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should trigger determineUplinkNetworkQuality with specific arguments', async () => {
        await statsAnalyzer.parseGetStatsResult(statusResult, 'video');

        assert.calledOnce(statsAnalyzer.networkQualityMonitor.determineUplinkNetworkQuality);
        assert(
          sandBoxSpy.calledWith({
            mediaType: 'video',
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
            receiver: {
              type: 'inbound-rtp',
              packetsReceived: 0,
              bytesReceived: 1,
            },
            sender: {
              type: 'outbound-rtp',
              packetsSent: 0,
              bytesSent: 1,
            },
          },
          video: {
            receiver: {
              type: 'inbound-rtp',
              framesDecoded: 0,
              bytesReceived: 1,
            },
            sender: {
              type: 'outbound-rtp',
              framesSent: 0,
              bytesSent: 1,
            },
          },
        };

        pc = {
          audioTransceiver: {
            sender: {
              getStats: sinon.stub().resolves([fakeStats.audio.sender]),
            },
            receiver: {
              getStats: sinon.stub().resolves([fakeStats.audio.receiver]),
            },
          },
          videoTransceiver: {
            sender: {
              getStats: sinon.stub().resolves([fakeStats.video.sender]),
            },
            receiver: {
              getStats: sinon.stub().resolves([fakeStats.video.receiver]),
            },
          },
          shareTransceiver: {
            sender: {
              getStats: sinon.stub().resolves([]),
            },
            receiver: {
              getStats: sinon.stub().resolves([]),
            },
          },
        };

        networkQualityMonitor = new NetworkQualityMonitor(initialConfig);

        statsAnalyzer = new StatsAnalyzer(initialConfig, networkQualityMonitor);

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
        statsAnalyzer.on(EVENTS.NO_FRAMES_SENT, (data) => {
          receivedEventsData.noFramesSent = data;
        });
        statsAnalyzer.on(EVENTS.NO_VIDEO_ENCODED, (data) => {
          receivedEventsData.noVideoEncoded = data;
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

      it('emits LOCAL_MEDIA_STARTED and LOCAL_MEDIA_STOPPED events for audio', async () => {
        await startStatsAnalyzer({expected: {sendAudio: true}});

        // check that we haven't received any events yet
        checkReceivedEvent({expected: {}});

        // setup a mock to return some values higher the previous ones
        fakeStats.audio.sender.packetsSent += 10;

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
        fakeStats.video.sender.framesSent += 1;

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
        fakeStats.audio.receiver.packetsReceived += 5;

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
        fakeStats.video.receiver.framesDecoded += 1;

        await progressTime();
        // check that we got the REMOTE_MEDIA_STARTED event for video
        checkReceivedEvent({expected: {remote: {started: {type: 'video'}}}});

        // now advance the clock and the mock still returns same values, so only "stopped" event should be triggered
        resetReceivedEvents();
        await progressTime();

        checkReceivedEvent({expected: {remote: {stopped: {type: 'video'}}}});
      });

      const checkStats = (type) => {
        const statsResult = {
          height: 720,
          width: 1280,
          jitterBufferDelay: 288.131459,
          jitterBufferEmittedCount: 4013,
          trackIdentifier: '6bbf5506-6a7e-4397-951c-c05b72ab0ace',
          avgJitterDelay: 0.07179951632195365,
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

      it('processes track results and populate statsResults.resolutions object when type is inbound-rtp with video', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});
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
        };
        await statsAnalyzer.parseGetStatsResult(statusResultInboundRTP, 'video');
        checkStats('inbound-rtp');
      });
      it('processes track results and populate statsResults.resolutions object when type is outbound-rtp with video', async () => {
        await startStatsAnalyzer({expected: {receiveVideo: true}});

        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video');
        checkStats('outbound-rtp');
      });

      it('doesnot processes track results with audio', async () => {
        await startStatsAnalyzer({expected: {receiveAudio: true}});
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'audio');
        assert.deepEqual(statsAnalyzer.statsResults.resolutions.audio, undefined);
      });

      it('emits NO_FRAMES_ENCODED when frames are not being encoded', async () => {
        const expected = {mediaType: 'video'};
        await startStatsAnalyzer({expected: {sendVideo: true}});

        statsAnalyzer.lastStatsResults.video.send = {framesEncoded: 102, totalPacketsSent: 106};

        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video');

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noVideoEncoded, expected);
      });

      it('emits NO_FRAMES_SENT when frames are not being sent but frames are being encoded', async () => {
        await startStatsAnalyzer({expected: {sendVideo: true}});

        const expected = {mediaType: 'video'};

        statsAnalyzer.lastStatsResults.video.send = {
          framesEncoded: 10,
          framesSent: 105,
          totalPacketsSent: 106,
        };
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video');

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesSent, expected);
      });

      it('doesnot emits NO_FRAMES_SENT when last emitted event is LOCAL_MEDIA_STOPPED', async () => {
        statsAnalyzer.lastEmittedStartStopEvent.video.local = EVENTS.LOCAL_MEDIA_STOPPED;

        await startStatsAnalyzer({expected: {sendVideo: true}});
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'video');

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesSent, undefined);
      });

      it('emits NO_FRAMES_ENCODED when frames are not being encoded for share', async () => {
        const expected = {mediaType: 'share'};
        await startStatsAnalyzer({expected: {sendShare: true}});

        statsAnalyzer.lastStatsResults.share.send = {framesEncoded: 102, totalPacketsSent: 106};

        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'share');

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noVideoEncoded, expected);
      });

      it('emits NO_FRAMES_SENT when frames are not being sent but frames are being encoded for share', async () => {
        const expected = {mediaType: 'share'};
        await startStatsAnalyzer({expected: {sendShare: true}});

        statsAnalyzer.lastStatsResults.share.send = {
          framesEncoded: 10,
          framesSent: 105,
          totalPacketsSent: 106,
        };

        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'share');

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesSent, expected);
      });

      it('doesnot emits NO_FRAMES_SENT when last emitted event is LOCAL_MEDIA_STOPPED for share', async () => {
        statsAnalyzer.lastEmittedStartStopEvent.video.local = EVENTS.LOCAL_MEDIA_STOPPED;

        await startStatsAnalyzer({expected: {sendShare: true}});
        await statsAnalyzer.parseGetStatsResult(statusResultOutboundRTP, 'share');

        statsAnalyzer.compareLastStatsResult();
        assert.deepEqual(receivedEventsData.noFramesSent, undefined);
      });
    });
  });
});
