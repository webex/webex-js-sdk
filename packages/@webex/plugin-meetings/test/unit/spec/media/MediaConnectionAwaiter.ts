import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {ConnectionState, MediaConnectionEventNames} from '@webex/internal-media-core';
import testUtils from '../../../utils/testUtils';
import {
  DTLS_CONNECTION_TIMEOUT,
  ICE_CONNECTION_TIMEOUT,
} from '@webex/plugin-meetings/src/constants';
import MediaConnectionAwaiter from '../../../../src/media/MediaConnectionAwaiter';
import Metrics from '../../../../src/metrics';
import BEHAVIORAL_METRICS from '../../../../src/metrics/constants';

describe('MediaConnectionAwaiter', () => {
  let mediaConnectionAwaiter;
  let mockMC;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    const mockTransportReport = {
      type: 'transport',
      dtlsState: 'connecting',
      iceState: 'checking',
      packetsSent: 10,
      packetsReceived: 5,
    };

    mockMC = {
      getStats: sinon.stub().resolves({
        values: () => [mockTransportReport],
      }),
      on: sinon.stub(),
      off: sinon.stub(),
      getConnectionState: sinon.stub().returns(ConnectionState.New),
      getIceGatheringState: sinon.stub().returns('new'),
      getIceConnectionState: sinon.stub().returns('new'),
      getPeerConnectionState: sinon.stub().returns('new'),
      multistreamConnection: {
        dataChannel: {
          readyState: 'open',
        },
      },
    };

    mediaConnectionAwaiter = new MediaConnectionAwaiter({
      webrtcMediaConnection: mockMC,
      correlationId: 'test-correlation-id',
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
      await mediaConnectionAwaiter.waitForMediaConnectionConnected();

      assert.calledThrice(mockMC.on);
      assert.calledThrice(mockMC.off);
      assert.equal(clock.countTimers(), 0);
    });

    it('rejects after timeout if ice state is not connected', async () => {
      const sendMetricSpy = sinon.spy(Metrics, 'sendBehavioralMetric');

      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('gathering');

      let promiseResolved = false;
      let promiseRejected = false;

      const connectionPromise = mediaConnectionAwaiter
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
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED);
      const iceGatheringListener = mockMC.on.getCall(2).args[1];

      mockMC.getIceGatheringState.returns('complete');
      iceGatheringListener();

      await clock.tickAsync(ICE_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      await connectionPromise;
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);

      assert.calledThrice(mockMC.off);

      assert.calledOnceWithExactly(sendMetricSpy, BEHAVIORAL_METRICS.MEDIA_STILL_NOT_CONNECTED, {
        correlation_id: 'test-correlation-id',
        iceConnected: false,
        iceConnectedAtLeastOnce: false,
        numTransports: 1,
        dtlsState: 'connecting',
        iceState: 'checking',
        packetsSent: 10,
        packetsReceived: 5,
        dataChannelState: 'open',
      });

      sendMetricSpy.restore();
    });

    it('rejects immediately if ice state is FAILED', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('gathering');

      let promiseResolved = false;
      let promiseRejected = false;

      const connectionPromise = mediaConnectionAwaiter
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
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED);
      const iceConnectionListener = mockMC.on.getCall(1).args[1];

      mockMC.getConnectionState.returns(ConnectionState.Failed);
      iceConnectionListener();

      await testUtils.flushPromises();

      await connectionPromise;
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);

      assert.calledThrice(mockMC.off);
    });

    it('rejects after timeout if dtls state is not connected', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('gathering');

      let promiseResolved = false;
      let promiseRejected = false;

      const connectionPromise = mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch((error) => {
          promiseRejected = true;

          const {iceConnected} = error;
          assert.equal(iceConnected, true);
        });

      await testUtils.flushPromises();
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledThrice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED);
      const gatheringStateListener = mockMC.on.getCall(2).args[1];
      const iceConnectionListener = mockMC.on.getCall(1).args[1];

      mockMC.getIceGatheringState.returns('complete');
      gatheringStateListener();

      mockMC.getIceConnectionState.returns('connected');
      iceConnectionListener();

      await clock.tickAsync(DTLS_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      await connectionPromise;
      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);

      assert.calledThrice(mockMC.off);
    });

    it('sets iceConnected=true when ice connection state reaches "completed"', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('complete');

      let promiseRejected = false;
      let rejectedIceConnected;

      mediaConnectionAwaiter
        .waitForMediaConnectionConnected()
        .then(() => {})
        .catch((error) => {
          promiseRejected = true;
          rejectedIceConnected = error.iceConnected;
        });

      await testUtils.flushPromises();

      const iceConnectionListener = mockMC.on.getCall(1).args[1];

      mockMC.getIceConnectionState.returns('completed');
      iceConnectionListener();

      await clock.tickAsync(DTLS_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      assert.equal(promiseRejected, true);
      assert.equal(rejectedIceConnected, true);
    });

    it('switches to the shorter DTLS timeout once ICE connects', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('complete');

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

      // the initial timer uses the longer ICE timeout
      assert.calledOnceWithExactly(setTimeoutSpy, sinon.match.func, ICE_CONNECTION_TIMEOUT);

      const iceConnectionListener = mockMC.on.getCall(1).args[1];

      // ICE connects - the ICE timer should be replaced with the shorter DTLS timer
      mockMC.getIceConnectionState.returns('connected');
      iceConnectionListener();

      assert.calledOnce(clearTimeoutSpy);
      assert.calledTwice(setTimeoutSpy);
      assert.calledWithExactly(setTimeoutSpy.secondCall, sinon.match.func, DTLS_CONNECTION_TIMEOUT);

      // just before the DTLS timeout elapses nothing happens
      await clock.tickAsync(DTLS_CONNECTION_TIMEOUT - 1);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // once the DTLS timeout elapses the promise rejects
      await clock.tickAsync(1);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);
    });

    it('rejects at the DTLS deadline even if ICE gathering has not completed', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceGatheringState.returns('gathering');

      const setTimeoutSpy = sinon.spy(clock, 'setTimeout');
      const failure = mediaConnectionAwaiter.waitForMediaConnectionConnected().then(
        () => assert.fail('Expected DTLS timeout rejection'),
        (error) => error
      );
      const iceConnectionListener = mockMC.on.getCall(1).args[1];

      mockMC.getIceConnectionState.returns('connected');
      iceConnectionListener();
      await clock.tickAsync(DTLS_CONNECTION_TIMEOUT);

      assert.deepEqual(await failure, {iceConnected: true, iceConnectedAtLeastOnce: true});
      assert.calledTwice(setTimeoutSpy);
      assert.calledWithExactly(setTimeoutSpy.lastCall, sinon.match.func, DTLS_CONNECTION_TIMEOUT);
      assert.equal(clock.countTimers(), 0);
    });

    it('resolves when DTLS completes within the shorter DTLS timeout after ICE connects', async () => {
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

      const connectionStateListener = mockMC.on.getCall(0).args[1];
      const iceConnectionListener = mockMC.on.getCall(1).args[1];

      // ICE connects - switches to the DTLS timeout
      mockMC.getIceConnectionState.returns('connected');
      iceConnectionListener();

      // DTLS completes within the DTLS timeout
      await clock.tickAsync(DTLS_CONNECTION_TIMEOUT - 1);
      mockMC.getConnectionState.returns(ConnectionState.Connected);
      connectionStateListener();

      await testUtils.flushPromises();

      assert.equal(promiseResolved, true);
      assert.equal(promiseRejected, false);

      assert.calledThrice(mockMC.off);
    });

    ['connected', 'completed'].forEach((iceState) => {
      it(`initializes iceConnected=true from current ICE state "${iceState}" when starting the await`, async () => {
        mockMC.getConnectionState.returns(ConnectionState.Connecting);
        mockMC.getIceGatheringState.returns('complete');
        mockMC.getIceConnectionState.returns(iceState);

        let promiseRejected = false;
        let rejectedIceConnected;

        mediaConnectionAwaiter
          .waitForMediaConnectionConnected()
          .then(() => {})
          .catch((error) => {
            promiseRejected = true;
            rejectedIceConnected = error.iceConnected;
          });

        // no ICE connection state events fired - the flag should be set from the initial state
        await clock.tickAsync(DTLS_CONNECTION_TIMEOUT);
        await testUtils.flushPromises();

        assert.equal(promiseRejected, true);
        assert.equal(rejectedIceConnected, true);
      });
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
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED);

      mockMC.getConnectionState.returns(ConnectionState.Connected);

      await clock.tickAsync(ICE_CONNECTION_TIMEOUT);
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
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED);
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
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED);
      const listener = mockMC.on.getCall(2).args[1];

      // call the listener and pretend we are now connected
      mockMC.getIceGatheringState.returns('gathering');
      listener();
      assert.notCalled(clearTimeoutSpy);

      mockMC.getConnectionState.returns(ConnectionState.Connected);

      await clock.tickAsync(ICE_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, true);
      assert.equal(promiseRejected, false);

      // check that listener was removed
      assert.calledThrice(mockMC.off);

      assert.calledOnce(clearTimeoutSpy);
      assert.equal(clock.countTimers(), 0);
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
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED);
      const listener = mockMC.on.getCall(2).args[1];

      // call the listener and pretend we are now connected
      mockMC.getIceGatheringState.returns('complete');
      listener();

      assert.calledOnce(clearTimeoutSpy);
      assert.calledTwice(setTimeoutSpy);

      mockMC.getConnectionState.returns(ConnectionState.Connected);

      await clock.tickAsync(ICE_CONNECTION_TIMEOUT);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, true);
      assert.equal(promiseRejected, false);

      // check that listener was removed
      assert.calledThrice(mockMC.off);
    });

    it(`reject with restart timer once if gathering state is not complete`, async () => {
      const sendMetricSpy = sinon.spy(Metrics, 'sendBehavioralMetric');

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
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED);

      await clock.tickAsync(ICE_CONNECTION_TIMEOUT * 2);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);

      // check that listener was removed
      assert.calledThrice(mockMC.off);

      assert.calledTwice(clearTimeoutSpy);
      assert.equal(clock.countTimers(), 0);
      assert.calledTwice(setTimeoutSpy);

      // verify sendMetric was called twice (once for each timeout)
      assert.calledTwice(sendMetricSpy);
      assert.calledWith(sendMetricSpy, BEHAVIORAL_METRICS.MEDIA_STILL_NOT_CONNECTED);

      sendMetricSpy.restore();
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
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(2).args[0], MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED);
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
  describe('connection phases', () => {
    const DTLS_TIME_BEFORE_STATE_CHANGE = Math.floor(DTLS_CONNECTION_TIMEOUT / 2);
    const DTLS_TIME_AFTER_STATE_CHANGE = DTLS_CONNECTION_TIMEOUT - DTLS_TIME_BEFORE_STATE_CHANGE;
    const ICE_RECOVERY_DELAY = Math.floor(ICE_CONNECTION_TIMEOUT / 2);

    const startWait = (iceState = 'checking', gatheringState = 'complete') => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);
      mockMC.getIceConnectionState.returns(iceState);
      mockMC.getIceGatheringState.returns(gatheringState);

      const result = {status: 'pending', error: undefined};
      const promise = mediaConnectionAwaiter.waitForMediaConnectionConnected().then(
        () => {
          result.status = 'resolved';
        },
        (error) => {
          result.status = 'rejected';
          result.error = error;
        }
      );

      return {result, promise};
    };

    const changeIceState = (iceState) => {
      mockMC.getIceConnectionState.returns(iceState);
      mediaConnectionAwaiter.iceConnectionStateHandler();
    };

    const assertCleanedUp = () => {
      assert.equal(clock.countTimers(), 0);
      assert.calledThrice(mockMC.off);
      mockMC.on.getCalls().forEach(({args}) => {
        assert.calledWithExactly(mockMC.off, ...args);
      });
    };

    ['connected', 'completed'].forEach((iceState) => {
      ['disconnected', 'checking', 'new'].forEach((lostState) => {
        it(`gives DTLS a fresh deadline after ${iceState} -> ${lostState} -> connected`, async () => {
          const {result, promise} = startWait(iceState);
          await clock.tickAsync(DTLS_TIME_BEFORE_STATE_CHANGE);
          changeIceState(lostState);
          await clock.tickAsync(ICE_RECOVERY_DELAY);
          assert.equal(result.status, 'pending');
          changeIceState('connected');
          await clock.tickAsync(DTLS_CONNECTION_TIMEOUT - 1);
          assert.equal(result.status, 'pending');

          mockMC.getConnectionState.returns(ConnectionState.Connected);
          mediaConnectionAwaiter.peerConnectionStateHandler();
          await promise;
          assert.equal(result.status, 'resolved');
          assertCleanedUp();
        });
      });
    });

    ['disconnected', 'checking', 'new'].forEach((lostState) => {
      it(`uses the ICE deadline and preserves history after connectivity becomes ${lostState}`, async () => {
        const metric = sinon.stub(Metrics, 'sendBehavioralMetric');
        const {result, promise} = startWait('connected');
        await clock.tickAsync(DTLS_TIME_BEFORE_STATE_CHANGE);
        changeIceState(lostState);
        await clock.tickAsync(ICE_CONNECTION_TIMEOUT - 1);
        assert.equal(result.status, 'pending');
        assert.notCalled(metric);
        await clock.tickAsync(1);
        await promise;
        assert.deepEqual(result.error, {iceConnected: false, iceConnectedAtLeastOnce: true});
        assert.calledOnceWithExactly(
          metric,
          BEHAVIORAL_METRICS.MEDIA_STILL_NOT_CONNECTED,
          sinon.match({iceConnected: false, iceConnectedAtLeastOnce: true})
        );
        assertCleanedUp();
      });
    });

    it('does not extend DTLS for repeated connected or completed events', async () => {
      const {result, promise} = startWait('connected');
      await clock.tickAsync(DTLS_TIME_BEFORE_STATE_CHANGE);
      changeIceState('completed');
      changeIceState('completed');
      changeIceState('connected');
      await clock.tickAsync(DTLS_TIME_AFTER_STATE_CHANGE);
      assert.equal(result.status, 'rejected');
      await promise;
      assert.deepEqual(result.error, {iceConnected: true, iceConnectedAtLeastOnce: true});
      assertCleanedUp();
    });

    it('gives late ICE connectivity the full DTLS deadline', async () => {
      const {result, promise} = startWait();
      await clock.tickAsync(ICE_CONNECTION_TIMEOUT - 1);
      changeIceState('connected');
      await clock.tickAsync(DTLS_CONNECTION_TIMEOUT - 1);
      assert.equal(result.status, 'pending');
      await clock.tickAsync(1);
      await promise;
      assert.deepEqual(result.error, {iceConnected: true, iceConnectedAtLeastOnce: true});
      assertCleanedUp();
    });

    it('does not extend DTLS when gathering completes', async () => {
      const {result, promise} = startWait('connected', 'gathering');
      await clock.tickAsync(DTLS_TIME_BEFORE_STATE_CHANGE);
      mockMC.getIceGatheringState.returns('complete');
      mediaConnectionAwaiter.iceGatheringStateHandler();
      await clock.tickAsync(DTLS_TIME_AFTER_STATE_CHANGE);
      assert.equal(result.status, 'rejected');
      await promise;
      assertCleanedUp();
    });

    ['peerConnectionStateHandler', 'iceGatheringStateHandler', 'onTimeout'].forEach((handler) => {
      it(`detects an unreported ICE connection through ${handler}`, async () => {
        const metric = sinon.stub(Metrics, 'sendBehavioralMetric');
        const {result, promise} = startWait();
        await clock.tickAsync(ICE_CONNECTION_TIMEOUT - 1);
        mockMC.getIceConnectionState.returns('connected');
        if (handler === 'onTimeout') {
          await clock.tickAsync(1);
        } else {
          mediaConnectionAwaiter[handler]();
        }
        assert.notCalled(metric);
        await clock.tickAsync(DTLS_CONNECTION_TIMEOUT - 1);
        assert.equal(result.status, 'pending');
        await clock.tickAsync(1);
        await promise;
        assert.equal(result.status, 'rejected');
        assertCleanedUp();
      });
    });

    it('detects unreported ICE loss when the DTLS timer expires', async () => {
      const metric = sinon.stub(Metrics, 'sendBehavioralMetric');
      const {result, promise} = startWait('connected');
      mockMC.getIceConnectionState.returns('disconnected');
      await clock.tickAsync(DTLS_CONNECTION_TIMEOUT);
      assert.equal(result.status, 'pending');
      assert.notCalled(metric);
      await clock.tickAsync(ICE_CONNECTION_TIMEOUT);
      await promise;
      assert.deepEqual(result.error, {iceConnected: false, iceConnectedAtLeastOnce: true});
      assertCleanedUp();
    });

    ['checking', 'connected'].forEach((iceState) => {
      [false, true].forEach((retryConsumed) => {
        it(`retries incomplete gathering only during ICE with ${iceState}, consumed=${retryConsumed}`, async () => {
          const {result, promise} = startWait('checking', 'gathering');
          if (retryConsumed) {
            await clock.tickAsync(ICE_CONNECTION_TIMEOUT);
          }
          changeIceState(iceState);
          const timeout =
            iceState === 'connected' ? DTLS_CONNECTION_TIMEOUT : ICE_CONNECTION_TIMEOUT;
          await clock.tickAsync(timeout);
          const shouldRetry = iceState === 'checking' && !retryConsumed;
          assert.equal(result.status, shouldRetry ? 'pending' : 'rejected');
          if (shouldRetry) {
            await clock.tickAsync(timeout);
          }
          await promise;
          assert.equal(result.status, 'rejected');
          assertCleanedUp();
        });
      });
    });

    [ConnectionState.Failed, ConnectionState.Closed].forEach((state) => {
      ['checking', 'connected'].forEach((iceState) => {
        it(`rejects initial ${state} immediately with ICE ${iceState}`, async () => {
          mockMC.getConnectionState.returns(state);
          mockMC.getIceConnectionState.returns(iceState);
          const error = await mediaConnectionAwaiter.waitForMediaConnectionConnected().then(
            () => assert.fail('Expected rejection'),
            (failure) => failure
          );
          assert.deepEqual(error, {
            iceConnected: iceState === 'connected',
            iceConnectedAtLeastOnce: iceState === 'connected',
          });
          assert.calledThrice(mockMC.on);
          assertCleanedUp();
        });

        it(`cleans up on ${state} with ICE ${iceState} and ignores late callbacks`, async () => {
          const metric = sinon.stub(Metrics, 'sendBehavioralMetric');
          const {result, promise} = startWait('connected');
          mockMC.getIceConnectionState.returns(iceState);
          mockMC.getConnectionState.returns(state);
          mediaConnectionAwaiter.peerConnectionStateHandler();
          await promise;
          assert.deepEqual(result.error, {
            iceConnected: iceState === 'connected',
            iceConnectedAtLeastOnce: true,
          });
          mediaConnectionAwaiter.iceGatheringStateHandler();
          mediaConnectionAwaiter.iceConnectionStateHandler();
          mediaConnectionAwaiter.onTimeout();
          await clock.tickAsync(ICE_CONNECTION_TIMEOUT * 2);
          assert.notCalled(metric);
          assertCleanedUp();
        });
      });
    });

    it('restarts the ICE deadline when gathering completes after connectivity loss', async () => {
      const {result, promise} = startWait('connected', 'gathering');
      changeIceState('disconnected');
      await clock.tickAsync(ICE_CONNECTION_TIMEOUT - 1);
      mockMC.getIceGatheringState.returns('complete');
      mediaConnectionAwaiter.iceGatheringStateHandler();
      await clock.tickAsync(ICE_CONNECTION_TIMEOUT - 1);
      assert.equal(result.status, 'pending');
      await clock.tickAsync(1);
      await promise;
      assert.deepEqual(result.error, {iceConnected: false, iceConnectedAtLeastOnce: true});
      assertCleanedUp();
    });

    ['connected', 'completed'].forEach((iceState) => {
      it(`resets the ICE gathering retry after recovery through ${iceState}`, async () => {
        const {result, promise} = startWait('checking', 'gathering');
        await clock.tickAsync(ICE_CONNECTION_TIMEOUT);
        assert.equal(result.status, 'pending');
        changeIceState(iceState);
        changeIceState('disconnected');
        await clock.tickAsync(ICE_CONNECTION_TIMEOUT);
        assert.equal(result.status, 'pending');
        await clock.tickAsync(ICE_CONNECTION_TIMEOUT);
        assert.equal(result.status, 'rejected');
        await promise;
        assert.deepEqual(result.error, {iceConnected: false, iceConnectedAtLeastOnce: true});
        assertCleanedUp();
      });
    });

    it('captures connectivity before asynchronous stats complete', async () => {
      const metric = sinon.stub(Metrics, 'sendBehavioralMetric');
      let resolveStats;
      mockMC.getStats.returns(
        new Promise((resolve) => {
          resolveStats = resolve;
        })
      );
      const {promise} = startWait('connected');
      await clock.tickAsync(DTLS_CONNECTION_TIMEOUT);
      await promise;
      mockMC.getIceConnectionState.returns('disconnected');
      resolveStats({values: () => []});
      await testUtils.flushPromises();
      assert.calledOnceWithExactly(
        metric,
        BEHAVIORAL_METRICS.MEDIA_STILL_NOT_CONNECTED,
        sinon.match({iceConnected: true, iceConnectedAtLeastOnce: true})
      );
    });

    it('rejects on deadline even if gathering stats fails', async () => {
      const metric = sinon.stub(Metrics, 'sendBehavioralMetric');
      mockMC.getStats.rejects(new Error('Stats unavailable'));
      const {result, promise} = startWait('connected');
      await clock.tickAsync(DTLS_CONNECTION_TIMEOUT);
      await promise;
      assert.equal(result.status, 'rejected');
      assert.notCalled(metric);
      assertCleanedUp();
    });

    it('registers listeners and starts the deadline only once for repeated waits', async () => {
      const first = mediaConnectionAwaiter.waitForMediaConnectionConnected();
      const second = mediaConnectionAwaiter.waitForMediaConnectionConnected();
      assert.strictEqual(first, second);
      assert.calledThrice(mockMC.on);
      assert.equal(clock.countTimers(), 1);
      mockMC.getConnectionState.returns(ConnectionState.Connected);
      mediaConnectionAwaiter.peerConnectionStateHandler();
      await first;
      assertCleanedUp();
    });
  });
});
