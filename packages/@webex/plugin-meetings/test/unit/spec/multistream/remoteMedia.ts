/* eslint-disable require-jsdoc */
import EventEmitter from 'events';

import {MediaConnection as MC} from '@webex/internal-media-core';
import {RemoteMedia, RemoteMediaEvents} from '@webex/plugin-meetings/src/multistream/remoteMedia';
import {ReceiveSlotEvents} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

describe('RemoteMedia', () => {
  let remoteMedia;
  let fakeReceiveSlot;
  let fakeStream;
  let fakeMediaRequestManager;


  beforeEach(() => {
    fakeStream = {id: 'fake stream'};
    fakeReceiveSlot = new EventEmitter();
    fakeReceiveSlot.mediaType = MC.MediaType.AudioMain;
    fakeReceiveSlot.memberId = '12345678';
    fakeReceiveSlot.csi = 999;
    fakeReceiveSlot.mediaState = 'stopped';
    fakeReceiveSlot.sourceState = 'avatar';
    fakeReceiveSlot.stream = fakeStream;

    fakeMediaRequestManager = {
      addRequest: sinon.stub(),
      cancelRequest: sinon.stub(),
    };
    remoteMedia = new RemoteMedia(fakeReceiveSlot, fakeMediaRequestManager, {resolution: 'medium'});
  });

  describe('forwards events from the underlying receive slot', () => {
    [
      {receiveSlotEvent: ReceiveSlotEvents.MediaStarted, expectedEvent: RemoteMediaEvents.MediaStarted, title: 'MediaStarted'},
      {receiveSlotEvent: ReceiveSlotEvents.MediaStopped, expectedEvent: RemoteMediaEvents.MediaStopped, title: 'MediaStopped'},
      {receiveSlotEvent: ReceiveSlotEvents.SourceUpdate, expectedEvent: RemoteMediaEvents.SourceUpdate, title: 'SourceUpdate'},
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
      }));
  });

  it('exposes underlying receive slot\'s properties', () => {
    assert.strictEqual(remoteMedia.mediaType, fakeReceiveSlot.mediaType);
    assert.strictEqual(remoteMedia.memberId, fakeReceiveSlot.memberId);
    assert.strictEqual(remoteMedia.csi, fakeReceiveSlot.csi);
    assert.strictEqual(remoteMedia.mediaState, fakeReceiveSlot.mediaState);
    assert.strictEqual(remoteMedia.sourceState, fakeReceiveSlot.sourceState);
    assert.strictEqual(remoteMedia.stream, fakeReceiveSlot.stream);
  });

  describe('checkMediaAlreadyStarted()', () => {
    it('emits MediaStarted event if media is already running', () => {
      let mediaStartedEmittedCount = 0;
      let lastEventData;

      remoteMedia.on(RemoteMediaEvents.MediaStarted, (data) => {
        mediaStartedEmittedCount += 1;
        lastEventData = data;
      });

      fakeReceiveSlot.mediaState = 'started';

      remoteMedia.checkMediaAlreadyStarted();

      assert.strictEqual(mediaStartedEmittedCount, 1);
      assert.deepEqual(lastEventData, {stream: fakeStream});
    });

    it('does not do anything if media is not running', () => {
      let mediaStartedEmittedCount = 0;

      assert.strictEqual(remoteMedia.mediaState, 'stopped'); // just a sanity check

      remoteMedia.on(RemoteMediaEvents.MediaStarted, () => {
        mediaStartedEmittedCount += 1;
      });

      remoteMedia.checkMediaAlreadyStarted();

      assert.strictEqual(mediaStartedEmittedCount, 0);
    });
  });

  describe('sendMediaRequest', () => {
    it('sends correct media request', () => {
      const csi = 987654321;
      const csi2 = 12345;

      remoteMedia.sendMediaRequest(csi, true);

      assert.calledOnce(fakeMediaRequestManager.addRequest);
      assert.calledWith(fakeMediaRequestManager.addRequest, sinon.match({
        policyInfo: sinon.match({
          policy: 'receiver-selected',
          csi,
        }),
        receiveSlots: [fakeReceiveSlot],
        codecInfo: sinon.match({
          codec: 'h264',
          maxFs: 3600,
        })
      }), true);

      fakeMediaRequestManager.addRequest.resetHistory();

      // now call again, with different csi and commit=false
      remoteMedia.sendMediaRequest(csi2, false);

      assert.calledOnce(fakeMediaRequestManager.addRequest);
      assert.calledWith(fakeMediaRequestManager.addRequest, sinon.match({
        policyInfo: sinon.match({
          policy: 'receiver-selected',
          csi: csi2,
        }),
        receiveSlots: [fakeReceiveSlot],
        codecInfo: sinon.match({
          codec: 'h264',
          maxFs: 3600,
        })
      }), false);
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
      assert.calledWith(fakeMediaRequestManager.addRequest, sinon.match({
        policyInfo: sinon.match({
          policy: 'receiver-selected',
          csi: 5678,
        }),
        receiveSlots: [fakeReceiveSlot],
        codecInfo: sinon.match({
          codec: 'h264',
          maxFs: 3600,
        })
      }), false);
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

      remoteMedia.stop(true);

      assert.calledOnce(cancelMediaRequestSpy);
      assert.calledWith(cancelMediaRequestSpy, true);

      assert.strictEqual(remoteMedia.mediaType, undefined);
      assert.strictEqual(remoteMedia.memberId, undefined);
      assert.strictEqual(remoteMedia.csi, undefined);
      assert.strictEqual(remoteMedia.mediaState, undefined);
      assert.strictEqual(remoteMedia.sourceState, undefined);
      assert.strictEqual(remoteMedia.stream, undefined);

      // check that events emitted from receive slot don't get forwarded anymore
      [
        {receiveSlotEvent: ReceiveSlotEvents.MediaStarted, remoteMediaEvent: RemoteMediaEvents.MediaStarted},
        {receiveSlotEvent: ReceiveSlotEvents.MediaStopped, remoteMediaEvent: RemoteMediaEvents.MediaStopped},
        {receiveSlotEvent: ReceiveSlotEvents.SourceUpdate, remoteMediaEvent: RemoteMediaEvents.SourceUpdate},
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
});
