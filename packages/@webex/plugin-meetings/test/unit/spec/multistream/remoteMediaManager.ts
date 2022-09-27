/* eslint-disable require-jsdoc */
import EventEmitter from 'events';

import {MediaConnection as MC} from '@webex/internal-media-core';
import {Configuration, DefaultConfiguration, Event, RemoteMediaManager, VideoLayoutChangedEventData} from '@webex/plugin-meetings/src/multistream/remoteMediaManager';
import {RemoteMediaGroup} from '@webex/plugin-meetings/src/multistream/remoteMediaGroup';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {cloneDeep} from 'lodash';

import testUtils from '../../../utils/testUtils';

class FakeSlot extends EventEmitter {
  public mediaType: MC.MediaType;

  public id: string;

  constructor(mediaType: MC.MediaType, id: string) {
    super();
    this.mediaType = mediaType;
    this.id = id;
  }
}

describe('RemoteMediaManager', () => {
  let remoteMediaManager;
  let fakeReceiveSlotManager;
  let fakeMediaRequestManagers;
  let fakeAudioSlot;
  let fakeVideoSlot;

  beforeEach(() => {
    fakeAudioSlot = new FakeSlot(MC.MediaType.AudioMain, 'fake audio slot');
    fakeVideoSlot = new FakeSlot(MC.MediaType.VideoMain, 'fake video slot');

    fakeReceiveSlotManager = {
      allocateSlot: sinon.stub().callsFake((mediaType) => {
        if (mediaType === MC.MediaType.AudioMain) {
          return Promise.resolve(fakeAudioSlot);
        }

        return Promise.resolve(fakeVideoSlot);
      }),
      releaseSlot: sinon.stub(),
    };

    fakeMediaRequestManagers = {
      audio: {
        addRequest: sinon.stub(),
        cancelRequest: sinon.stub(),
        commit: sinon.stub(),
      },
      video: {
        addRequest: sinon.stub(),
        cancelRequest: sinon.stub(),
        commit: sinon.stub(),
      }
    };

    // create remote media manager with default configuration
    remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers);
  });

  const resetHistory = () => {
    fakeReceiveSlotManager.allocateSlot.resetHistory();
    fakeReceiveSlotManager.releaseSlot.resetHistory();
    fakeMediaRequestManagers.audio.addRequest.resetHistory();
    fakeMediaRequestManagers.audio.cancelRequest.resetHistory();
    fakeMediaRequestManagers.audio.commit.resetHistory();
    fakeMediaRequestManagers.video.addRequest.resetHistory();
    fakeMediaRequestManagers.video.cancelRequest.resetHistory();
    fakeMediaRequestManagers.video.commit.resetHistory();
  };


  it('creates a RemoteMediaGroup for audio correctly', async () => {
    let createdAudioGroup: RemoteMediaGroup|null = null;

    // create a config with just audio, no video at all and no screen share
    const config = {
      audio: {
        numOfActiveSpeakerStreams: 5
      },
      video: {
        preferLiveVideo: false,
        initialLayoutId: 'empty',
        layouts: {
          empty: {
            screenShareVideo: {
              size: null,
            },
          }
        }
      },
      screenShare: {
        audio: false,
        video: false,
      }
    };

    remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);

    remoteMediaManager.on(Event.AudioCreated, (audio: RemoteMediaGroup) => {
      createdAudioGroup = audio;
    });

    remoteMediaManager.start();

    await testUtils.flushPromises();

    assert.callCount(fakeReceiveSlotManager.allocateSlot, 5);
    assert.alwaysCalledWith(fakeReceiveSlotManager.allocateSlot, MC.MediaType.AudioMain);

    assert.isNotNull(createdAudioGroup);
    if (createdAudioGroup) {
      assert.strictEqual(createdAudioGroup.getRemoteMedia().length, 5);
      assert.isTrue(createdAudioGroup.getRemoteMedia().every((remoteMedia) => remoteMedia.mediaType === MC.MediaType.AudioMain));
      assert.strictEqual(createdAudioGroup.getPinnedRemoteMedia().length, 0);
    }

    assert.calledOnce(fakeMediaRequestManagers.audio.addRequest);
    assert.calledWith(fakeMediaRequestManagers.audio.addRequest, sinon.match({
      policyInfo: sinon.match({
        policy: 'active-speaker',
        priority: 255,
      }),
      receiveSlots: Array(5).fill(fakeAudioSlot),
      codecInfo: undefined,
    }));
  });

  it('pre-allocates receive slots based on the biggest layout', async () => {
    const config = cloneDeep(DefaultConfiguration);

    config.audio.numOfActiveSpeakerStreams = 0;
    config.video.layouts.huge = {
      screenShareVideo: {
        size: null,
      },
      activeSpeakerVideoPaneGroups: [
        {
          id: 'big one', numPanes: 99, size: 'small', priority: 255
        }
      ]
    };

    remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);

    await remoteMediaManager.start();

    // even though our "big one" layout is not the default one, the remote media manager should still
    // preallocate enough video receive slots for it up front
    assert.callCount(fakeReceiveSlotManager.allocateSlot, 99);
    assert.alwaysCalledWith(fakeReceiveSlotManager.allocateSlot, MC.MediaType.VideoMain);
  });

  it('starts with the initial layout', async () => {
    let receivedLayoutInfo: VideoLayoutChangedEventData|null = null;

    remoteMediaManager.on(Event.VideoLayoutChanged, (layoutInfo: VideoLayoutChangedEventData) => {
      receivedLayoutInfo = layoutInfo;
    });

    // the initial layout is "AllEqual", so we check that it gets selected by default
    await remoteMediaManager.start();

    assert.strictEqual(remoteMediaManager.getLayoutId(), 'AllEqual');
    assert.isNotNull(receivedLayoutInfo);
    if (receivedLayoutInfo) {
      assert.strictEqual(receivedLayoutInfo.layoutId, 'AllEqual');
      assert.strictEqual(Object.keys(receivedLayoutInfo.memberVideoPanes).length, 0);
      assert.strictEqual(Object.keys(receivedLayoutInfo.activeSpeakerVideoPanes).length, 1); // this layout has only 1 active speaker group
      assert.strictEqual(receivedLayoutInfo.activeSpeakerVideoPanes.main.getRemoteMedia().length, 9);
    }
  });

  describe('constructor', () => {
    it('throws if the initial layout in the config is invalid', () => {
      const config = cloneDeep(DefaultConfiguration);

      config.video.initialLayoutId = 'invalid';

      assert.throws(() => {
        remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);
      }, 'invalid config: initialLayoutId "invalid" doesn\'t match any of the layouts');
    });

    it('throws if there are duplicate active speaker video pane groups', () => {
      const config = cloneDeep(DefaultConfiguration);

      config.video.layouts.test = {
        screenShareVideo: {size: null},
        activeSpeakerVideoPaneGroups: [{
          id: 'someDuplicate',
          numPanes: 10,
          priority: 255,
          size: 'best',
        }, {
          id: 'other',
          numPanes: 10,
          priority: 254,
          size: 'best',
        }, {
          id: 'someDuplicate',
          numPanes: 10,
          priority: 255,
          size: 'best',
        }]
      };

      assert.throws(() => {
        remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);
      }, 'invalid config: duplicate active speaker video pane group id: someDuplicate');
    });

    it('throws if there are active speaker video pane groups with duplicate priority', () => {
      const config = cloneDeep(DefaultConfiguration);

      config.video.layouts.test = {
        screenShareVideo: {size: null},
        activeSpeakerVideoPaneGroups: [{
          id: 'group1',
          numPanes: 10,
          priority: 200,
          size: 'best',
        }, {
          id: 'group2',
          numPanes: 2,
          priority: 200,
          size: 'medium',
        }, {
          id: 'group3',
          numPanes: 5,
          priority: 100,
          size: 'large',
        }]
      };

      assert.throws(() => {
        remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);
      }, 'invalid config: multiple active speaker video pane groups have same priority: 200');
    });

    it('throws if there are duplicate member video panes', () => {
      const config = cloneDeep(DefaultConfiguration);

      config.video.layouts.test = {
        screenShareVideo: {size: null},
        memberVideoPanes: [
          {id: 'paneA', size: 'best', csi: 123},
          {id: 'paneB', size: 'large', csi: 222},
          {id: 'paneC', size: 'medium', csi: 333},
          {id: 'paneB', size: 'small', csi: 444},
        ],
      };

      assert.throws(() => {
        remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);
      }, 'invalid config: duplicate member video pane id: paneB');
    });
  });

  describe('stop', () => {
    it('releases all the slots and invalidates all remote media', async () => {
      let audioStopStub;
      let videoActiveSpeakerGroupStopStub;
      const memberVideoPaneStopStubs: any[] = [];

      // change the initial layout to one that has both active speakers and receveiver selected videos
      const config = cloneDeep(DefaultConfiguration);

      config.video.initialLayoutId = 'Stage';

      remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);

      remoteMediaManager.on(Event.AudioCreated, (audio: RemoteMediaGroup) => {
        audioStopStub = sinon.stub(audio, 'stop');
      });

      remoteMediaManager.on(Event.VideoLayoutChanged, (layoutInfo: VideoLayoutChangedEventData) => {
        // The "Stage" layout that we're using has only 1 active speaker group called "thumbnails"
        videoActiveSpeakerGroupStopStub = sinon.stub(layoutInfo.activeSpeakerVideoPanes.thumbnails, 'stop');

        Object.values(layoutInfo.memberVideoPanes).forEach((pane) => {
          memberVideoPaneStopStubs.push(sinon.stub(pane, 'stop'));
        });
      });

      await remoteMediaManager.start();

      // we're using the default config that requires 3 main audio slots and 10 video slots (for Stage2x2With6ThumbnailsLayout)
      assert.callCount(fakeReceiveSlotManager.allocateSlot, 13);

      // our layout has 4 member video panes, we should have a stub for each of these panes' stop methods
      assert.strictEqual(memberVideoPaneStopStubs.length, 4);

      resetHistory();

      remoteMediaManager.stop();

      // check that all slots have been released
      assert.callCount(fakeReceiveSlotManager.releaseSlot, 13);

      // and that all RemoteMedia and RemoteMediaGroups have been stopped
      assert.calledOnce(audioStopStub);
      assert.calledWith(audioStopStub, true);
      assert.calledOnce(videoActiveSpeakerGroupStopStub);
      memberVideoPaneStopStubs.forEach((stub) => {
        assert.calledOnce(stub);
      });
      assert.calledOnce(fakeMediaRequestManagers.video.commit);
    });
  });
  describe('setLayout', () => {
    it('allocates more slots when switching to a layout that requires more slots', async () => {
      // start with "Single" layout that needs just 1 video slot
      const config = cloneDeep(DefaultConfiguration);

      config.video.initialLayoutId = 'Single';

      remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);

      await remoteMediaManager.start();

      resetHistory();

      // switch to "Stage" layout that requires 9 more video slots (10)
      await remoteMediaManager.setLayout('Stage');

      assert.callCount(fakeReceiveSlotManager.allocateSlot, 9);
      assert.alwaysCalledWith(fakeReceiveSlotManager.allocateSlot, MC.MediaType.VideoMain);
    });

    it('releases slots when switching to layout that requires less slots', async () => {
      // start with "AllEqual" layout that needs just 9 video slots
      const config = cloneDeep(DefaultConfiguration);

      config.video.initialLayoutId = 'AllEqual';

      remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);

      await remoteMediaManager.start();

      resetHistory();

      // switch to "OnePlusFive" layout that requires 3 less video slots (6)
      await remoteMediaManager.setLayout('OnePlusFive');

      // verify that 3 main video slots were released
      assert.callCount(fakeReceiveSlotManager.releaseSlot, 3);
      fakeReceiveSlotManager.releaseSlot.getCalls().forEach((call) => {
        const slot = call.args[0];

        assert.strictEqual(slot.mediaType, MC.MediaType.VideoMain);
      });
    });

    describe('media requests', () => {
      it('sends correct media requests when switching to a layout with receiver selected slots', async () => {
        const config = cloneDeep(DefaultConfiguration);

        config.video.layouts.Stage.memberVideoPanes = [
          {id: 'stage-1', size: 'medium', csi: 11111},
          {id: 'stage-2', size: 'medium', csi: 22222},
          {id: 'stage-3', size: 'medium', csi: undefined},
          {id: 'stage-4', size: 'medium', csi: undefined},
        ];
        remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);

        await remoteMediaManager.start();

        resetHistory();

        // switch to "Stage" layout that has an active speaker group and 4 receiver selected slots
        // and a CSI set on 2 of them
        await remoteMediaManager.setLayout('Stage');

        assert.callCount(fakeMediaRequestManagers.video.addRequest, 3);
        assert.calledWith(fakeMediaRequestManagers.video.addRequest, sinon.match({
          policyInfo: sinon.match({
            policy: 'active-speaker',
            priority: 255,
          }),
          receiveSlots: Array(6).fill(fakeVideoSlot),
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 60,
          }),
        }));
        assert.calledWith(fakeMediaRequestManagers.video.addRequest, sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: 11111,
          }),
          receiveSlots: Array(1).fill(fakeVideoSlot),
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        }));
        assert.calledWith(fakeMediaRequestManagers.video.addRequest, sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: 22222,
          }),
          receiveSlots: Array(1).fill(fakeVideoSlot),
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        }));
      });

      it('sends correct media requests when switching to a layout with multiple active-speaker groups', async () => {
        // start with "AllEqual" layout that needs just 9 video slots
        const config = cloneDeep(DefaultConfiguration);

        config.video.initialLayoutId = 'AllEqual';

        remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);

        const allEqualMediaRequestId = 'fake request id';

        fakeMediaRequestManagers.video.addRequest.returns(allEqualMediaRequestId);

        await remoteMediaManager.start();

        resetHistory();

        // switch to "OnePlusFive" layout that has 2 active speaker groups
        await remoteMediaManager.setLayout('OnePlusFive');

        // check that the previous active speaker request for "AllEqual" group was cancelled
        assert.calledOnce(fakeMediaRequestManagers.video.cancelRequest);
        assert.calledWith(fakeMediaRequestManagers.video.cancelRequest, allEqualMediaRequestId);

        // check that 2 correct active speaker media requests were sent out
        assert.callCount(fakeMediaRequestManagers.video.addRequest, 2);
        assert.calledWith(fakeMediaRequestManagers.video.addRequest, sinon.match({
          policyInfo: sinon.match({
            policy: 'active-speaker',
            priority: 255,
          }),
          receiveSlots: Array(1).fill(fakeVideoSlot),
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 8192,
          }),
        }));
        assert.calledWith(fakeMediaRequestManagers.video.addRequest, sinon.match({
          policyInfo: sinon.match({
            policy: 'active-speaker',
            priority: 254,
          }),
          receiveSlots: Array(5).fill(fakeVideoSlot),
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 240,
          }),
        }));
      });

      it('cancels all media requests for the previous layout when switching to a new one', async () => {
        const config: Configuration = {
          audio: {
            numOfActiveSpeakerStreams: 0
          },
          video: {
            preferLiveVideo: true,
            initialLayoutId: 'initial',
            layouts: {
              initial: {
                screenShareVideo: {size: null},
                activeSpeakerVideoPaneGroups: [
                  {
                    id: 'big', numPanes: 10, priority: 255, size: 'large'
                  },
                  {
                    id: 'small', numPanes: 3, priority: 254, size: 'medium'
                  },
                ],
                memberVideoPanes: [
                  {id: 'pane 1', size: 'best', csi: 123},
                  {id: 'pane 2', size: 'best', csi: 234},
                ]
              },
              other: {
                screenShareVideo: {size: null},
              }
            }
          },
          screenShare: {
            audio: false,
            video: false,
          }
        };

        remoteMediaManager = new RemoteMediaManager(fakeReceiveSlotManager, fakeMediaRequestManagers, config);

        let activeSpeakerRequestCounter = 0;
        let receiverSelectedRequestCounter = 0;

        // setup the mock for addRequest to return request ids that we want
        fakeMediaRequestManagers.video.addRequest.callsFake((mediaRequest) => {
          if (mediaRequest.policyInfo.policy === 'active-speaker') {
            activeSpeakerRequestCounter += 1;

            return `active speaker request ${activeSpeakerRequestCounter}`;
          }
          receiverSelectedRequestCounter += 1;

          return `receiver selected request ${receiverSelectedRequestCounter}`;
        });

        await remoteMediaManager.start();

        resetHistory();

        // switch to "other" layout
        await remoteMediaManager.setLayout('other');

        // check that all the previous media requests for "initial" layout have been cancelled
        assert.callCount(fakeMediaRequestManagers.video.cancelRequest, 4);
        assert.calledWith(fakeMediaRequestManagers.video.cancelRequest, 'active speaker request 1');
        assert.calledWith(fakeMediaRequestManagers.video.cancelRequest, 'active speaker request 2');
        assert.calledWith(fakeMediaRequestManagers.video.cancelRequest, 'receiver selected request 1');
        assert.calledWith(fakeMediaRequestManagers.video.cancelRequest, 'receiver selected request 2');

        // new layout has no videos, so no new requests should be sent out
        // check that 2 correct active speaker media requests were sent out
        assert.callCount(fakeMediaRequestManagers.video.addRequest, 0);
      });
    });
  });

  describe('setRemoteVideoCsi', () => {
    it('sends correct media requests', async () => {
      let currentLayoutInfo: VideoLayoutChangedEventData|null = null;

      await remoteMediaManager.start();

      remoteMediaManager.on(Event.VideoLayoutChanged, (layoutInfo: VideoLayoutChangedEventData) => {
        currentLayoutInfo = layoutInfo;
      });
      // switch to "Stage" layout which has some receiver selected slots
      await remoteMediaManager.setLayout('Stage');
      resetHistory();

      assert.isNotNull(currentLayoutInfo);

      if (currentLayoutInfo) {
        const fakeRequestId1 = 'fake request id 1';
        const fakeRequestId2 = 'fake request id 2';

        fakeMediaRequestManagers.video.addRequest.returns(fakeRequestId1);

        remoteMediaManager.setRemoteVideoCsi(currentLayoutInfo.memberVideoPanes['stage-1'], 1001);

        // a new media request should have been sent out
        assert.calledOnce(fakeMediaRequestManagers.video.addRequest);
        assert.calledWith(fakeMediaRequestManagers.video.addRequest, sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: 1001,
          }),
          receiveSlots: Array(1).fill(fakeVideoSlot),
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        }));
        assert.notCalled(fakeMediaRequestManagers.video.cancelRequest);

        resetHistory();

        // change the same video pane again
        remoteMediaManager.setRemoteVideoCsi(currentLayoutInfo.memberVideoPanes['stage-1'], 1002);

        // a new media request should have been sent out
        assert.calledOnce(fakeMediaRequestManagers.video.addRequest);
        assert.calledWith(fakeMediaRequestManagers.video.addRequest, sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: 1002,
          }),
          receiveSlots: Array(1).fill(fakeVideoSlot),
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        }));
        // and previous one should have been cancelled
        assert.calledOnce(fakeMediaRequestManagers.video.cancelRequest);
        assert.calledWith(fakeMediaRequestManagers.video.cancelRequest, fakeRequestId1);

        resetHistory();

        fakeMediaRequestManagers.video.addRequest.returns(fakeRequestId2);

        // now change some other video pane
        remoteMediaManager.setRemoteVideoCsi(currentLayoutInfo.memberVideoPanes['stage-3'], 2001);

        // a new media request should have been sent out
        assert.calledOnce(fakeMediaRequestManagers.video.addRequest);
        assert.calledWith(fakeMediaRequestManagers.video.addRequest, sinon.match({
          policyInfo: sinon.match({
            policy: 'receiver-selected',
            csi: 2001,
          }),
          receiveSlots: Array(1).fill(fakeVideoSlot),
          codecInfo: sinon.match({
            codec: 'h264',
            maxFs: 3600,
          }),
        }));
        // nothing should have been cancelled
        assert.notCalled(fakeMediaRequestManagers.video.cancelRequest);

        resetHistory();

        // now set CSI back to undefined
        remoteMediaManager.setRemoteVideoCsi(currentLayoutInfo.memberVideoPanes['stage-3'], undefined);

        // no new media request should have been sent out
        assert.notCalled(fakeMediaRequestManagers.video.addRequest);
        // and previous one should have been cancelled
        assert.calledOnce(fakeMediaRequestManagers.video.cancelRequest);
        assert.calledWith(fakeMediaRequestManagers.video.cancelRequest, fakeRequestId2);
      }
    });
  });

  describe('addMemberVideoPane()', () => {
    it('fails if there is no current layout', () => {
      // we haven't called start() so there is no layout set, yet
      assert.isRejected(remoteMediaManager.addMemberVideoPane({id: 'newPane', size: 'best', csi: 54321}));
    });

    it('fails if called with a duplicate paneId', async () => {
      await remoteMediaManager.start();
      await remoteMediaManager.setLayout('Stage');

      assert.isRejected(remoteMediaManager.addMemberVideoPane({id: 'stage-3', size: 'best', csi: 54321}));
    });

    it('works as expected when called with a CSI value', async () => {
      await remoteMediaManager.start();
      await remoteMediaManager.setLayout('Stage');

      resetHistory();

      await remoteMediaManager.addMemberVideoPane({id: 'newPane', size: 'best', csi: 54321});

      // new slot should be allocated
      assert.calledOnce(fakeReceiveSlotManager.allocateSlot);
      assert.calledWith(fakeReceiveSlotManager.allocateSlot, MC.MediaType.VideoMain);

      // and a media request sent out
      assert.calledOnce(fakeMediaRequestManagers.video.addRequest);
      assert.calledWith(fakeMediaRequestManagers.video.addRequest, sinon.match({
        policyInfo: sinon.match({
          policy: 'receiver-selected',
          csi: 54321,
        }),
        receiveSlots: Array(1).fill(fakeVideoSlot),
        codecInfo: sinon.match({
          codec: 'h264',
          maxFs: 8192,
        }),
      }));
    });
    it('works as expected when called without a CSI value', async () => {
      await remoteMediaManager.setLayout('Stage');

      resetHistory();

      await remoteMediaManager.addMemberVideoPane({id: 'newPane', size: 'best'});

      // new slot should be allocated
      assert.calledOnce(fakeReceiveSlotManager.allocateSlot);
      assert.calledWith(fakeReceiveSlotManager.allocateSlot, MC.MediaType.VideoMain);

      // but no media requests sent out
      assert.notCalled(fakeMediaRequestManagers.video.addRequest);
    });
  });

  describe('removeMemberVideoPane()', () => {
    it('fails if there is no current layout', () => {
      // we haven't called start() so there is no layout set, yet
      assert.isRejected(remoteMediaManager.removeMemberVideoPane('newPane'));
    });

    it('does nothing when called for a pane not in the current layout', async () => {
      await remoteMediaManager.start();
      await remoteMediaManager.setLayout('Stage');

      resetHistory();

      await remoteMediaManager.removeMemberVideoPane('some pane');

      assert.notCalled(fakeReceiveSlotManager.releaseSlot);
      assert.notCalled(fakeMediaRequestManagers.video.cancelRequest);
    });

    it('works as expected', async () => {
      await remoteMediaManager.start();
      await remoteMediaManager.setLayout('Stage');

      const fakeNewSlot = new FakeSlot(MC.MediaType.VideoMain, 'fake video slot');
      const fakeRequestId = 'fake request id';

      fakeReceiveSlotManager.allocateSlot.resolves(fakeNewSlot);
      fakeMediaRequestManagers.video.addRequest.returns(fakeRequestId);

      // first, add some pane
      await remoteMediaManager.addMemberVideoPane({id: 'newPane', size: 'best', csi: 54321});

      resetHistory();

      // now remove it
      await remoteMediaManager.removeMemberVideoPane('newPane');

      // slot should be released
      assert.calledOnce(fakeReceiveSlotManager.releaseSlot);
      assert.calledWith(fakeReceiveSlotManager.releaseSlot, fakeNewSlot);

      // and a media request cancelled
      assert.calledOnce(fakeMediaRequestManagers.video.cancelRequest);
      assert.calledWith(fakeMediaRequestManagers.video.cancelRequest, fakeRequestId);
    });
  });

  describe('pinActiveSpeakerVideoPane() and isPinned()', () => {
    it('throws if called on a pane not belonging to an active speaker group', async () => {
      let currentLayoutInfo: VideoLayoutChangedEventData|null = null;

      remoteMediaManager.on(Event.VideoLayoutChanged, (layoutInfo: VideoLayoutChangedEventData) => {
        currentLayoutInfo = layoutInfo;
      });

      await remoteMediaManager.start();
      await remoteMediaManager.setLayout('Stage');

      assert.isNotNull(currentLayoutInfo);

      if (currentLayoutInfo) {
        const remoteVideo = currentLayoutInfo.memberVideoPanes['stage-1'];

        assert.throws(() => remoteMediaManager.pinActiveSpeakerVideoPane(remoteVideo));
        assert.throws(() => remoteMediaManager.isPinned(remoteVideo));
      }
    });

    it('calls pin()/isPinned() on the correct remote media group', async () => {
      let currentLayoutInfo: VideoLayoutChangedEventData|null = null;
      let pinStub;
      let isPinnedStub;

      remoteMediaManager.on(Event.VideoLayoutChanged, (layoutInfo: VideoLayoutChangedEventData) => {
        currentLayoutInfo = layoutInfo;
        pinStub = sinon.stub(layoutInfo.activeSpeakerVideoPanes.main, 'pin');
        isPinnedStub = sinon.stub(layoutInfo.activeSpeakerVideoPanes.main, 'isPinned');
      });

      await remoteMediaManager.start();

      assert.isNotNull(currentLayoutInfo);

      if (currentLayoutInfo) {
        const remoteVideo = currentLayoutInfo.activeSpeakerVideoPanes.main.getRemoteMedia()[0];

        // first test pinActiveSpeakerVideoPane()
        remoteMediaManager.pinActiveSpeakerVideoPane(remoteVideo);

        assert.calledOnce(pinStub);
        assert.calledWith(pinStub, remoteVideo, undefined);

        // now test isPinned()
        remoteMediaManager.isPinned(remoteVideo);

        assert.calledOnce(isPinnedStub);
        assert.calledWith(isPinnedStub, remoteVideo);
      }
    });
  });

  describe('unpinActiveSpeakerVideoPane', () => {
    it('throws if called on a remote media instance that was not pinned', async () => {
      let currentLayoutInfo: VideoLayoutChangedEventData|null = null;

      remoteMediaManager.on(Event.VideoLayoutChanged, (layoutInfo: VideoLayoutChangedEventData) => {
        currentLayoutInfo = layoutInfo;
      });

      await remoteMediaManager.start();

      assert.isNotNull(currentLayoutInfo);

      if (currentLayoutInfo) {
        const remoteVideoToUnPin = currentLayoutInfo.activeSpeakerVideoPanes.main.getRemoteMedia()[0];

        assert.throws(() => remoteMediaManager.unpinActiveSpeakerVideoPane(remoteVideoToUnPin));
      }
    });

    it('calls unpin() on the correct remote media group', async () => {
      let currentLayoutInfo: VideoLayoutChangedEventData|null = null;
      let unpinStub;

      remoteMediaManager.on(Event.VideoLayoutChanged, (layoutInfo: VideoLayoutChangedEventData) => {
        currentLayoutInfo = layoutInfo;
        unpinStub = sinon.stub(layoutInfo.activeSpeakerVideoPanes.main, 'unpin');
      });

      await remoteMediaManager.start();

      assert.isNotNull(currentLayoutInfo);

      if (currentLayoutInfo) {
        const remoteVideo = currentLayoutInfo.activeSpeakerVideoPanes.main.getRemoteMedia()[0];

        // first we need to pin it
        remoteMediaManager.pinActiveSpeakerVideoPane(remoteVideo, 99999);

        // now we can unpin it
        remoteMediaManager.unpinActiveSpeakerVideoPane(remoteVideo);

        assert.calledOnce(unpinStub);
        assert.calledWith(unpinStub, remoteVideo);
      }
    });
  });
});
