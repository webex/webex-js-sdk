import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

import testUtils from '../../../utils/testUtils';
import {BrbState, createBrbState} from '@webex/plugin-meetings/src/meeting/brbState';

describe('plugin-meetings', () => {
  let meeting: any;
  let brbState: BrbState;

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
        setBrb: sinon.stub().resolves(),
      },
    };

    brbState = new BrbState(meeting, false);
    await testUtils.flushPromises();
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

    it('sets source state override when client state does not match server state', async () => {
      brbState.enable(true, meeting.sendSlotManager);
      brbState.handleServerBrbUpdate(true);
      await testUtils.flushPromises();

      assert.isTrue(meeting.sendSlotManager.setSourceStateOverride.calledOnce);
    });

    it('handles server update', async () => {
      brbState.handleServerBrbUpdate(true);
      await testUtils.flushPromises();

      assert.isTrue(brbState.state.server.enabled);
    });
  });
});
