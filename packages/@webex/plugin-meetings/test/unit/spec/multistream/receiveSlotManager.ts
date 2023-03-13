import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {MediaType} from '@webex/internal-media-core';
import {ReceiveSlot} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import {ReceiveSlotManager} from '@webex/plugin-meetings/src/multistream/receiveSlotManager';
import * as ReceiveSlotModule from '@webex/plugin-meetings/src/multistream/receiveSlot';

describe('ReceiveSlotManager', () => {
  let fakeWcmeSlot;
  let fakeReceiveSlots;
  let mockReceiveSlotCtor;
  let receiveSlotManager;
  let createSlotCallbackStub;
  let findMemberIdCallbackStub;

  beforeEach(() => {
    fakeWcmeSlot = {
      id: 'fake wcme slot',
    };
    fakeReceiveSlots = [];
    mockReceiveSlotCtor = sinon.stub(ReceiveSlotModule, 'ReceiveSlot').callsFake((mediaType) => {
      const fakeReceiveSlot = {
        id: `fake sdk receive slot ${fakeReceiveSlots.length + 1}`,
        mediaType,
        findMemberId: sinon.stub(),
      };

      fakeReceiveSlots.push(fakeReceiveSlot);

      return fakeReceiveSlot;
    });

    createSlotCallbackStub = sinon.stub().resolves(fakeWcmeSlot);
    findMemberIdCallbackStub = sinon.stub();

    receiveSlotManager = new ReceiveSlotManager(createSlotCallbackStub, findMemberIdCallbackStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('rejects if there is no media connection', async () => {
    createSlotCallbackStub.rejects(new Error('Webrtc media connection is missing'));

    assert.isRejected(
      receiveSlotManager.allocateSlot(MediaType.VideoMain),
      'Webrtc media connection is missing'
    );
  });

  it('allocates a slot when allocateSlot() is called and there are no free slots', async () => {
    assert.deepEqual(receiveSlotManager.getStats(), {numAllocatedSlots: {}, numFreeSlots: {}});

    const slot = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.calledOnce(createSlotCallbackStub);
    assert.calledWith(
      createSlotCallbackStub,
      MediaType.VideoMain
    );

    assert.calledOnce(mockReceiveSlotCtor);
    assert.calledWith(mockReceiveSlotCtor, MediaType.VideoMain, fakeWcmeSlot, findMemberIdCallbackStub);
    assert.strictEqual(slot, fakeReceiveSlots[0]);

    assert.deepEqual(receiveSlotManager.getStats(), {
      numAllocatedSlots: {'VIDEO-MAIN': 1},
      numFreeSlots: {},
    });
  });

  it('reuses previously freed slot when allocateSlot() is called and a free slot is available', async () => {
    const slot1 = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.calledOnce(createSlotCallbackStub);
    assert.calledOnce(mockReceiveSlotCtor);
    assert.strictEqual(slot1, fakeReceiveSlots[0]);

    // release the allocated slot
    receiveSlotManager.releaseSlot(slot1);

    assert.deepEqual(receiveSlotManager.getStats(), {
      numAllocatedSlots: {},
      numFreeSlots: {'VIDEO-MAIN': 1},
    });

    createSlotCallbackStub.resetHistory();
    mockReceiveSlotCtor.resetHistory();

    // allocate another slot, this time the previous one should be returned instead of allocating any new ones
    const slot2 = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.notCalled(createSlotCallbackStub);
    assert.notCalled(mockReceiveSlotCtor);

    // verify that in fact we got the same slot again
    assert.strictEqual(slot1, slot2);

    assert.deepEqual(receiveSlotManager.getStats(), {
      numAllocatedSlots: {'VIDEO-MAIN': 1},
      numFreeSlots: {},
    });
  });

  it('does not reuse any slots after reset() is called', async () => {
    const slot1 = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.calledOnce(createSlotCallbackStub);
    assert.calledOnce(mockReceiveSlotCtor);
    assert.strictEqual(slot1, fakeReceiveSlots[0]);

    // release the slot so we have 1 free slot, but also call reset() which should clear everything
    receiveSlotManager.releaseSlot(slot1);
    receiveSlotManager.reset();

    // reset the mocks and set the ReceiveSlot constructor to return a different slot
    createSlotCallbackStub.resetHistory();
    mockReceiveSlotCtor.resetHistory();

    assert.deepEqual(receiveSlotManager.getStats(), {numAllocatedSlots: {}, numFreeSlots: {}});

    // allocate another slot, because we called reset(), the old free slot should not be reused
    const slot2 = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.calledOnce(createSlotCallbackStub);
    assert.calledOnce(mockReceiveSlotCtor);

    // verify that in fact we got a brand new slot
    assert.strictEqual(slot2, fakeReceiveSlots[1]);

    assert.deepEqual(receiveSlotManager.getStats(), {
      numAllocatedSlots: {'VIDEO-MAIN': 1},
      numFreeSlots: {},
    });
  });

  it('does not reuse slots if they have different media type', async () => {
    const slot1 = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.calledOnce(createSlotCallbackStub);
    assert.calledOnce(mockReceiveSlotCtor);

    receiveSlotManager.releaseSlot(slot1);

    createSlotCallbackStub.resetHistory();
    mockReceiveSlotCtor.resetHistory();

    // allocate another slot, this time for main audio, so it should be a completely new slot
    const slot2 = await receiveSlotManager.allocateSlot(MediaType.AudioMain);

    assert.calledOnce(createSlotCallbackStub);
    assert.calledWith(
      createSlotCallbackStub,
      MediaType.AudioMain
    );

    assert.calledOnce(mockReceiveSlotCtor);
    assert.calledWith(mockReceiveSlotCtor, MediaType.AudioMain, fakeWcmeSlot, findMemberIdCallbackStub);

    // verify that in fact we got a brand new slot
    assert.strictEqual(slot2, fakeReceiveSlots[1]);

    assert.deepEqual(receiveSlotManager.getStats(), {
      numAllocatedSlots: {'AUDIO-MAIN': 1},
      numFreeSlots: {'VIDEO-MAIN': 1},
    });
  });

  describe('updateMemberIds', () => {

    it('calls findMemberId() on all allocated receive slots', async () => {
      const audioSlots: ReceiveSlot[] = [];
      const videoSlots: ReceiveSlot[] = [];

      // allocate a bunch of receive slots
      audioSlots.push(await receiveSlotManager.allocateSlot(MediaType.AudioMain));
      audioSlots.push(await receiveSlotManager.allocateSlot(MediaType.AudioMain));
      videoSlots.push(await receiveSlotManager.allocateSlot(MediaType.VideoMain));
      videoSlots.push(await receiveSlotManager.allocateSlot(MediaType.VideoMain));
      videoSlots.push(await receiveSlotManager.allocateSlot(MediaType.VideoMain));

      receiveSlotManager.updateMemberIds();

      assert.strictEqual(audioSlots.length, 2);
      assert.strictEqual(videoSlots.length, 3);

      assert.strictEqual(fakeReceiveSlots.length, audioSlots.length + videoSlots.length);

      fakeReceiveSlots.forEach(slot => {
        assert.calledOnce(slot.findMemberId);
      });
    });
  });
});
