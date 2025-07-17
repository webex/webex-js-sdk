import sinon from 'sinon';
import {assert, expect} from '@webex/test-helper-chai';

import testUtils from '../../../utils/testUtils';
import {BrbState, createBrbState} from '@webex/plugin-meetings/src/meeting/brbState';
import {MediaType} from '@webex/internal-media-core';

describe('plugin-meetings', () => {
  let meeting: any;
  let brbState: BrbState;
  let setBrbStub: sinon.SinonStub;

  beforeEach(async () => {
    meeting = {
      isMultistream: true,
      locusUrl: 'locus url',
      deviceUrl: 'device url',
      selfId: 'self id',
      mediaProperties: {
        webrtcMediaConnection: true,
      },
      sendSlotManager: {
        setSourceStateOverride: sinon.stub(),
      },
      meetingRequest: {
        setBrb: () => {},
      },
    };

    setBrbStub = sinon.stub(meeting.meetingRequest, 'setBrb').resolves();

    brbState = new BrbState(meeting, false);
    await testUtils.flushPromises();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('brbState library', () => {
    it('takes into account current status when instantiated', async () => {
      // create a new BrbState instance
      brbState = createBrbState(meeting, true);
      await testUtils.flushPromises();

      assert.isTrue(brbState.state.client.enabled);

      // now check the opposite case
      brbState = createBrbState(meeting, false);
      await testUtils.flushPromises();

      assert.isFalse(brbState.state.client.enabled);
    });

    it('can be enabled', async () => {
      brbState.enable(true, meeting.sendSlotManager);
      brbState.handleServerBrbUpdate(true);
      await testUtils.flushPromises();

      assert.isTrue(brbState.state.client.enabled);
      assert.isTrue(brbState.state.server.enabled);
    });

    it('can be disabled', async () => {
      brbState.enable(false, meeting.sendSlotManager);
      brbState.handleServerBrbUpdate(false);
      await testUtils.flushPromises();

      assert.isFalse(brbState.state.client.enabled);
      assert.isFalse(brbState.state.server.enabled);
    });

    it('does not send local brb state to server if it is not a multistream meeting', async () => {
      meeting.isMultistream = false;
      brbState.enable(true, meeting.sendSlotManager);
      brbState.handleServerBrbUpdate(true);
      await testUtils.flushPromises();

      assert.isTrue(meeting.meetingRequest.setBrb.notCalled);
    });

    it('does not send local brb state to server if webrtc media connection is not defined', async () => {
      meeting.mediaProperties.webrtcMediaConnection = undefined;
      brbState.enable(true, meeting.sendSlotManager);
      brbState.handleServerBrbUpdate(true);
      await testUtils.flushPromises();

      assert.isTrue(meeting.meetingRequest.setBrb.notCalled);
    });

    it('does not send request twice when in progress', async () => {
      brbState.state.syncToServerInProgress = true;
      brbState.enable(true, meeting.sendSlotManager);
      await testUtils.flushPromises();

      assert.isTrue(meeting.meetingRequest.setBrb.notCalled);
    });

    it('syncs with server when client state does not match server state', async () => {
      brbState.enable(true, meeting.sendSlotManager);
      brbState.handleServerBrbUpdate(true);
      await testUtils.flushPromises();

      assert.isTrue(meeting.meetingRequest.setBrb.calledOnce);
    });

    it('updates source state override', async () => {
      brbState.enable(true, meeting.sendSlotManager);
      brbState.handleServerBrbUpdate(true);
      await testUtils.flushPromises();

      assert.isTrue(meeting.sendSlotManager.setSourceStateOverride.called);
    });

    it('handles server update', async () => {
      brbState.handleServerBrbUpdate(true);
      await testUtils.flushPromises();

      assert.isTrue(brbState.state.server.enabled);
    });

    it('invokes handleServerBrbUpdate with correct client state after syncing with server', async () => {
      const sendLocalBrbStateToServerStub = sinon
        .stub(brbState, 'sendLocalBrbStateToServer')
        .resolves();

      const handleServerBrbUpdateSpy = sinon.spy(brbState, 'handleServerBrbUpdate');

      await brbState.enable(true, meeting.sendSlotManager);

      assert.isTrue(sendLocalBrbStateToServerStub.calledOnce);

      assert.isTrue(handleServerBrbUpdateSpy.calledOnceWith(brbState.state.client.enabled));

      assert.isFalse(brbState.state.syncToServerInProgress);

      sendLocalBrbStateToServerStub.restore();
      handleServerBrbUpdateSpy.restore();
    });

    it('should reject when sendLocalBrbStateToServer fails', async () => {
      const error = new Error('send failed');
      setBrbStub.rejects(error);

      const enablePromise = brbState.enable(true, meeting.sendSlotManager);
      await expect(enablePromise).to.be.rejectedWith(error);

      assert.isFalse(brbState.state.syncToServerInProgress);
      assert.isTrue(
        meeting.sendSlotManager.setSourceStateOverride.calledWith(MediaType.VideoMain, 'away')
      );
    });
  });
});
