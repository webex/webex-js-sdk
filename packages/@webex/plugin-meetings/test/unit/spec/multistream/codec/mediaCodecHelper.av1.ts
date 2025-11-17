import 'jsdom-global/register';
import MediaCodecHelperAV1 from '@webex/plugin-meetings/src/multistream/codec/mediaCodecHelper.av1';
import {AV1_CODEC_PARAMETERS, CODEC_DEFAULTS} from '@webex/plugin-meetings/src/multistream/codec/constants';
import {MediaRequest, RemoteVideoResolution} from '@webex/plugin-meetings/src/multistream/types';
import {expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import * as internalMediaCore from '@webex/internal-media-core';

describe('MediaCodecHelper.AV1', () => {
  let helper: MediaCodecHelperAV1;
  let getRecommendedMaxBitrateForPicSizeStub: sinon.SinonStub;
  let getFrameSizeForPicSizeStub: sinon.SinonStub;

  beforeEach(() => {
    helper = new MediaCodecHelperAV1();
    getRecommendedMaxBitrateForPicSizeStub = sinon.stub(internalMediaCore, 'getRecommendedMaxBitrateForPicSize');
    getFrameSizeForPicSizeStub = sinon.stub(internalMediaCore, 'getFrameSizeForPicSize');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getCodecInfo', () => {
    it('should return undefined when getMaxPicSize is not provided', () => {
      const result = helper.getCodecInfo({});
      expect(result).to.be.undefined;
    });

    it('should return highest compatible AV1CodecInfo when maxPicSize is 147456 or less', () => {
      const maxPicSize = 147_456;
      const result = helper.getCodecInfo({getMaxPicSize: () => maxPicSize});

      // getParameters returns the highest parameters that can handle the given maxPicSize
      expect(result).to.deep.include({
        codec: 'av1',
        maxPicSize: AV1_CODEC_PARAMETERS['1080p'].maxPicSize,
        levelIdx: AV1_CODEC_PARAMETERS['1080p'].levelIdx,
      });
    });

    it('should return highest compatible AV1CodecInfo when maxPicSize is 278784', () => {
      const maxPicSize = 278_784;
      const result = helper.getCodecInfo({getMaxPicSize: () => maxPicSize});

      expect(result).to.deep.include({
        codec: 'av1',
        maxPicSize: AV1_CODEC_PARAMETERS['1080p'].maxPicSize,
        levelIdx: AV1_CODEC_PARAMETERS['1080p'].levelIdx,
      });
    });

    it('should return highest compatible AV1CodecInfo when maxPicSize is 1065024', () => {
      const maxPicSize = 1_065_024;
      const result = helper.getCodecInfo({getMaxPicSize: () => maxPicSize});

      expect(result).to.deep.include({
        codec: 'av1',
        maxPicSize: AV1_CODEC_PARAMETERS['1080p'].maxPicSize,
        levelIdx: AV1_CODEC_PARAMETERS['1080p'].levelIdx,
      });
    });

    it('should return highest compatible AV1CodecInfo when maxPicSize is exactly 1080p', () => {
      const maxPicSize = 2_359_296;
      const result = helper.getCodecInfo({getMaxPicSize: () => maxPicSize});

      expect(result).to.deep.include({
        codec: 'av1',
        maxPicSize: AV1_CODEC_PARAMETERS['1080p'].maxPicSize,
        levelIdx: AV1_CODEC_PARAMETERS['1080p'].levelIdx,
      });
    });

    it('should return the highest compatible parameters that can handle the given maxPicSize', () => {
      // maxPicSize that is less than 360p but more than 180p
      const maxPicSize = 200_000;
      const result = helper.getCodecInfo({getMaxPicSize: () => maxPicSize});

      // Should get 1080p parameters since getParameters returns the highest compatible level
      expect(result).to.deep.include({
        codec: 'av1',
        maxPicSize: AV1_CODEC_PARAMETERS['1080p'].maxPicSize,
      });
    });

    it('should call getMaxPicSize function to get the value', () => {
      const getMaxPicSize = sinon.stub().returns(1_065_024);
      helper.getCodecInfo({getMaxPicSize});

      expect(getMaxPicSize.calledOnce).to.be.true;
    });
  });

  describe('degradeMediaRequest', () => {
    it('should return 0 when codecInfo is not av1', () => {
      const mediaRequest = {
        codecInfo: {codec: 'h264' as const},
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

    it('should update maxPicSize to the minimum of preferredMaxPicSize, current maxPicSize, and resolution maxPicSize', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'av1', maxPicSize: 2_359_296},
        preferredMaxPicSize: 1_500_000,
        receiveSlots: [{sourceState: 'live'} as any],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      getFrameSizeForPicSizeStub.returns(1000);
      helper.degradeMediaRequest(mediaRequest, '720p');

      expect(mediaRequest.codecInfo.maxPicSize).to.equal(AV1_CODEC_PARAMETERS['720p'].maxPicSize);
    });

    it('should use CODEC_DEFAULTS when preferredMaxPicSize is not provided', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'av1', maxPicSize: 3_000_000},
        receiveSlots: [{sourceState: 'live'} as any],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      getFrameSizeForPicSizeStub.returns(1000);
      helper.degradeMediaRequest(mediaRequest, '360p');

      // Should be limited by resolution parameter since current maxPicSize is higher
      expect(mediaRequest.codecInfo.maxPicSize).to.equal(AV1_CODEC_PARAMETERS['360p'].maxPicSize);
    });

    it('should use CODEC_DEFAULTS when current maxPicSize is not provided', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'av1'},
        receiveSlots: [{sourceState: 'live'} as any],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      getFrameSizeForPicSizeStub.returns(1000);
      helper.degradeMediaRequest(mediaRequest, '720p');

      expect(mediaRequest.codecInfo.maxPicSize).to.equal(AV1_CODEC_PARAMETERS['720p'].maxPicSize);
    });

    it('should return total frame size as getFrameSizeForPicSize(maxPicSize) * number of live slots', () => {
      const frameSize = 3600;
      getFrameSizeForPicSizeStub.returns(frameSize);

      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'av1', maxPicSize: 1_065_024},
        receiveSlots: [
          {sourceState: 'live'} as any,
          {sourceState: 'live'} as any,
          {sourceState: 'live'} as any,
        ],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.degradeMediaRequest(mediaRequest, '720p');

      expect(getFrameSizeForPicSizeStub.calledOnce).to.be.true;
      expect(result).to.equal(frameSize * 3);
    });

    it('should only count slots with "live" sourceState', () => {
      const frameSize = 3600;
      getFrameSizeForPicSizeStub.returns(frameSize);

      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'av1', maxPicSize: 1_065_024},
        receiveSlots: [
          {sourceState: 'live'} as any,
          {sourceState: 'inactive'} as any,
          {sourceState: 'live'} as any,
          {sourceState: 'unknown'} as any,
        ],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.degradeMediaRequest(mediaRequest, '720p');

      expect(result).to.equal(frameSize * 2);
    });

    it('should return 0 when there are no live slots', () => {
      const frameSize = 3600;
      getFrameSizeForPicSizeStub.returns(frameSize);

      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'av1', maxPicSize: 1_065_024},
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
    it('should return 0 when codecInfo is not av1', () => {
      const mediaRequest = {
        codecInfo: {codec: 'h264' as const},
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

    it('should call getRecommendedMaxBitrateForPicSize with maxPicSize', () => {
      const maxPicSize = 1_065_024;
      const expectedBitrate = 8000000;
      getRecommendedMaxBitrateForPicSizeStub.returns(expectedBitrate);

      const mediaRequest: MediaRequest = {
        codecInfo: {codec: 'av1', maxPicSize},
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getMaxPayloadBitsPerSecond(mediaRequest);

      expect(getRecommendedMaxBitrateForPicSizeStub.calledOnceWith(maxPicSize)).to.be.true;
      expect(result).to.equal(expectedBitrate);
    });
  });

  describe('getWCMECodecInfos', () => {
    it('should return empty array when codecInfo is not av1', () => {
      const mediaRequest = {
        codecInfo: {codec: 'h264' as const},
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

    it('should return WcmeCodecInfo array with AV1 codec info', () => {
      const mediaRequest: MediaRequest = {
        codecInfo: {
          codec: 'av1',
          levelIdx: 5,
          tier: 0,
          maxWidth: 5504,
          maxHeight: 3096,
          maxPicSize: 1_065_024,
          maxDecodeRate: 39_938_400,
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
          codec: 'av1',
          maxPicSize: 1_000_000,
        },
        receiveSlots: [],
        policyInfo: {policy: 'active-speaker', priority: 255, crossPriorityDuplication: false, crossPolicyDuplication: false, preferLiveVideo: false},
      };

      const result = helper.getWCMECodecInfos(mediaRequest);

      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.be.instanceOf(internalMediaCore.CodecInfo);
    });
  });

  describe('getMaxPicSize', () => {
    it('should return correct maxPicSize for thumbnail pane size', () => {
      const result = helper.getMaxPicSize('thumbnail');
      expect(result).to.equal(AV1_CODEC_PARAMETERS['90p'].maxPicSize);
    });

    it('should return correct maxPicSize for very small pane size', () => {
      const result = helper.getMaxPicSize('very small');
      expect(result).to.equal(AV1_CODEC_PARAMETERS['180p'].maxPicSize);
    });

    it('should return correct maxPicSize for small pane size', () => {
      const result = helper.getMaxPicSize('small');
      expect(result).to.equal(AV1_CODEC_PARAMETERS['360p'].maxPicSize);
    });

    it('should return correct maxPicSize for medium pane size', () => {
      const result = helper.getMaxPicSize('medium');
      expect(result).to.equal(AV1_CODEC_PARAMETERS['720p'].maxPicSize);
    });

    it('should return correct maxPicSize for large pane size', () => {
      const result = helper.getMaxPicSize('large');
      expect(result).to.equal(AV1_CODEC_PARAMETERS['1080p'].maxPicSize);
    });

    it('should return correct maxPicSize for best pane size', () => {
      const result = helper.getMaxPicSize('best');
      expect(result).to.equal(AV1_CODEC_PARAMETERS['1080p'].maxPicSize);
    });

    it('should return medium maxPicSize for unsupported pane size', () => {
      const result = helper.getMaxPicSize('unsupported' as RemoteVideoResolution);
      expect(result).to.equal(AV1_CODEC_PARAMETERS['720p'].maxPicSize);
    });
  });

  describe('getSizeHintMaxPicSize', () => {
    it('should return undefined when width is 0', () => {
      const result = helper.getSizeHintMaxPicSize(0, 720);
      expect(result).to.be.undefined;
    });

    it('should return undefined when height is 0', () => {
      const result = helper.getSizeHintMaxPicSize(1280, 0);
      expect(result).to.be.undefined;
    });

    it('should return undefined when both width and height are 0', () => {
      const result = helper.getSizeHintMaxPicSize(0, 0);
      expect(result).to.be.undefined;
    });

    it('should return 90p maxPicSize for height less than 99 (90 * 1.1)', () => {
      expect(helper.getSizeHintMaxPicSize(160, 89)).to.equal(AV1_CODEC_PARAMETERS['90p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(160, 90)).to.equal(AV1_CODEC_PARAMETERS['90p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(160, 98)).to.equal(AV1_CODEC_PARAMETERS['90p'].maxPicSize);
    });

    it('should return 180p maxPicSize for height between 99 and 197 (180 * 1.1)', () => {
      expect(helper.getSizeHintMaxPicSize(320, 99)).to.equal(AV1_CODEC_PARAMETERS['180p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(320, 180)).to.equal(AV1_CODEC_PARAMETERS['180p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(320, 197)).to.equal(AV1_CODEC_PARAMETERS['180p'].maxPicSize);
    });

    it('should return 360p maxPicSize for height between 198 and 395 (360 * 1.1)', () => {
      expect(helper.getSizeHintMaxPicSize(640, 198)).to.equal(AV1_CODEC_PARAMETERS['360p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(640, 360)).to.equal(AV1_CODEC_PARAMETERS['360p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(640, 395)).to.equal(AV1_CODEC_PARAMETERS['360p'].maxPicSize);
    });

    it('should return 540p maxPicSize for height between 396 and 593 (540 * 1.1)', () => {
      expect(helper.getSizeHintMaxPicSize(960, 396)).to.equal(AV1_CODEC_PARAMETERS['540p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(960, 540)).to.equal(AV1_CODEC_PARAMETERS['540p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(960, 593)).to.equal(AV1_CODEC_PARAMETERS['540p'].maxPicSize);
    });

    it('should return 720p maxPicSize for height between 594 and 720', () => {
      expect(helper.getSizeHintMaxPicSize(1280, 594)).to.equal(AV1_CODEC_PARAMETERS['720p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(1280, 719)).to.equal(AV1_CODEC_PARAMETERS['720p'].maxPicSize);
    });

    it('should return 720p maxPicSize for height exactly 720', () => {
      expect(helper.getSizeHintMaxPicSize(1280, 720)).to.equal(AV1_CODEC_PARAMETERS['720p'].maxPicSize);
    });

    it('should return 1080p maxPicSize for height greater than 720', () => {
      expect(helper.getSizeHintMaxPicSize(1920, 721)).to.equal(AV1_CODEC_PARAMETERS['1080p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(1920, 1080)).to.equal(AV1_CODEC_PARAMETERS['1080p'].maxPicSize);
      expect(helper.getSizeHintMaxPicSize(3840, 2160)).to.equal(AV1_CODEC_PARAMETERS['1080p'].maxPicSize);
    });
  });
});

