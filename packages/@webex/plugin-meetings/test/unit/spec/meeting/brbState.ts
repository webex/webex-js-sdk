import sinon from 'sinon';
<<<<<<< HEAD
import {assert} from '@webex/test-helper-chai';

import testUtils from '../../../utils/testUtils';
import {BrbState, createBrbState} from '@webex/plugin-meetings/src/meeting/brbState';
=======
import {assert, expect} from '@webex/test-helper-chai';

import testUtils from '../../../utils/testUtils';
import {BrbState, createBrbState} from '@webex/plugin-meetings/src/meeting/brbState';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
>>>>>>> 973305b33f5c07decca9bddb8990b26dc7e6d4d3

describe('plugin-meetings', () => {
  let meeting: any;
  let brbState: BrbState;
<<<<<<< HEAD
=======
  let setBrbStub: sinon.SinonStub;  
>>>>>>> 973305b33f5c07decca9bddb8990b26dc7e6d4d3

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
<<<<<<< HEAD
        setBrb: sinon.stub().resolves(),
      },
    };

=======
        setBrb: () => {}
      },
    };

    setBrbStub = sinon.stub(meeting.meetingRequest, 'setBrb').resolves();

>>>>>>> 973305b33f5c07decca9bddb8990b26dc7e6d4d3
    brbState = new BrbState(meeting, false);
    await testUtils.flushPromises();
  });

<<<<<<< HEAD
=======
  afterEach(() => {
    sinon.restore();
  });

>>>>>>> 973305b33f5c07decca9bddb8990b26dc7e6d4d3
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
<<<<<<< HEAD
=======

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
        
      await expect(
        brbState.enable(true, meeting.sendSlotManager)
      ).to.be.rejectedWith(error); 

      assert.isFalse(brbState.state.syncToServerInProgress);
    });
>>>>>>> 973305b33f5c07decca9bddb8990b26dc7e6d4d3
  });
});
