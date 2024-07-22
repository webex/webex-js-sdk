import { expect } from '@jest/globals';
import NetworkQualityMonitor from "../../../../src/networkQualityMonitor";
import {EVENT_TRIGGERS} from '../../../../src/constants';
jest.mock('../../../../src/common/logs/logger-proxy');
describe('plugin-meetings', () => {
  describe('NetworkQualityMonitor', () => {
    let networkQualityMonitor: NetworkQualityMonitor;
    let mockEmit: jest.SpyInstance;

    const initialConfig = {
      videoPacketLossRatioThreshold: 9,
      rttThreshold: 500,
      jitterThreshold: 500,
    };

    const configObject = {
      mediaType: 'video-send',
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
        roundTripTimeMeasurements: 14,
      },
      statsAnalyzerCurrentStats: {
        'audio-send': {
          send: {
            currentPacketLossRatio: 8,
          },
        },
        'video-send': {
          send: {
            currentPacketLossRatio: 10,
          },
        },
      },
    };

    beforeEach(() => {
      networkQualityMonitor = new NetworkQualityMonitor(initialConfig);
      jest.spyOn(networkQualityMonitor, 'updateNetworkQualityStatus');
      mockEmit = jest.spyOn(networkQualityMonitor, 'emit');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should trigger updateNetworkQualityStatus when determineUplinkNetworkQuality has finished', async () => {
      networkQualityMonitor.determineUplinkNetworkQuality(configObject);

      expect(networkQualityMonitor.updateNetworkQualityStatus).toHaveBeenCalledTimes(1);
    });

    it('should emit a network quality judgement event with the proper payload', async () => {
      networkQualityMonitor.determineUplinkNetworkQuality(configObject);
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          file: 'networkQualityMonitor',
          function: 'emitNetworkQuality',
        }),
        EVENT_TRIGGERS.NETWORK_QUALITY,
        expect.objectContaining({
          mediaType: 'video-send',
          networkQualityScore: 0,
        })
      );
    });

    it('should reset to default values after determineUplinkNetworkQuality call stack is complete', async () => {
      networkQualityMonitor.determineUplinkNetworkQuality(configObject);
      expect(networkQualityMonitor.mediaType).toBeNull();
      expect(networkQualityMonitor.networkQualityScore).toEqual(1);
    });
  });
});
