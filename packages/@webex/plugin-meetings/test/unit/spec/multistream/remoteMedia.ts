/* eslint-disable require-jsdoc */
import 'jsdom-global/register';
import EventEmitter from 'events';

import {MediaType} from '@webex/internal-media-core';
import {RemoteMedia, RemoteMediaEvents} from '@webex/plugin-meetings/src/multistream/remoteMedia';
import {RemoteVideoResolution} from '@webex/plugin-meetings/src/multistream/types';
import {ReceiveSlotEvents} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import MediaCodecHelper from '@webex/plugin-meetings/src/multistream/codec/mediaCodecHelper';
import Metrics from '@webex/plugin-meetings/src/metrics';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {forEach} from 'lodash';

describe('RemoteMedia', () => {
  let remoteMedia;
  let fakeReceiveSlot;
  let fakeStream;
  let fakeMediaRequestManager;

  beforeEach(() => {
    fakeStream = {id: 'fake stream'};
    fakeReceiveSlot = new EventEmitter();
    fakeReceiveSlot.mediaType = MediaType.AudioMain;
    fakeReceiveSlot.memberId = '12345678';
    fakeReceiveSlot.csi = 999;
    fakeReceiveSlot.sourceState = 'avatar';
    fakeReceiveSlot.stream = fakeStream;
    fakeReceiveSlot.setMaxFs = sinon.stub();
    fakeReceiveSlot.setSizeHint = sinon.stub();

    fakeMediaRequestManager = {
      addRequest: sinon.stub(),
      cancelRequest: sinon.stub(),
    };
    remoteMedia = new RemoteMedia(fakeReceiveSlot, fakeMediaRequestManager, {resolution: 'medium'});
  });

  describe('forwards events from the underlying receive slot', () => {
    [
      {
        receiveSlotEvent: ReceiveSlotEvents.SourceUpdate,
        expectedEvent: RemoteMediaEvents.SourceUpdate,
        title: 'SourceUpdate',
      },
    ].forEach(({receiveSlotEvent, expectedEvent, title}) =>
      it(`forwards ${title}`, () => {
        let eventEmittedCount = 0;
        let eventData;
        const fakeData = {something: 'some value'};

        remoteMedia.on(expectedEvent, (data) => {
          eventEmittedCount += 1;
          eventData = data;
        });

        fakeReceiveSlot.emit(receiveSlotEvent, fakeData);

        assert.strictEqual(eventEmittedCount, 1);
        assert.strictEqual(eventData, fakeData);
      })
    );
  });

  it("exposes underlying receive slot's properties", () => {
    assert.strictEqual(remoteMedia.mediaType, fakeReceiveSlot.mediaType);
    assert.strictEqual(remoteMedia.memberId, fakeReceiveSlot.memberId);
    assert.strictEqual(remoteMedia.csi, fakeReceiveSlot.csi);
    assert.strictEqual(remoteMedia.sourceState, fakeReceiveSlot.sourceState);
    assert.strictEqual(remoteMedia.stream, fakeReceiveSlot.stream);
  });

  describe('sendMediaRequest', () => {
    it('sends correct media request', () => {
      const csi = 987654321;
      const csi2 = 12345;

      remoteMedia.sendMediaRequest(csi, true);

      assert.calledOnce(fakeMediaRequestManager.addRequest);
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi,
          }),
          receiveSlots: [fakeReceiveSlot],
          sizeHint: sinon.match({
            resolution: 'medium',
          }),
        }),
        true
      );

      fakeMediaRequestManager.addRequest.resetHistory();

      // now call again, with different csi and commit=false
      remoteMedia.sendMediaRequest(csi2, false);

      assert.calledOnce(fakeMediaRequestManager.addRequest);
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: csi2,
          }),
          receiveSlots: [fakeReceiveSlot],
          sizeHint: sinon.match({
            resolution: 'medium',
          }),
        }),
        false
      );
    });

    it('cancels previous request', () => {
      const fakeRequestId = 111;

      fakeMediaRequestManager.addRequest.returns(fakeRequestId);

      // send the 1st media request
      remoteMedia.sendMediaRequest(1234, true);

      fakeMediaRequestManager.addRequest.resetHistory();

      // send a 2nd one (the 1st one should get cancelled)
      remoteMedia.sendMediaRequest(5678, false);

      assert.calledOnce(fakeMediaRequestManager.cancelRequest);
      assert.calledWith(fakeMediaRequestManager.cancelRequest, fakeRequestId);

      assert.calledOnce(fakeMediaRequestManager.addRequest);
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: 5678,
          }),
          receiveSlots: [fakeReceiveSlot],
          sizeHint: sinon.match({
            resolution: 'medium',
          }),
        }),
        false
      );
    });

    it('includes updated size hint after setSizeHint is called', () => {
      remoteMedia.setSizeHint(640, 360);

      fakeMediaRequestManager.addRequest.resetHistory();

      remoteMedia.sendMediaRequest(1234, true);

      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          sizeHint: sinon.match({
            resolution: 'medium',
            width: 640,
            height: 360,
          }),
        }),
        true
      );
    });

    it('throws when called on a stopped RemoteMedia instance', () => {
      remoteMedia.stop();
      assert.throws(
        () => remoteMedia.sendMediaRequest(1234, true),
        'sendMediaRequest() called on an invalidated RemoteMedia instance'
      );
    });
  });

  describe('cancelMediaRequest', () => {
    it('cancels the media request', () => {
      const fakeRequestId = 11;

      fakeMediaRequestManager.addRequest.returns(fakeRequestId);

      // send a media request
      remoteMedia.sendMediaRequest(1234, true);

      fakeMediaRequestManager.addRequest.resetHistory();

      // cancel it
      remoteMedia.cancelMediaRequest();

      assert.calledOnce(fakeMediaRequestManager.cancelRequest);
      assert.calledWith(fakeMediaRequestManager.cancelRequest, fakeRequestId);

      assert.notCalled(fakeMediaRequestManager.addRequest);
    });
    it('does not do anything if there was no request sent', () => {
      remoteMedia.cancelMediaRequest();

      assert.notCalled(fakeMediaRequestManager.cancelRequest);
      assert.notCalled(fakeMediaRequestManager.addRequest);
    });
  });

  describe('stop()', () => {
    it('cancels media request, unsets the receive slot and removes all the listeners from it', () => {
      const cancelMediaRequestSpy = sinon.spy(remoteMedia, 'cancelMediaRequest');

      let stoppedListenerCalled = false;

      remoteMedia.on(RemoteMediaEvents.Stopped, () => {
        stoppedListenerCalled = true;
      });

      remoteMedia.stop(true);

      assert.isTrue(stoppedListenerCalled);

      assert.calledOnce(cancelMediaRequestSpy);
      assert.calledWith(cancelMediaRequestSpy, true);

      assert.strictEqual(remoteMedia.mediaType, undefined);
      assert.strictEqual(remoteMedia.memberId, undefined);
      assert.strictEqual(remoteMedia.csi, undefined);
      assert.strictEqual(remoteMedia.sourceState, undefined);
      assert.strictEqual(remoteMedia.stream, undefined);

      // check that events emitted from receive slot don't get forwarded anymore
      [
        {
          receiveSlotEvent: ReceiveSlotEvents.SourceUpdate,
          remoteMediaEvent: RemoteMediaEvents.SourceUpdate,
        },
      ].forEach(({receiveSlotEvent, remoteMediaEvent}) => {
        let eventEmitted = false;

        remoteMedia.on(remoteMediaEvent, () => {
          eventEmitted = true;
        });

        fakeReceiveSlot.emit(receiveSlotEvent);

        assert.strictEqual(eventEmitted, false);
      });
    });
  });

  describe('setSizeHint()', () => {
    it('works if the receive slot is undefined', () => {
      remoteMedia.receiveSlot = undefined;
      remoteMedia.setSizeHint(100, 100);
    });

    forEach(
      [
        {width: 0, height: 0},
        {width: 135, height: 0},
        {width: 0, height: 240},
      ],
      ({width, height}) => {
        it(`skips update when applied ${width}x${height}`, () => {
          remoteMedia.setSizeHint(width, height);

          assert.notCalled(fakeReceiveSlot.setSizeHint);
          assert.notCalled(fakeReceiveSlot.setMaxFs);
        });
      }
    );

    forEach(
      [90, 98, 99, 180, 197, 198, 360, 395, 396, 540, 610, 720, 721, 1080],
      (height) => {
        it(`forwards size hint to receive slot when height is ${height}`, () => {
          remoteMedia.setSizeHint(100, height);

          assert.calledOnceWithExactly(
            fakeReceiveSlot.setSizeHint,
            sinon.match({
              resolution: 'medium',
              width: 100,
              height,
            })
          );
        });
      }
    );

    it('also emits MaxFsUpdate on the receive slot for backward compatibility', () => {
      const emitSpy = sinon.spy(fakeReceiveSlot, 'emit');

      remoteMedia.setSizeHint(960, 540);

      const expectedMaxFs = MediaCodecHelper.H264.getSizeHintMaxFs({
        resolution: 'medium',
        width: 960,
        height: 540,
      });

      assert.calledWith(
        emitSpy,
        sinon.match({file: 'meeting/receiveSlot', function: 'setMaxFs'}),
        ReceiveSlotEvents.MaxFsUpdate,
        {maxFs: expectedMaxFs}
      );

      emitSpy.restore();
    });
  });

  describe('getSizeHint()', () => {
    it('returns initial size hint based on resolution option', () => {
      const hint = remoteMedia.getSizeHint();

      assert.deepEqual(hint, {resolution: 'medium'});
    });

    it('returns undefined resolution when no resolution option was provided', () => {
      const rmWithoutResolution = new RemoteMedia(fakeReceiveSlot, fakeMediaRequestManager);
      const hint = rmWithoutResolution.getSizeHint();

      assert.deepEqual(hint, {resolution: undefined});
    });

    it('includes width and height after setSizeHint is called', () => {
      remoteMedia.setSizeHint(640, 360);

      const hint = remoteMedia.getSizeHint();

      assert.deepEqual(hint, {resolution: 'medium', width: 640, height: 360});
    });

    it('is not affected by zero-dimension calls to setSizeHint', () => {
      remoteMedia.setSizeHint(0, 0);

      const hint = remoteMedia.getSizeHint();

      assert.deepEqual(hint, {resolution: 'medium'});
    });
  });

  describe('getEffectiveMaxFs() [deprecated]', () => {
    beforeEach(() => {
      sinon.stub(Metrics, 'sendBehavioralMetric');
    });

    afterEach(() => {
      Metrics.sendBehavioralMetric.restore();
    });

    it('sends deprecation metric when called', () => {
      remoteMedia.getEffectiveMaxFs();

      assert.calledWith(
        Metrics.sendBehavioralMetric,
        BEHAVIORAL_METRICS.DEPRECATED_GET_EFFECTIVE_MAX_FS_USED,
        {surface: 'RemoteMedia'}
      );
    });

    it('returns correct maxFs after setSizeHint is called', () => {
      remoteMedia.setSizeHint(960, 540);

      const result = remoteMedia.getEffectiveMaxFs();

      const expected = MediaCodecHelper.H264.getSizeHintMaxFs({
        width: 960,
        height: 540,
        resolution: 'medium',
      });

      assert.strictEqual(result, expected);
    });

    it('falls back to resolution option when no pixel dimensions are set', () => {
      remoteMedia.setSizeHint(0, 0);

      const result = remoteMedia.getEffectiveMaxFs();

      assert.strictEqual(result, MediaCodecHelper.H264.getMaxFs('medium'));
    });

    it('returns undefined when no resolution and no pixel dimensions', () => {
      const rmWithoutResolution = new RemoteMedia(fakeReceiveSlot, fakeMediaRequestManager);
      rmWithoutResolution.setSizeHint(0, 0);

      const result = rmWithoutResolution.getEffectiveMaxFs();

      assert.strictEqual(result, undefined);
    });

    it('uses pixel dimensions over resolution option when both are set', () => {
      remoteMedia.setSizeHint(640, 360);

      const result = remoteMedia.getEffectiveMaxFs();

      const expected = MediaCodecHelper.H264.getSizeHintMaxFs({
        width: 640,
        height: 360,
        resolution: 'medium',
      });

      assert.strictEqual(result, expected);
    });

    it('returns correct values for all resolution options', () => {
      const resolutions: RemoteVideoResolution[] = [
        'thumbnail', 'very small', 'small', 'medium', 'large', 'best',
      ];

      resolutions.forEach((resolution) => {
        const testRM = new RemoteMedia(fakeReceiveSlot, fakeMediaRequestManager, {resolution});
        testRM.setSizeHint(0, 0);

        const result = testRM.getEffectiveMaxFs();

        assert.strictEqual(
          result,
          MediaCodecHelper.H264.getMaxFs(resolution),
          `Failed for resolution: ${resolution}`
        );
      });
    });
  });
});
