import EventEmitter from 'events';

import {MediaType} from '@webex/internal-media-core';
import {RemoteMediaGroup} from '@webex/plugin-meetings/src/multistream/remoteMediaGroup';
import {RemoteMedia} from '@webex/plugin-meetings/src/multistream/remoteMedia';
import {ReceiveSlot} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

class FakeSlot extends EventEmitter {
  public mediaType: MediaType;

  public id: string;

  constructor(mediaType: MediaType, id: string) {
    super();
    this.mediaType = mediaType;
    this.id = id;
  }
}

describe('RemoteMediaGroup', () => {
  const NUM_SLOTS = 10;

  let fakeMediaRequestManager;
  let fakeReceiveSlots;

  let activeSpeakerRequestCounter;
  let receiverSelectedRequestCounter;

  beforeEach(() => {
    activeSpeakerRequestCounter = 0;
    receiverSelectedRequestCounter = 0;

    fakeMediaRequestManager = {
      addRequest: sinon.stub().callsFake((mediaRequest) => {
        if (mediaRequest.policyInfo.policy === 'active-speaker') {
          activeSpeakerRequestCounter += 1;

          return `fake active speaker request ${activeSpeakerRequestCounter}`;
        }
        receiverSelectedRequestCounter += 1;

        return `fake receiver selected request ${receiverSelectedRequestCounter}`;
      }),
      cancelRequest: sinon.stub(),
      commit: sinon.stub(),
    };

    fakeReceiveSlots = Array(NUM_SLOTS)
      .fill(null)
      .map((_, index) => new FakeSlot(MediaType.VideoMain, `fake receive slot ${index}`));
  });

  const getLastActiveSpeakerRequestId = () =>
    `fake active speaker request ${activeSpeakerRequestCounter}`;

  const resetHistory = () => {
    fakeMediaRequestManager.addRequest.resetHistory();
    fakeMediaRequestManager.cancelRequest.resetHistory();
    fakeMediaRequestManager.commit.resetHistory();
  };

  describe('constructor', () => {
    it('creates a list or RemoteMedia objects and sends the active speaker media request', () => {
      const group = new RemoteMediaGroup(fakeMediaRequestManager, fakeReceiveSlots, 211, true, {
        resolution: 'medium',
        preferLiveVideo: true,
      });

      assert.strictEqual(group.getRemoteMedia().length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('all').length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('unpinned').length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('pinned').length, 0);

      assert.strictEqual(
        group.getRemoteMedia('all').every((item) => item instanceof RemoteMedia),
        true
      );

      assert.calledOnce(fakeMediaRequestManager.addRequest);
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'active-speaker',
            priority: 211,
          }),
          receiveSlots: fakeReceiveSlots,
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        }),
        true
      );
    });
  });

  describe('pinning', () => {
    it('works as expected', () => {
      const PINNED_INDEX = 2;
      const PINNED_INDEX2 = 0;
      const CSI = 11111;
      const CSI2 = 12345;

      const group = new RemoteMediaGroup(fakeMediaRequestManager, fakeReceiveSlots, 255, true, {
        resolution: 'medium',
        preferLiveVideo: true,
      });

      // initially nothing should be pinned
      assert.strictEqual(group.getRemoteMedia().length, NUM_SLOTS); // by default should return 'all'
      assert.strictEqual(group.getRemoteMedia('all').length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('unpinned').length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('pinned').length, 0);

      // take one instance of remote media from the group
      const remoteMedia = group.getRemoteMedia('all')[PINNED_INDEX];

      resetHistory();

      // pin it
      group.pin(remoteMedia, CSI);

      assert.strictEqual(group.getRemoteMedia().length, NUM_SLOTS); // by default should return 'all'
      assert.strictEqual(group.getRemoteMedia('all').length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('unpinned').length, NUM_SLOTS - 1);
      assert.strictEqual(group.getRemoteMedia('pinned').length, 1);

      assert.strictEqual(group.isPinned(remoteMedia), true);

      // now check that correct media requests were sent...

      const expectedReceiverSelectedSlots = [fakeReceiveSlots[PINNED_INDEX]];
      const expectedActiveSpeakerReceiveSlots = fakeReceiveSlots.filter(
        (_, idx) => idx !== PINNED_INDEX
      );

      // the previous active speaker media request for the group should have been cancelled
      assert.calledOnce(fakeMediaRequestManager.cancelRequest);
      assert.calledWith(fakeMediaRequestManager.cancelRequest, 'fake active speaker request 1');
      // a new one should be sent for active speaker and for receiver selected
      assert.calledTwice(fakeMediaRequestManager.addRequest);
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'active-speaker',
            priority: 255,
          }),
          receiveSlots: expectedActiveSpeakerReceiveSlots,
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        })
      );
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: CSI,
          }),
          receiveSlots: expectedReceiverSelectedSlots,
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        })
      );

      resetHistory();

      // pin another video
      const remoteMedia2 = group.getRemoteMedia('all')[PINNED_INDEX2];

      group.pin(remoteMedia2, CSI2);

      assert.strictEqual(group.getRemoteMedia().length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('all').length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('unpinned').length, NUM_SLOTS - 2);
      assert.strictEqual(group.getRemoteMedia('pinned').length, 2);

      assert.strictEqual(group.isPinned(remoteMedia2), true);

      // now check that correct media requests were sent...
      const expectedReceiverSelectedSlots2 = [fakeReceiveSlots[PINNED_INDEX2]];
      const expectedActiveSpeakerReceiveSlots2 = fakeReceiveSlots.filter(
        (_, idx) => idx !== PINNED_INDEX && idx !== PINNED_INDEX2
      );

      // the previous active speaker media request for the group should have been cancelled
      assert.calledOnce(fakeMediaRequestManager.cancelRequest);
      assert.calledWith(fakeMediaRequestManager.cancelRequest, 'fake active speaker request 2');
      // a new one should be sent for active speaker and for receiver selected
      assert.calledTwice(fakeMediaRequestManager.addRequest);
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'active-speaker',
            priority: 255,
          }),
          receiveSlots: expectedActiveSpeakerReceiveSlots2,
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        })
      );
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: CSI2,
          }),
          receiveSlots: expectedReceiverSelectedSlots2,
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        })
      );

      resetHistory();

      // now unpin the video pane that was first pinned
      group.unpin(remoteMedia);

      // one pane should still remain pinned
      assert.strictEqual(group.getRemoteMedia().length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('all').length, NUM_SLOTS);
      assert.strictEqual(group.getRemoteMedia('unpinned').length, NUM_SLOTS - 1);
      assert.strictEqual(group.getRemoteMedia('pinned').length, 1);

      assert.strictEqual(group.isPinned(remoteMedia), false);

      // the previous requests for the group and the individual remote media should have been cancelled
      assert.calledTwice(fakeMediaRequestManager.cancelRequest);
      assert.calledWith(fakeMediaRequestManager.cancelRequest, 'fake active speaker request 3');
      assert.calledWith(fakeMediaRequestManager.cancelRequest, 'fake receiver selected request 1');

      // a new one should be sent for active speaker
      assert.calledOnce(fakeMediaRequestManager.addRequest);
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'active-speaker',
            priority: 255,
          }),
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        })
      );
      // checking that the receiveSlots array passed in to addRequest() has the right length without
      // being strict on the order of elements in it:
      const receiveSlotsArg = fakeMediaRequestManager.addRequest.getCall(0).args[0].receiveSlots;

      assert.strictEqual(receiveSlotsArg.length, fakeReceiveSlots.length - 1);
    });

    it('works as expected when pin() is called on already pinned RemoteMedia', () => {
      const PINNED_INDEX = 4;

      const group = new RemoteMediaGroup(fakeMediaRequestManager, fakeReceiveSlots, 255, true, {
        resolution: 'medium',
        preferLiveVideo: true,
      });

      // take one instance of remote media from the group
      const remoteMedia = group.getRemoteMedia('all')[PINNED_INDEX];

      resetHistory();

      // pin it
      group.pin(remoteMedia, 1234);

      resetHistory();
      // normally this would result in the underlying receive slot csi to be updated, because we're using fake
      // receive slots, we have to do that manually:
      fakeReceiveSlots[PINNED_INDEX].csi = 1234;

      // pin again to same CSI
      group.pin(remoteMedia, 1234);

      assert.notCalled(fakeMediaRequestManager.addRequest);
      assert.notCalled(fakeMediaRequestManager.cancelRequest);
      assert.notCalled(fakeMediaRequestManager.commit);

      // again, this time without even specifying the csi
      group.pin(remoteMedia);

      assert.notCalled(fakeMediaRequestManager.addRequest);
      assert.notCalled(fakeMediaRequestManager.cancelRequest);
      assert.notCalled(fakeMediaRequestManager.commit);

      // pin it again but to a different CSI
      group.pin(remoteMedia, 2345);

      // it should trigger a new receiver selected media request
      assert.calledOnce(fakeMediaRequestManager.addRequest);
      assert.calledWith(
        fakeMediaRequestManager.addRequest,
        sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: 2345,
          }),
          receiveSlots: [fakeReceiveSlots[PINNED_INDEX]],
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        })
      );
    });
  });

  describe('stop()', () => {
    it('stops all RemoteMedia in the group', () => {
      const group = new RemoteMediaGroup(fakeMediaRequestManager, fakeReceiveSlots, 255, true, {
        resolution: 'medium',
        preferLiveVideo: true,
      });
      const stopStubs: any[] = [];

      group.getRemoteMedia('all').forEach((remoteMedia) => {
        stopStubs.push(sinon.stub(remoteMedia, 'stop'));
      });

      // pin a few remote media instances
      group.pin(group.getRemoteMedia('unpinned')[2], 12345);
      group.pin(group.getRemoteMedia('unpinned')[1], 12345);
      group.pin(group.getRemoteMedia('unpinned')[0], 12345);

      assert.strictEqual(group.getRemoteMedia('unpinned').length, NUM_SLOTS - 3);
      assert.strictEqual(group.getRemoteMedia('pinned').length, 3);

      resetHistory();

      group.stop(true);

      // check that all remote media (including pinned ones) have been stopped
      stopStubs.forEach((stub) => {
        assert.calledOnce(stub);
        assert.calledWith(stub, false);
      });

      // and that we've cancelled the media request for this group
      assert.calledOnce(fakeMediaRequestManager.cancelRequest);
      assert.calledWith(fakeMediaRequestManager.cancelRequest, getLastActiveSpeakerRequestId());
      assert.calledOnce(fakeMediaRequestManager.commit);
    });
  });

  describe('includes()', () => {
    it('checks if a given RemoteMedia belongs to the group', () => {
      const group = new RemoteMediaGroup(fakeMediaRequestManager, fakeReceiveSlots, 255, true, {
        resolution: 'medium',
        preferLiveVideo: true,
      });

      const unpinnedRemoteMediaFromGroup = group.getRemoteMedia('all')[0];
      const otherRemoteMedia = new RemoteMedia(
        new FakeSlot(MediaType.VideoMain, 'other slot') as unknown as ReceiveSlot,
        fakeMediaRequestManager
      );

      group.pin(group.getRemoteMedia('all')[1], 12345);
      const pinnedRemoteMedia = group.getRemoteMedia('pinned')[0];

      // by default includes() uses 'all' filter
      assert.strictEqual(group.includes(unpinnedRemoteMediaFromGroup), true);
      assert.strictEqual(group.includes(otherRemoteMedia), false);
      assert.strictEqual(group.includes(pinnedRemoteMedia), true);

      assert.strictEqual(group.includes(unpinnedRemoteMediaFromGroup, 'all'), true);
      assert.strictEqual(group.includes(otherRemoteMedia, 'all'), false);
      assert.strictEqual(group.includes(pinnedRemoteMedia, 'all'), true);

      assert.strictEqual(group.includes(unpinnedRemoteMediaFromGroup, 'pinned'), false);
      assert.strictEqual(group.includes(otherRemoteMedia, 'pinned'), false);
      assert.strictEqual(group.includes(pinnedRemoteMedia, 'pinned'), true);

      assert.strictEqual(group.includes(unpinnedRemoteMediaFromGroup, 'unpinned'), true);
      assert.strictEqual(group.includes(pinnedRemoteMedia, 'unpinned'), false);
      assert.strictEqual(group.includes(otherRemoteMedia, 'unpinned'), false);
    });
  });
});
