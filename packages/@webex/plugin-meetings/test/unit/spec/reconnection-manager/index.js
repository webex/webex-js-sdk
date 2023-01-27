import 'jsdom-global/register';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ReconnectionManager from '@webex/plugin-meetings/src/reconnection-manager';
import Metrics from '@webex/plugin-meetings/src/metrics';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('plugin-meetings', () => {
  describe('ReconnectionManager.reconnect', () => {
    let fakeMediaConnection;
    let fakeMeeting;

    beforeEach(() => {
      Metrics.postEvent = sinon.stub();
      fakeMediaConnection = {
        initiateOffer: sinon.stub().resolves({}),
        reconnect: sinon.stub().resolves({}),
      };
      fakeMeeting = {
        closePeerConnections: sinon.stub().resolves({}),
        createMediaConnection: sinon.stub().returns(fakeMediaConnection),
        config: {
          reconnection: {
            enabled: true,
            detection: true,
            iceReconnectionTimeout: 10000,
            retry: {
              times: 2,
              backOff: {
                start: 1000,
                rate: 2,
              },
            },
          },
        },
        mediaProperties: {
          unsetPeerConnection: sinon.stub(),
          webrtcMediaConnection: fakeMediaConnection,
        },
        mediaRequestManagers: {
          audio: {commit: sinon.stub()},
          video: {commit: sinon.stub()},
        },
        roap: {
          doTurnDiscovery: sinon.stub().resolves({
            turnServerInfo: {
              url: 'fake_turn_url',
              username: 'fake_turn_username',
              password: 'fake_turn_password',
            },
            turnDiscoverySkippedReason: undefined,
          }),
        },
        statsAnalyzer: {
          updateMediaConnection: sinon.stub(),
        },
        webex: {
          meetings: {
            getMeetingByType: sinon.stub().returns(true),
            syncMeetings: sinon.stub().resolves({}),
          },
        },
      };
    });

    it('uses correct TURN TLS information on the reconnection', async () => {
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledOnce(fakeMeeting.roap.doTurnDiscovery);
      assert.calledOnce(fakeMediaConnection.reconnect);
      assert.calledWith(fakeMediaConnection.reconnect, [
        {
          urls: 'fake_turn_url',
          username: 'fake_turn_username',
          credential: 'fake_turn_password',
        },
      ]);
    });

    it('does not re-request media for non-multistream meetings', async () => {
      fakeMeeting.isMultistream = false;
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.notCalled(fakeMeeting.mediaRequestManagers.audio.commit);
      assert.notCalled(fakeMeeting.mediaRequestManagers.video.commit);
    });

    it('does re-request media for multistream meetings', async () => {
      fakeMeeting.isMultistream = true;
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledOnce(fakeMeeting.mediaRequestManagers.audio.commit);
      assert.calledOnce(fakeMeeting.mediaRequestManagers.video.commit);
    });
  });

  /**
   * Currently, testing dependent classes that aren't available at the top
   * level causes testing errors in CI based around related files. Skipping this here until a solution
   * to this problem is generated.
   */
  describe.skip('ReconnectionManager', () => {
    let reconnectionManager;

    beforeEach(() => {
      reconnectionManager = new ReconnectionManager({
        config: {
          reconnection: {
            enabled: true,
            detection: true,
            iceReconnectionTimeout: 10000,
            retry: {
              times: 2,
              backOff: {
                start: 1000,
                rate: 2,
              },
            },
          },
        },
      });
    });

    describe('iceReconnected()', () => {
      describe('when ice is marked as disconnected', () => {
        beforeEach(() => {
          reconnectionManager.iceState.disconnected = true;
        });

        it('should set disconnected to false', () => {
          reconnectionManager.iceState.resolve = () => {};

          reconnectionManager.iceReconnected();

          assert.isFalse(reconnectionManager.iceState.disconnected);
        });

        it('should resolve the deferred promise', () => {
          reconnectionManager.iceState.resolve = sinon.spy();
          const {resolve} = reconnectionManager.iceState;

          reconnectionManager.iceReconnected();

          assert.isTrue(resolve.called);
        });

        it('should clear the reconnect timer', () => {
          reconnectionManager.iceState.resolve = () => {};
          reconnectionManager.iceState.timer = 1234;

          reconnectionManager.iceReconnected();

          assert.isUndefined(reconnectionManager.iceState.timer);
        });
      });

      describe('when ice is marked as connected', () => {
        beforeEach(() => {
          reconnectionManager.iceState.disconnected = false;
        });

        it('should not clear the timer', () => {
          const timerValue = 1234;

          reconnectionManager.iceState.resolve = () => {};
          reconnectionManager.iceState.timer = timerValue;

          reconnectionManager.iceReconnected();

          assert.equal(reconnectionManager.iceState.timer, timerValue);
        });

        it('should not resolve the deferred promise', () => {
          reconnectionManager.iceState.resolve = sinon.spy();

          reconnectionManager.iceReconnected();

          assert.isTrue(reconnectionManager.iceState.resolve.notCalled);
        });
      });
    });

    describe('waitForIceReconnect()', () => {
      describe('when ice is marked as not disconnected', () => {
        beforeEach(() => {
          reconnectionManager.iceState.disconnected = false;
        });

        it('should set the disconnected state to true', () => {
          reconnectionManager.waitForIceReconnect();

          assert.isTrue(reconnectionManager.iceState.disconnected);
        });

        it('should return a promise that rejects after a duration', () => {
          reconnectionManager.iceState.timeoutDuration = 100;

          return assert.isRejected(reconnectionManager.waitForIceReconnect());
        });

        it('should resolve return a resolved promise when triggered', () => {
          const promise = reconnectionManager.waitForIceReconnect();

          reconnectionManager.iceState.resolve();

          assert.isFulfilled(promise);
        });
      });

      describe('when ice is marked as disconnected', () => {
        beforeEach(() => {
          reconnectionManager.iceState.disconnected = true;
        });

        it('should return a resolved promise', () => {
          assert.isFulfilled(reconnectionManager.waitForIceReconnect());
        });

        it('should not set the disconnected state to false', () => {
          reconnectionManager.waitForIceReconnect();

          assert.isTrue(reconnectionManager.iceState.disconnected);
        });
      });
    });
  });
});
