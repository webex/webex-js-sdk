import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {MediaType} from '@webex/internal-media-core';
import {ReceiveSlotManager} from '@webex/plugin-meetings/src/multistream/receiveSlotManager';
import * as ReceiveSlotModule from '@webex/plugin-meetings/src/multistream/receiveSlot';

describe('ReceiveSlotManager', () => {
  let fakeMeeting;
  let fakeWcmeSlot;
  let fakeReceiveSlots;
  let mockReceiveSlotCtor;
  let receiveSlotManager;

  beforeEach(() => {
    fakeWcmeSlot = {
      id: 'fake wcme slot',
    };
    fakeMeeting = {
      mediaProperties: {
        webrtcMediaConnection: {
          createReceiveSlot: sinon.stub().resolves(fakeWcmeSlot),
        },
      },
      members: {
        findMemberByCsi: sinon.stub(),
      },
    };
    fakeReceiveSlots = [];
    mockReceiveSlotCtor = sinon.stub(ReceiveSlotModule, 'ReceiveSlot').callsFake((mediaType) => {
      const fakeReceiveSlot = {
        id: `fake sdk receive slot ${fakeReceiveSlots.length + 1}`,
        mediaType,
      };

      fakeReceiveSlots.push(fakeReceiveSlot);

      return fakeReceiveSlot;
    });

    receiveSlotManager = new ReceiveSlotManager(fakeMeeting);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('rejects if there is no media connection', async () => {
    fakeMeeting.mediaProperties.webrtcMediaConnection = null;

    assert.isRejected(
      receiveSlotManager.allocateSlot(MediaType.VideoMain),
      'Webrtc media connection is missing'
    );
  });

  it('allocates a slot when allocateSlot() is called and there are no free slots', async () => {
    assert.deepEqual(receiveSlotManager.getStats(), {numAllocatedSlots: {}, numFreeSlots: {}});

    const slot = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.calledOnce(fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot);
    assert.calledWith(
      fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot,
      MediaType.VideoMain
    );

    assert.calledOnce(mockReceiveSlotCtor);
    assert.calledWith(mockReceiveSlotCtor, MediaType.VideoMain, fakeWcmeSlot, sinon.match.func);
    assert.strictEqual(slot, fakeReceiveSlots[0]);

    assert.deepEqual(receiveSlotManager.getStats(), {
      numAllocatedSlots: {'VIDEO-MAIN': 1},
      numFreeSlots: {},
    });
  });

  it('reuses previously freed slot when allocateSlot() is called and a free slot is available', async () => {
    const slot1 = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.calledOnce(fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot);
    assert.calledOnce(mockReceiveSlotCtor);
    assert.strictEqual(slot1, fakeReceiveSlots[0]);

    // release the allocated slot
    receiveSlotManager.releaseSlot(slot1);

    assert.deepEqual(receiveSlotManager.getStats(), {
      numAllocatedSlots: {},
      numFreeSlots: {'VIDEO-MAIN': 1},
    });

    fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot.resetHistory();
    mockReceiveSlotCtor.resetHistory();

    // allocate another slot, this time the previous one should be returned instead of allocating any new ones
    const slot2 = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.notCalled(fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot);
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

    assert.calledOnce(fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot);
    assert.calledOnce(mockReceiveSlotCtor);
    assert.strictEqual(slot1, fakeReceiveSlots[0]);

    // release the slot so we have 1 free slot, but also call reset() which should clear everything
    receiveSlotManager.releaseSlot(slot1);
    receiveSlotManager.reset();

    // reset the mocks and set the ReceiveSlot constructor to return a different slot
    fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot.resetHistory();
    mockReceiveSlotCtor.resetHistory();

    assert.deepEqual(receiveSlotManager.getStats(), {numAllocatedSlots: {}, numFreeSlots: {}});

    // allocate another slot, because we called reset(), the old free slot should not be reused
    const slot2 = await receiveSlotManager.allocateSlot(MediaType.VideoMain);

    assert.calledOnce(fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot);
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

    assert.calledOnce(fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot);
    assert.calledOnce(mockReceiveSlotCtor);

    receiveSlotManager.releaseSlot(slot1);

    fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot.resetHistory();
    mockReceiveSlotCtor.resetHistory();

    // allocate another slot, this time for main audio, so it should be a completely new slot
    const slot2 = await receiveSlotManager.allocateSlot(MediaType.AudioMain);

    assert.calledOnce(fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot);
    assert.calledWith(
      fakeMeeting.mediaProperties.webrtcMediaConnection.createReceiveSlot,
      MediaType.AudioMain
    );

    assert.calledOnce(mockReceiveSlotCtor);
    assert.calledWith(mockReceiveSlotCtor, MediaType.AudioMain, fakeWcmeSlot, sinon.match.func);

    // verify that in fact we got a brand new slot
    assert.strictEqual(slot2, fakeReceiveSlots[1]);

    assert.deepEqual(receiveSlotManager.getStats(), {
      numAllocatedSlots: {'AUDIO-MAIN': 1},
      numFreeSlots: {'VIDEO-MAIN': 1},
    });
  });
});
