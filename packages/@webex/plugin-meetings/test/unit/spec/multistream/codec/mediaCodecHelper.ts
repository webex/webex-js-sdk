import 'jsdom-global/register';
import MediaCodecHelper from '@webex/plugin-meetings/src/multistream/codec/mediaCodecHelper';
import MediaCodecHelperH264 from '@webex/plugin-meetings/src/multistream/codec/mediaCodecHelper.h264';
import MediaCodecHelperAV1 from '@webex/plugin-meetings/src/multistream/codec/mediaCodecHelper.av1';
import {expect} from '@webex/test-helper-chai';

describe('MediaCodecHelper', () => {
  describe('get', () => {
    it('should return H264 helper when codec is "h264"', () => {
      const helper = MediaCodecHelper.get('h264');
      expect(helper).to.be.instanceOf(MediaCodecHelperH264);
    });

    it('should return AV1 helper when codec is "av1"', () => {
      const helper = MediaCodecHelper.get('av1');
      expect(helper).to.be.instanceOf(MediaCodecHelperAV1);
    });

    it('should return H264 helper when codec is undefined', () => {
      const helper = MediaCodecHelper.get(undefined);
      expect(helper).to.be.instanceOf(MediaCodecHelperH264);
    });

    it('should return H264 helper by default', () => {
      const helper = MediaCodecHelper.get();
      expect(helper).to.be.instanceOf(MediaCodecHelperH264);
    });
  });

  describe('instances', () => {
    it('should have H264 instance', () => {
      expect(MediaCodecHelper.H264).to.be.instanceOf(MediaCodecHelperH264);
    });

    it('should have AV1 instance', () => {
      expect(MediaCodecHelper.AV1).to.be.instanceOf(MediaCodecHelperAV1);
    });

    it('should always return the same H264 instance', () => {
      const helper1 = MediaCodecHelper.get('h264');
      const helper2 = MediaCodecHelper.get('h264');
      expect(helper1).to.equal(helper2);
      expect(helper1).to.equal(MediaCodecHelper.H264);
    });

    it('should always return the same AV1 instance', () => {
      const helper1 = MediaCodecHelper.get('av1');
      const helper2 = MediaCodecHelper.get('av1');
      expect(helper1).to.equal(helper2);
      expect(helper1).to.equal(MediaCodecHelper.AV1);
    });
  });
});

