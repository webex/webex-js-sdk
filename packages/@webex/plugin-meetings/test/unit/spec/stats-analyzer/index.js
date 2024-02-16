import 'jsdom-global/register';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {ConnectionState} from '@webex/internal-media-core';

import {StatsAnalyzer, EVENTS} from '../../../../src/statsAnalyzer';
import NetworkQualityMonitor from '../../../../src/networkQualityMonitor';
import testUtils from '../../../utils/testUtils';
import {MEDIA_DEVICES, MQA_INTERVAL, _UNKNOWN_} from '@webex/plugin-meetings/src/constants';

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
                    bytesSent: 1,
                    packetsSent: 0,
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

      const mergeProperties = (
        target,
        properties,
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
        fakeStats.audio.senders[0].report[4].relayProtocol = 'tls';
        fakeStats.video.senders[0].report[4].relayProtocol = 'tls';
        fakeStats.audio.receivers[0].report[4].relayProtocol = 'tls';
        fakeStats.video.receivers[0].report[4].relayProtocol = 'tls';

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

      it('emits the correct transmittedFrameRate/receivedFrameRate', async () => {
        await startStatsAnalyzer();

        assert.strictEqual(mqeData.videoTransmit[0].streams[0].common.transmittedFrameRate, 0);
        assert.strictEqual(mqeData.videoReceive[0].streams[0].common.receivedFrameRate, 0);

        fakeStats.video.senders[0].report[0].framesSent += 300;
        fakeStats.video.receivers[0].report[0].framesReceived += 300;
        await progressTime(MQA_INTERVAL);

        assert.strictEqual(mqeData.videoTransmit[0].streams[0].common.transmittedFrameRate, 5);
        assert.strictEqual(mqeData.videoReceive[0].streams[0].common.receivedFrameRate, 5);

        fakeStats.video.senders[0].report[0].framesSent += 1800;
        fakeStats.video.receivers[0].report[0].framesReceived += 1800;
        await progressTime(MQA_INTERVAL);

        assert.strictEqual(mqeData.videoTransmit[0].streams[0].common.transmittedFrameRate, 30);
        assert.strictEqual(mqeData.videoReceive[0].streams[0].common.receivedFrameRate, 30);
      });

      it('emits the correct rtpPackets', async () => {
        await startStatsAnalyzer();

        assert.strictEqual(mqeData.audioTransmit[0].common.rtpPackets, 0);
        assert.strictEqual(mqeData.audioTransmit[0].streams[0].common.rtpPackets, 0);
        assert.strictEqual(mqeData.audioReceive[0].common.rtpPackets, 0);
        assert.strictEqual(mqeData.audioReceive[0].streams[0].common.rtpPackets, 0);
        assert.strictEqual(mqeData.videoTransmit[0].common.rtpPackets, 0);
        assert.strictEqual(mqeData.videoTransmit[0].streams[0].common.rtpPackets, 0);
        assert.strictEqual(mqeData.videoReceive[0].common.rtpPackets, 0);
        assert.strictEqual(mqeData.videoReceive[0].streams[0].common.rtpPackets, 0);

        fakeStats.audio.senders[0].report[0].packetsSent += 5;
        fakeStats.video.senders[0].report[0].packetsSent += 5;
        fakeStats.audio.receivers[0].report[0].packetsReceived += 5;
        fakeStats.video.receivers[0].report[0].packetsReceived += 5;
        await progressTime(MQA_INTERVAL);

        assert.strictEqual(mqeData.audioTransmit[0].common.rtpPackets, 5);
        assert.strictEqual(mqeData.audioTransmit[0].streams[0].common.rtpPackets, 5);
        assert.strictEqual(mqeData.audioReceive[0].common.rtpPackets, 5);
        assert.strictEqual(mqeData.audioReceive[0].streams[0].common.rtpPackets, 5);
        assert.strictEqual(mqeData.videoTransmit[0].common.rtpPackets, 5);
        assert.strictEqual(mqeData.videoTransmit[0].streams[0].common.rtpPackets, 5);
        assert.strictEqual(mqeData.videoReceive[0].common.rtpPackets, 5);
        assert.strictEqual(mqeData.videoReceive[0].streams[0].common.rtpPackets, 5);
      });

      it('emits the correct fecPackets', async () => {
        await startStatsAnalyzer();

        assert.strictEqual(mqeData.audioReceive[0].common.fecPackets, 0);

        fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 5;
        await progressTime(MQA_INTERVAL);

        assert.strictEqual(mqeData.audioReceive[0].common.fecPackets, 5);

        fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 10;
        await progressTime(MQA_INTERVAL);

        assert.strictEqual(mqeData.audioReceive[0].common.fecPackets, 10);

        fakeStats.audio.receivers[0].report[0].fecPacketsReceived += 10;
        fakeStats.audio.receivers[0].report[0].fecPacketsDiscarded += 5;
        await progressTime(MQA_INTERVAL);

        assert.strictEqual(mqeData.audioReceive[0].common.fecPackets, 5);
      });

      it('emits the correct mediaHopByHopLost/rtpHopByHopLost', async () => {
        await startStatsAnalyzer();

        assert.strictEqual(mqeData.audioReceive[0].common.mediaHopByHopLost, 0);
        assert.strictEqual(mqeData.audioReceive[0].common.rtpHopByHopLost, 0);
        assert.strictEqual(mqeData.videoReceive[0].common.mediaHopByHopLost, 0);
        assert.strictEqual(mqeData.videoReceive[0].common.rtpHopByHopLost, 0);

        fakeStats.audio.receivers[0].report[0].packetsLost += 5;
        fakeStats.video.receivers[0].report[0].packetsLost += 5;
        await progressTime(MQA_INTERVAL);

        assert.strictEqual(mqeData.audioReceive[0].common.mediaHopByHopLost, 5);
        assert.strictEqual(mqeData.audioReceive[0].common.rtpHopByHopLost, 5);
        assert.strictEqual(mqeData.videoReceive[0].common.mediaHopByHopLost, 5);
        assert.strictEqual(mqeData.videoReceive[0].common.rtpHopByHopLost, 5);
      });

      it('emits the correct remoteLossRate', async () => {
        await startStatsAnalyzer();

        assert.strictEqual(mqeData.audioTransmit[0].common.remoteLossRate, 0);
        assert.strictEqual(mqeData.videoTransmit[0].common.remoteLossRate, 0);

        fakeStats.audio.senders[0].report[0].packetsSent += 100;
        fakeStats.audio.senders[0].report[1].packetsLost += 5;
        fakeStats.video.senders[0].report[0].packetsSent += 100;
        fakeStats.video.senders[0].report[1].packetsLost += 5;
        await progressTime(MQA_INTERVAL);

        assert.strictEqual(mqeData.audioTransmit[0].common.remoteLossRate, 5);
        assert.strictEqual(mqeData.videoTransmit[0].common.remoteLossRate, 5);

        fakeStats.audio.senders[0].report[0].packetsSent += 100;
        fakeStats.audio.senders[0].report[1].packetsLost += 10;
        fakeStats.video.senders[0].report[0].packetsSent += 100;
        fakeStats.video.senders[0].report[1].packetsLost += 10;
        await progressTime(MQA_INTERVAL);

        assert.strictEqual(mqeData.audioTransmit[0].common.remoteLossRate, 10);
        assert.strictEqual(mqeData.videoTransmit[0].common.remoteLossRate, 10);
      });

      it('has the correct localIpAddress set when the candidateType is host', async () => {
        await startStatsAnalyzer();

        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), '');
        mergeProperties(fakeStats, {address: 'test', candidateType: 'host'});
        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), 'test');
      });

      it('has the correct localIpAddress set when the candidateType is prflx and relayProtocol is set', async () => {
        await startStatsAnalyzer();

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
        await startStatsAnalyzer();

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
        await startStatsAnalyzer();

        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), '');
        mergeProperties(fakeStats, {candidateType: 'invalid'});
        await progressTime();
        assert.strictEqual(statsAnalyzer.getLocalIpAddress(), '');
      });
    });
  });
});
