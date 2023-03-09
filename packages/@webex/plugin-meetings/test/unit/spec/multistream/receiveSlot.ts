/* eslint-disable require-jsdoc */
import EventEmitter from 'events';

import {MediaType, ReceiveSlotEvents as WcmeReceiveSlotEvents} from '@webex/internal-media-core';
import {ReceiveSlot, ReceiveSlotEvents} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

class FakeWcmeSlot extends EventEmitter {
  public stream;

  constructor(stream) {
    super();
    this.stream = stream;
  }
}

describe('ReceiveSlot', () => {
  let receiveSlot;
  let fakeWcmeSlot;
  let findMemberIdCallbackStub;
  let fakeStream;

  beforeEach(() => {
    fakeStream = {id: 'fake stream'};
    fakeWcmeSlot = new FakeWcmeSlot(fakeStream);
    findMemberIdCallbackStub = sinon.stub();
    receiveSlot = new ReceiveSlot(MediaType.VideoMain, fakeWcmeSlot, findMemberIdCallbackStub);
  });

  describe('forwards events from underlying wcme receive slot', () => {
    it('forwards SourceUpdate', () => {
      let eventEmitted = false;
      let eventData;

      const csi = 10203040;
      const fakeMemberId = '12345678-1234-5678-9012-345678901234';

      findMemberIdCallbackStub.returns(fakeMemberId);

      receiveSlot.on(ReceiveSlotEvents.SourceUpdate, (data) => {
        eventEmitted = true;
        eventData = data;
      });

      fakeWcmeSlot.emit(WcmeReceiveSlotEvents.SourceUpdate, 'live', csi);

      assert.strictEqual(eventEmitted, true);
      assert.deepEqual(eventData, {
        state: 'live',
        csi,
        memberId: fakeMemberId,
      });
      assert.calledOnce(findMemberIdCallbackStub);
      assert.calledWith(findMemberIdCallbackStub, csi);
    });
  });

  it('has public properties', () => {
    assert.strictEqual(receiveSlot.id, 'r1');
    assert.strictEqual(receiveSlot.mediaType, MediaType.VideoMain);
  });

  it("exposes underlying wcme receive slot's properties", () => {
    assert.strictEqual(receiveSlot.stream, fakeStream);
    assert.strictEqual(receiveSlot.wcmeReceiveSlot, fakeWcmeSlot);
  });

  it("caches some underlying wcme receive slot's properties", () => {
    assert.strictEqual(receiveSlot.memberId, undefined);
    assert.strictEqual(receiveSlot.csi, undefined);
    assert.strictEqual(receiveSlot.sourceState, 'no source');

    const csi = 987654321;
    const fakeMemberId = '00000001-1234-5678-9012-345678901234';

    findMemberIdCallbackStub.returns(fakeMemberId);

    fakeWcmeSlot.emit(WcmeReceiveSlotEvents.SourceUpdate, 'live', csi);

    assert.strictEqual(receiveSlot.memberId, fakeMemberId);
    assert.strictEqual(receiveSlot.csi, csi);
    assert.strictEqual(receiveSlot.sourceState, 'live');
  });

  describe('findMemberId()', () => {
    it('doesn\'t do anything if csi is not set', () => {
      // by default the receiveSlot does not have any csi or member id
      receiveSlot.findMemberId();

      assert.notCalled(findMemberIdCallbackStub);
    });

    it('finds a member id if member id is undefined and CSI is known', () => {
      let emittedSourceUpdateEvent = null;

      // setup receiveSlot to have a csi without a member id
      const csi = 12345;
      const fakeMemberId = 'aaa-bbb-ccc-ddd';
      fakeWcmeSlot.emit(WcmeReceiveSlotEvents.SourceUpdate, 'live', csi);
      findMemberIdCallbackStub.reset();
      findMemberIdCallbackStub.returns(fakeMemberId);

      receiveSlot.on(ReceiveSlotEvents.SourceUpdate, (data) => {
        emittedSourceUpdateEvent = data;
      });

      receiveSlot.findMemberId();

      assert.calledOnce(findMemberIdCallbackStub);
      assert.calledWith(findMemberIdCallbackStub, csi);

      assert.deepEqual(emittedSourceUpdateEvent, {
        state: 'live',
        csi,
        memberId: fakeMemberId,
      });

    });

    it('doesn\'t do anything if member id already set', () => {
      // setup receiveSlot to have a csi and a member id
      const csi = 12345;
      const memberId = '12345678-1234-5678-9012-345678901234';

      findMemberIdCallbackStub.returns(memberId);

      fakeWcmeSlot.emit(WcmeReceiveSlotEvents.SourceUpdate, 'live', csi);
      findMemberIdCallbackStub.reset();

      receiveSlot.findMemberId();

      assert.notCalled(findMemberIdCallbackStub);
    });
  });

  describe('setMaxFs()', () => {
    it('emits the correct event', () => {
      sinon.stub(receiveSlot, 'emit');
      receiveSlot.setMaxFs(100);

      assert.calledOnceWithExactly(
        receiveSlot.emit,
        {
          file: 'meeting/receiveSlot',
          function: 'findMemberId',
        },
        ReceiveSlotEvents.MaxFsUpdate,
        {
          maxFs: 100,
        }
      );
    })
  });
});
