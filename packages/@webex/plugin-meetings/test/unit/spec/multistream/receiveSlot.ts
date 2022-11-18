/* eslint-disable require-jsdoc */
import EventEmitter from 'events';

import {MediaConnection as MC} from '@webex/internal-media-core';
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
    receiveSlot = new ReceiveSlot(MC.MediaType.VideoMain, fakeWcmeSlot, findMemberIdCallbackStub);
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

      fakeWcmeSlot.emit(MC.ReceiveSlotEvents.SourceUpdate, 'live', csi);

      assert.strictEqual(eventEmitted, true);
      assert.deepEqual(eventData, {
        state: 'live',
        csi,
        memberId: fakeMemberId
      });
      assert.calledOnce(findMemberIdCallbackStub);
      assert.calledWith(findMemberIdCallbackStub, csi);
    });
  });

  it('has public properties', () => {
    assert.strictEqual(receiveSlot.id, 'r1');
    assert.strictEqual(receiveSlot.mediaType, MC.MediaType.VideoMain);
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

    fakeWcmeSlot.emit(MC.ReceiveSlotEvents.SourceUpdate, 'live', csi);

    assert.strictEqual(receiveSlot.memberId, fakeMemberId);
    assert.strictEqual(receiveSlot.csi, csi);
    assert.strictEqual(receiveSlot.sourceState, 'live');
  });

  it('resets source related properties when resetSourceState() is called', () => {
    const csi = 123456;
    const fakeMemberId = '00000001-5555-6666-9012-345678901234';

    findMemberIdCallbackStub.returns(fakeMemberId);

    fakeWcmeSlot.emit(MC.ReceiveSlotEvents.SourceUpdate, 'live', csi);

    assert.strictEqual(receiveSlot.memberId, fakeMemberId);
    assert.strictEqual(receiveSlot.csi, csi);
    assert.strictEqual(receiveSlot.sourceState, 'live');

    receiveSlot.resetSourceState();

    assert.strictEqual(receiveSlot.memberId, undefined);
    assert.strictEqual(receiveSlot.csi, undefined);
    assert.strictEqual(receiveSlot.sourceState, 'no source');
  });
});
