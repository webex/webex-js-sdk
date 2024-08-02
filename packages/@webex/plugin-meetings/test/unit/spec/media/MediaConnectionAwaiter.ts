import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {ConnectionState, Event} from '@webex/internal-media-core';
import testUtils from '../../../utils/testUtils';
import {ICE_AND_DTLS_CONNECTION_TIMEOUT} from '@webex/plugin-meetings/src/constants';
import MediaConnectionAwaiter from '../../../../src/media/MediaConnectionAwaiter';

describe('MediaConnectionAwaiter', () => {
  let mediaConnectionAwaiter;
  let mockMC;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    mockMC = {
      getStats: sinon.stub().resolves([]),
      on: sinon.stub(),
      off: sinon.stub(),
      getConnectionState: sinon.stub().returns(ConnectionState.New),
      getIceGatheringState: sinon.stub().returns('new'),
      getIceConnectionState: sinon.stub().returns('new'),
      getPeerConnectionState: sinon.stub().returns('new'),
    };

    mediaConnectionAwaiter = new MediaConnectionAwaiter({
      webrtcMediaConnection: mockMC,
    });
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe('waitForMediaConnectionConnected', () => {
    it('resolves immediately if connection state is connected', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connected);

      await mediaConnectionAwaiter.waitForMediaConnectionConnected();

      assert.neverCalledWith(mockMC.on);
    });

    it('rejects after timeout if ice state is not connected', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('gathering');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch((error) => {
          promiseRejected = true;

          const {iceConnected} = error;
          assert.equal(iceConnected, false);
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], Event.ICE_GATHERING_STATE_CHANGED);
      const iceGatheringListener = mockMC.on.getCall(2).args[1];

      mockMC.getIceGatheringState.returns('complete');
      iceGatheringListener();

      await clock.tickAsync(ICE_AND_DTLS_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);

      assert.calledThrice(mockMC.off);
    });

    it('rejects immediately if ice state is FAILED', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('gathering');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch((error) => {
          promiseRejected = true;

          const {iceConnected} = error;
          assert.equal(iceConnected, false);
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], Event.ICE_GATHERING_STATE_CHANGED);
      const iceConnectionListener = mockMC.on.getCall(1).args[1];

      mockMC.getConnectionState.returns(ConnectionState.Failed);
      iceConnectionListener();

      await testUtils.flushPromises();

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);

      assert.calledThrice(mockMC.off);
    });

    it('rejects after timeout if dtls state is not connected', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('gathering');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch((error) => {
          promiseRejected = true;

          const {iceConnected} = error;
          assert.equal(iceConnected, false);
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], Event.ICE_GATHERING_STATE_CHANGED);
      const listener = mockMC.on.getCall(1).args[1];
      const iceConnectionListener = mockMC.on.getCall(1).args[1];
      
      mockMC.getIceGatheringState.returns('complete');
      listener();

      mockMC.getIceConnectionState.returns('connected');
      iceConnectionListener();

      await clock.tickAsync(ICE_AND_DTLS_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);

      assert.calledThrice(mockMC.off);
    });

    it('resolves after timeout if connection state reach connected/completed', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('gathering');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseRejected = true;
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], Event.ICE_GATHERING_STATE_CHANGED);

      mockMC.getConnectionState.returns(ConnectionState.Connected);

      await clock.tickAsync(ICE_AND_DTLS_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, true);
      assert.equal(promiseRejected, false);

      assert.calledThrice(mockMC.off);
    });

    it(`resolves when media connection reaches "connected" state`, async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('gathering');

      const clearTimeoutSpy = sinon.spy(clock, 'clearTimeout');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseRejected = true;
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], Event.ICE_GATHERING_STATE_CHANGED);
      const listener = mockMC.on.getCall(0).args[1];

      // call the listener and pretend we are now connected
      mockMC.getConnectionState.returns(ConnectionState.Connected);
      listener();
      await testUtils.flushPromises();

      assert.equal(promiseResolved, true);
      assert.equal(promiseRejected, false);

      // check that listener was removed
      assert.calledThrice(mockMC.off);

      assert.calledOnce(clearTimeoutSpy);
    });

    it(`ice gathering state update to "gathering" state does not update timer`, async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('new');

      const clearTimeoutSpy = sinon.spy(clock, 'clearTimeout');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseRejected = true;
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], Event.ICE_GATHERING_STATE_CHANGED);
      const listener = mockMC.on.getCall(1).args[1];

      // call the listener and pretend we are now connected
      mockMC.getIceGatheringState.returns('gathering');
      listener();

      mockMC.getConnectionState.returns(ConnectionState.Connected);

      await clock.tickAsync(ICE_AND_DTLS_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, true);
      assert.equal(promiseRejected, false);

      // check that listener was removed
      assert.calledThrice(mockMC.off);

      assert.neverCalledWith(clearTimeoutSpy);
    });

    it(`ice gathering update to 'complete' state restarts the timer`, async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('new');

      const setTimeoutSpy = sinon.spy(clock, 'setTimeout');
      const clearTimeoutSpy = sinon.spy(clock, 'clearTimeout');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseRejected = true;
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      assert.calledOnce(setTimeoutSpy);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], Event.ICE_GATHERING_STATE_CHANGED);
      const listener = mockMC.on.getCall(2).args[1];

      // call the listener and pretend we are now connected
      mockMC.getIceGatheringState.returns('complete');
      listener();

      assert.calledOnce(clearTimeoutSpy);
      assert.calledTwice(setTimeoutSpy);

      mockMC.getConnectionState.returns(ConnectionState.Connected);

      await clock.tickAsync(ICE_AND_DTLS_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, true);
      assert.equal(promiseRejected, false);

      // check that listener was removed
      assert.calledThrice(mockMC.off);
    });

    it(`reject with restart timer once if gathering state is not complete`, async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('new');

      const setTimeoutSpy = sinon.spy(clock, 'setTimeout');
      const clearTimeoutSpy = sinon.spy(clock, 'clearTimeout');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseRejected = true;
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], Event.ICE_GATHERING_STATE_CHANGED);

      await clock.tickAsync(ICE_AND_DTLS_CONNECTION_TIMEOUT * 2);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);

      // check that listener was removed
      assert.calledThrice(mockMC.off);

      assert.calledOnce(clearTimeoutSpy);
      assert.calledTwice(setTimeoutSpy);
    });

    it(`resolves gathering and connection state complete right after`, async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('new');

      const setTimeoutSpy = sinon.spy(clock, 'setTimeout');
      const clearTimeoutSpy = sinon.spy(clock, 'clearTimeout');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseRejected = true;
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], Event.ICE_GATHERING_STATE_CHANGED);
      const connectionStateListener = mockMC.on.getCall(0).args[1];
      const iceGatheringListener = mockMC.on.getCall(2).args[1];

      mockMC.getIceGatheringState.returns('complete');
      iceGatheringListener();

      mockMC.getConnectionState.returns(ConnectionState.Connected);
      connectionStateListener();

      await testUtils.flushPromises();

      assert.equal(promiseResolved, true);
      assert.equal(promiseRejected, false);

      // check that listener was removed
      assert.calledThrice(mockMC.off);

      assert.calledTwice(clearTimeoutSpy);
      assert.calledTwice(setTimeoutSpy);
    });
  });
});
