import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {
  getFrameSizeFromPicSize,
  getPicSizeFromFrameSize,
  getCodecInfo,
} from '@webex/plugin-meetings/src/multistream/utils';

describe('multistream utils', () => {
  describe('getFrameSizeFromPicSize', () => {
    it('should convert pic size to frame size by dividing by 256 and rounding', () => {
      assert.equal(getFrameSizeFromPicSize(256), 1);
      assert.equal(getFrameSizeFromPicSize(512), 2);
      assert.equal(getFrameSizeFromPicSize(1024), 4);
    });

    it('should round the result', () => {
      assert.equal(getFrameSizeFromPicSize(300), 1); // 300/256 = 1.171875, rounded to 1
      assert.equal(getFrameSizeFromPicSize(400), 2); // 400/256 = 1.5625, rounded to 2
      assert.equal(getFrameSizeFromPicSize(500), 2); // 500/256 = 1.953125, rounded to 2
    });

    it('should handle zero', () => {
      assert.equal(getFrameSizeFromPicSize(0), 0);
    });

    it('should handle large values', () => {
      assert.equal(getFrameSizeFromPicSize(10000), 39); // 10000/256 = 39.0625, rounded to 39
      assert.equal(getFrameSizeFromPicSize(100000), 391); // 100000/256 = 390.625, rounded to 391
    });
  });

  describe('getPicSizeFromFrameSize', () => {
    it('should convert frame size to pic size by multiplying by 256', () => {
      assert.equal(getPicSizeFromFrameSize(1), 256);
      assert.equal(getPicSizeFromFrameSize(2), 512);
      assert.equal(getPicSizeFromFrameSize(4), 1024);
    });

    it('should handle zero', () => {
      assert.equal(getPicSizeFromFrameSize(0), 0);
    });

    it('should handle large values', () => {
      assert.equal(getPicSizeFromFrameSize(100), 25600);
      assert.equal(getPicSizeFromFrameSize(1000), 256000);
    });
  });

  describe('getCodecInfo', () => {
    let getEffectiveMaxFs: sinon.SinonStub;
    let getEffectiveMaxPicSize: sinon.SinonStub;

    beforeEach(() => {
      getEffectiveMaxFs = sinon.stub();
      getEffectiveMaxPicSize = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('when preferred codec is av1', () => {
      it('should return av1 codec info with maxPicSize when available', () => {
        getEffectiveMaxPicSize.returns(8160);

        const result = getCodecInfo('av1', getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.deepEqual(result, {
          codec: 'av1',
          maxPicSize: 8160,
        });
        assert.isTrue(getEffectiveMaxPicSize.calledOnce);
        assert.isFalse(getEffectiveMaxFs.called);
      });

      it('should return undefined when maxPicSize is not available', () => {
        getEffectiveMaxPicSize.returns(undefined);

        const result = getCodecInfo('av1', getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.isUndefined(result);
        assert.isTrue(getEffectiveMaxPicSize.calledOnce);
        assert.isFalse(getEffectiveMaxFs.called);
      });

      it('should return undefined when maxPicSize is 0', () => {
        getEffectiveMaxPicSize.returns(0);

        const result = getCodecInfo('av1', getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.isUndefined(result);
      });

      it('should handle different maxPicSize values', () => {
        const testValues = [256, 512, 1024, 2048, 8160];

        testValues.forEach((value) => {
          getEffectiveMaxPicSize.returns(value);
          const result = getCodecInfo('av1', getEffectiveMaxFs, getEffectiveMaxPicSize);

          assert.deepEqual(result, {
            codec: 'av1',
            maxPicSize: value,
          });
        });
      });
    });

    describe('when preferred codec is h264', () => {
      it('should return h264 codec info with maxFs when available', () => {
        getEffectiveMaxFs.returns(3600);

        const result = getCodecInfo('h264', getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.deepEqual(result, {
          codec: 'h264',
          maxFs: 3600,
        });
        assert.isTrue(getEffectiveMaxFs.calledOnce);
        assert.isFalse(getEffectiveMaxPicSize.called);
      });

      it('should return undefined when maxFs is not available', () => {
        getEffectiveMaxFs.returns(undefined);

        const result = getCodecInfo('h264', getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.isUndefined(result);
        assert.isTrue(getEffectiveMaxFs.calledOnce);
      });

      it('should return undefined when maxFs is 0', () => {
        getEffectiveMaxFs.returns(0);

        const result = getCodecInfo('h264', getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.isUndefined(result);
      });

      it('should handle different maxFs values', () => {
        const testValues = [100, 500, 1000, 3600, 8192];

        testValues.forEach((value) => {
          getEffectiveMaxFs.returns(value);
          const result = getCodecInfo('h264', getEffectiveMaxFs, getEffectiveMaxPicSize);

          assert.deepEqual(result, {
            codec: 'h264',
            maxFs: value,
          });
        });
      });
    });

    describe('when preferred codec is undefined', () => {
      it('should default to h264 and return h264 codec info with maxFs when available', () => {
        getEffectiveMaxFs.returns(3600);

        const result = getCodecInfo(undefined, getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.deepEqual(result, {
          codec: 'h264',
          maxFs: 3600,
        });
        assert.isTrue(getEffectiveMaxFs.calledOnce);
        assert.isFalse(getEffectiveMaxPicSize.called);
      });

      it('should return undefined when maxFs is not available', () => {
        getEffectiveMaxFs.returns(undefined);

        const result = getCodecInfo(undefined, getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.isUndefined(result);
        assert.isTrue(getEffectiveMaxFs.calledOnce);
      });
    });

    describe('edge cases', () => {
      it('should not call getEffectiveMaxFs when codec is av1', () => {
        getEffectiveMaxPicSize.returns(8160);
        getEffectiveMaxFs.returns(3600);

        getCodecInfo('av1', getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.isFalse(getEffectiveMaxFs.called);
        assert.isTrue(getEffectiveMaxPicSize.calledOnce);
      });

      it('should not call getEffectiveMaxPicSize when codec is h264', () => {
        getEffectiveMaxFs.returns(3600);
        getEffectiveMaxPicSize.returns(8160);

        getCodecInfo('h264', getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.isTrue(getEffectiveMaxFs.calledOnce);
        assert.isFalse(getEffectiveMaxPicSize.called);
      });

      it('should not call getEffectiveMaxPicSize when codec is undefined', () => {
        getEffectiveMaxFs.returns(3600);
        getEffectiveMaxPicSize.returns(8160);

        getCodecInfo(undefined, getEffectiveMaxFs, getEffectiveMaxPicSize);

        assert.isTrue(getEffectiveMaxFs.calledOnce);
        assert.isFalse(getEffectiveMaxPicSize.called);
      });
    });
  });

  describe('round-trip conversion', () => {
    it('should convert from pic size to frame size and back', () => {
      const originalPicSize = 256;
      const frameSize = getFrameSizeFromPicSize(originalPicSize);
      const resultPicSize = getPicSizeFromFrameSize(frameSize);

      assert.equal(resultPicSize, originalPicSize);
    });

    it('should handle multiple values in round-trip conversion', () => {
      const testValues = [256, 512, 1024, 2048, 5120, 8192];

      testValues.forEach((picSize) => {
        const frameSize = getFrameSizeFromPicSize(picSize);
        const resultPicSize = getPicSizeFromFrameSize(frameSize);

        assert.equal(resultPicSize, picSize, `picSize: ${picSize}, frameSize: ${frameSize}, resultPicSize: ${resultPicSize}`);
      });
    });

    it('should lose precision when pic size is not a multiple of 256', () => {
      const originalPicSize = 300;
      const frameSize = getFrameSizeFromPicSize(originalPicSize); // rounds to 1
      const resultPicSize = getPicSizeFromFrameSize(frameSize); // 256

      assert.notEqual(resultPicSize, originalPicSize);
      assert.equal(resultPicSize, 256);
    });
  });
});

