import 'jsdom-global/register';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import NetworkQualityMonitor from '../../../../src/networkQualityMonitor';
import {EVENT_TRIGGERS} from '../../../../src/constants';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

// eslint-disable-next-line mocha/no-exclusive-tests
describe('plugin-meetings', () => {
  describe('NetworkQualityMonitor', () => {
    let networkQualityMonitor;
    let sandBoxEmitSpy;

    const initialConfig = {
      videoPacketLossRatioThreshold: 9,
      rttThreshold: 500,
      jitterThreshold: 500
    };

    const configObject = {
      mediaType: 'video',
      remoteRtpResults: {
        id: 'RTCRemoteInboundRtpVideoStream_2411086660',
        timestamp: 1624472676193.79,
        type: 'remote-inbound-rtp',
        ssrc: 2411086660,
        kind: 'video',
        transportId: 'RTCTransport_1_1',
        codecId: 'RTCCodec_1_Outbound_102',
        jitter: 0.004,
        packetsLost: 8,
        localId: 'RTCOutboundRTPVideoStream_2411086660',
        roundTripTime: 0.648,
        fractionLost: 0,
        totalRoundTripTime: 3.554,
        roundTripTimeMeasurements: 14
      },
      statsAnalyzerCurrentStats: {
        audio: {
          send: {
            currentPacketLossRatio: 8
          }
        },
        video: {
          send: {
            currentPacketLossRatio: 10
          }
        }
      }
    };

    const sandbox = sinon.createSandbox();

    beforeEach(() => {
      networkQualityMonitor = new NetworkQualityMonitor(initialConfig);
      sandbox.spy(networkQualityMonitor, 'updateNetworkQualityStatus');
      sandBoxEmitSpy = sandbox.spy(networkQualityMonitor, 'emit');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should trigger updateNetworkQualityStatus when determineUplinkNetworkQuality has finished', async () => {
      await networkQualityMonitor.determineUplinkNetworkQuality(configObject);

      assert.calledOnce(networkQualityMonitor.updateNetworkQualityStatus);
    });

    it('should emit a network quality judgement event with the proper payload', async () => {
      await networkQualityMonitor.determineUplinkNetworkQuality(configObject);
      assert(sandBoxEmitSpy.calledWith(sinon.match({
        file: 'networkQualityMonitor',
        function: 'emitNetworkQuality'
      }), sinon.match(EVENT_TRIGGERS.NETWORK_QUALITY), sinon.match({
        mediaType: 'video',
        networkQualityScore: 0
      })));
    });

    it('should reset to default values after determineUplinkNetworkQuality call stack is complete', async () => {
      await networkQualityMonitor.determineUplinkNetworkQuality(configObject);
      assert.isNull(networkQualityMonitor.mediaType);
      assert.deepEqual(networkQualityMonitor.networkQualityScore, 1);
    });
  });
});
