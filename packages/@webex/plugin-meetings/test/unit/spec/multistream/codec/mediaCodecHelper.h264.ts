import 'jsdom-global/register';
import MediaCodecHelperH264 from '@webex/plugin-meetings/src/multistream/codec/mediaCodecHelper.h264';
import {H264_CODEC_PARAMETERS, CODEC_DEFAULTS} from '@webex/plugin-meetings/src/multistream/codec/constants';
import {MediaRequest, RemoteVideoResolution} from '@webex/plugin-meetings/src/multistream/types';
import {expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import * as internalMediaCore from '@webex/internal-media-core';

describe('MediaCodecHelper.H264', () => {
  let helper: MediaCodecHelperH264;
  let getRecommendedMaxBitrateForFrameSizeStub: sinon.SinonStub;

  beforeEach(() => {
    helper = new MediaCodecHelperH264();
    getRecommendedMaxBitrateForFrameSizeStub = sinon.stub(internalMediaCore, 'getRecommendedMaxBitrateForFrameSize');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getCodecInfo', () => {
    it('should return undefined when getMaxFs is not provided', () => {
      const result = helper.getCodecInfo({});
      expect(result).to.be.undefined;
    });

    it('should return H264CodecInfo with maxFs when getMaxFs is provided', () => {
      const maxFs = 3600;
      const result = helper.getCodecInfo({getMaxFs: () => maxFs});

      expect(result).to.deep.equal({
        codec: 'h264',
        maxFs: maxFs,
      });
    });

    it('should call getMaxFs function to get the value', () => {
      const getMaxFs = sinon.stub().returns(8192);
      helper.getCodecInfo({getMaxFs});

      expect(getMaxFs.calledOnce).to.be.true;
    });
  });

  describe('degradeMediaRequest', () => {
    it('should return 0 when codecInfo is not h264', () => {
      const mediaRequest = {
        codecInfo: {codec: 'av1' as const},
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker' as const, priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.degradeMediaRequest(mediaRequest, '720p');
      expect(result).to.equal(0);
    });

    it('should return 0 when codecInfo is undefined', () => {
      const mediaRequest = {
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker' as const, priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.degradeMediaRequest(mediaRequest, '720p');
      expect(result).to.equal(0);
    });

    it('should update maxFs to the minimum of preferredMaxFs, current maxFs, and resolution maxFs', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'h264', maxFs: 8192},
        preferredMaxFs: 5000,
        receiveSlots: [{sourceState: 'live'} as any],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      helper.degradeMediaRequest(mediaRequest, '720p');

      expect(mediaRequest.codecInfo.maxFs).to.equal(H264_CODEC_PARAMETERS['720p'].maxFs);
    });

    it('should use CODEC_DEFAULTS when preferredMaxFs is not provided', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'h264', maxFs: 1000},
        receiveSlots: [{sourceState: 'live'} as any],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      helper.degradeMediaRequest(mediaRequest, '360p');

      expect(mediaRequest.codecInfo.maxFs).to.equal(H264_CODEC_PARAMETERS['360p'].maxFs);
    });

    it('should use CODEC_DEFAULTS when current maxFs is not provided', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'h264'},
        receiveSlots: [{sourceState: 'live'} as any],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      helper.degradeMediaRequest(mediaRequest, '720p');

      expect(mediaRequest.codecInfo.maxFs).to.equal(H264_CODEC_PARAMETERS['720p'].maxFs);
    });

    it('should return total macroblocks as maxFs * number of live slots', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'h264', maxFs: 8192},
        receiveSlots: [
          {sourceState: 'live'} as any,
          {sourceState: 'live'} as any,
          {sourceState: 'live'} as any,
        ],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.degradeMediaRequest(mediaRequest, '720p');

      expect(result).to.equal(H264_CODEC_PARAMETERS['720p'].maxFs * 3);
    });

    it('should only count slots with "live" sourceState', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'h264', maxFs: 8192},
        receiveSlots: [
          {sourceState: 'live'} as any,
          {sourceState: 'inactive'} as any,
          {sourceState: 'live'} as any,
          {sourceState: 'unknown'} as any,
        ],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.degradeMediaRequest(mediaRequest, '720p');

      expect(result).to.equal(H264_CODEC_PARAMETERS['720p'].maxFs * 2);
    });

    it('should return 0 when there are no live slots', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'h264', maxFs: 8192},
        receiveSlots: [
          {sourceState: 'inactive'} as any,
          {sourceState: 'unknown'} as any,
        ],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.degradeMediaRequest(mediaRequest, '720p');

      expect(result).to.equal(0);
    });
  });

  describe('getMaxPayloadBitsPerSecond', () => {
    it('should return 0 when codecInfo is not h264', () => {
      const mediaRequest = {
        codecInfo: {codec: 'av1' as const},
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker' as const, priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getMaxPayloadBitsPerSecond(mediaRequest);
      expect(result).to.equal(0);
    });

    it('should return 0 when codecInfo is undefined', () => {
      const mediaRequest = {
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker' as const, priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getMaxPayloadBitsPerSecond(mediaRequest);
      expect(result).to.equal(0);
    });

    it('should call getRecommendedMaxBitrateForFrameSize with maxFs', () => {
      const maxFs = 3600;
      const expectedBitrate = 5000000;
      getRecommendedMaxBitrateForFrameSizeStub.returns(expectedBitrate);

      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'h264', maxFs},
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getMaxPayloadBitsPerSecond(mediaRequest);

      expect(getRecommendedMaxBitrateForFrameSizeStub.calledOnceWith(maxFs)).to.be.true;
      expect(result).to.equal(expectedBitrate);
    });
  });

  describe('getWCMECodecInfos', () => {
    it('should return empty array when codecInfo is not h264', () => {
      const mediaRequest = {
        codecInfo: {codec: 'av1' as const},
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker' as const, priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getWCMECodecInfos(mediaRequest);
      expect(result).to.deep.equal([]);
    });

    it('should return empty array when codecInfo is undefined', () => {
      const mediaRequest = {
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker' as const, priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getWCMECodecInfos(mediaRequest);
      expect(result).to.deep.equal([]);
    });

    it('should return WcmeCodecInfo array with H264 codec info', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {
          codec: 'h264',
          maxFs: 3600,
          maxFps: 3000,
          maxMbps: 245760,
        },
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getWCMECodecInfos(mediaRequest);

      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.be.instanceOf(internalMediaCore.CodecInfo);
    });

    it('should use CODEC_DEFAULTS for missing optional parameters', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {
          codec: 'h264',
          maxFs: 1000,
        },
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getWCMECodecInfos(mediaRequest);

      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.be.instanceOf(internalMediaCore.CodecInfo);
    });

    it('should include maxWidth and maxHeight when provided', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {
          codec: 'h264',
          maxFs: 3600,
          maxWidth: 1280,
          maxHeight: 720,
        },
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getWCMECodecInfos(mediaRequest);

      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.be.instanceOf(internalMediaCore.CodecInfo);
    });
  });

  describe('getMaxFs', () => {
    it('should return correct maxFs for thumbnail pane size', () => {
      const result = helper.getMaxFs('thumbnail');
      expect(result).to.equal(H264_CODEC_PARAMETERS['90p'].maxFs);
    });

    it('should return correct maxFs for very small pane size', () => {
      const result = helper.getMaxFs('very small');
      expect(result).to.equal(H264_CODEC_PARAMETERS['180p'].maxFs);
    });

    it('should return correct maxFs for small pane size', () => {
      const result = helper.getMaxFs('small');
      expect(result).to.equal(H264_CODEC_PARAMETERS['360p'].maxFs);
    });

    it('should return correct maxFs for medium pane size', () => {
      const result = helper.getMaxFs('medium');
      expect(result).to.equal(H264_CODEC_PARAMETERS['720p'].maxFs);
    });

    it('should return correct maxFs for large pane size', () => {
      const result = helper.getMaxFs('large');
      expect(result).to.equal(H264_CODEC_PARAMETERS['1080p'].maxFs);
    });

    it('should return correct maxFs for best pane size', () => {
      const result = helper.getMaxFs('best');
      expect(result).to.equal(H264_CODEC_PARAMETERS['1080p'].maxFs);
    });

    it('should return medium maxFs for unsupported pane size', () => {
      const result = helper.getMaxFs('unsupported' as RemoteVideoResolution);
      expect(result).to.equal(H264_CODEC_PARAMETERS['720p'].maxFs);
    });
  });

  describe('getSizeHintMaxFs', () => {
    it('should return undefined when width is 0', () => {
      const result = helper.getSizeHintMaxFs(0, 720);
      expect(result).to.be.undefined;
    });

    it('should return undefined when height is 0', () => {
      const result = helper.getSizeHintMaxFs(1280, 0);
      expect(result).to.be.undefined;
    });

    it('should return undefined when both width and height are 0', () => {
      const result = helper.getSizeHintMaxFs(0, 0);
      expect(result).to.be.undefined;
    });

    it('should return 90p maxFs for height less than 99 (90 * 1.1)', () => {
      expect(helper.getSizeHintMaxFs(160, 89)).to.equal(H264_CODEC_PARAMETERS['90p'].maxFs);
      expect(helper.getSizeHintMaxFs(160, 90)).to.equal(H264_CODEC_PARAMETERS['90p'].maxFs);
      expect(helper.getSizeHintMaxFs(160, 98)).to.equal(H264_CODEC_PARAMETERS['90p'].maxFs);
    });

    it('should return 180p maxFs for height between 99 and 197 (180 * 1.1)', () => {
      expect(helper.getSizeHintMaxFs(320, 99)).to.equal(H264_CODEC_PARAMETERS['180p'].maxFs);
      expect(helper.getSizeHintMaxFs(320, 180)).to.equal(H264_CODEC_PARAMETERS['180p'].maxFs);
      expect(helper.getSizeHintMaxFs(320, 197)).to.equal(H264_CODEC_PARAMETERS['180p'].maxFs);
    });

    it('should return 360p maxFs for height between 198 and 395 (360 * 1.1)', () => {
      expect(helper.getSizeHintMaxFs(640, 198)).to.equal(H264_CODEC_PARAMETERS['360p'].maxFs);
      expect(helper.getSizeHintMaxFs(640, 360)).to.equal(H264_CODEC_PARAMETERS['360p'].maxFs);
      expect(helper.getSizeHintMaxFs(640, 395)).to.equal(H264_CODEC_PARAMETERS['360p'].maxFs);
    });

    it('should return 540p maxFs for height between 396 and 593 (540 * 1.1)', () => {
      expect(helper.getSizeHintMaxFs(960, 396)).to.equal(H264_CODEC_PARAMETERS['540p'].maxFs);
      expect(helper.getSizeHintMaxFs(960, 540)).to.equal(H264_CODEC_PARAMETERS['540p'].maxFs);
      expect(helper.getSizeHintMaxFs(960, 593)).to.equal(H264_CODEC_PARAMETERS['540p'].maxFs);
    });

    it('should return 720p maxFs for height between 594 and 720', () => {
      expect(helper.getSizeHintMaxFs(1280, 594)).to.equal(H264_CODEC_PARAMETERS['720p'].maxFs);
      expect(helper.getSizeHintMaxFs(1280, 719)).to.equal(H264_CODEC_PARAMETERS['720p'].maxFs);
    });

    it('should return 720p maxFs for height exactly 720', () => {
      expect(helper.getSizeHintMaxFs(1280, 720)).to.equal(H264_CODEC_PARAMETERS['720p'].maxFs);
    });

    it('should return 1080p maxFs for height greater than 720', () => {
      expect(helper.getSizeHintMaxFs(1920, 721)).to.equal(H264_CODEC_PARAMETERS['1080p'].maxFs);
      expect(helper.getSizeHintMaxFs(1920, 1080)).to.equal(H264_CODEC_PARAMETERS['1080p'].maxFs);
      expect(helper.getSizeHintMaxFs(3840, 2160)).to.equal(H264_CODEC_PARAMETERS['1080p'].maxFs);
    });
  });
});

