import 'jsdom-global/register';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ReconnectionManager from '@webex/plugin-meetings/src/reconnection-manager';
import { RECONNECTION } from '../../../../src/constants';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('plugin-meetings', () => {
  describe('ReconnectionManager.reconnect', () => {
    let fakeMediaConnection;
    let fakeMeeting;

    beforeEach(() => {
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
          audio: {commit: sinon.stub(), clearPreviousRequests: sinon.stub()},
          video: {commit: sinon.stub(), clearPreviousRequests: sinon.stub()},
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
          credentials: {
            isUnverifiedGuest: false,
          },
          meetings: {
            getMeetingByType: sinon.stub().returns(true),
            syncMeetings: sinon.stub().resolves({}),
          },
          internal: {
            newMetrics: {
              submitClientEvent: sinon.stub()
            }
          }
        },
      };
    });

    it('syncs meetings', async () => {
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledOnce(rm.webex.meetings.syncMeetings);
      assert.calledWith(rm.webex.meetings.syncMeetings, {keepOnlyLocusMeetings: false});
    });

    it('uses correct TURN TLS information on the reconnection', async () => {
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledOnce(fakeMeeting.roap.doTurnDiscovery);
      assert.calledWith(fakeMeeting.roap.doTurnDiscovery, fakeMeeting, true, true);
      assert.calledOnce(fakeMediaConnection.reconnect);
      assert.calledWith(fakeMediaConnection.reconnect, [
        {
          urls: 'fake_turn_url',
          username: 'fake_turn_username',
          credential: 'fake_turn_password',
        },
      ]);

      assert.calledWith(fakeMeeting.webex.internal.newMetrics.submitClientEvent, {
        name: 'client.media.reconnecting',
        options: {
          meetingId: rm.meeting.id,
        },
      });
    });

    it('does not clear previous requests and re-request media for non-multistream meetings', async () => {
      fakeMeeting.isMultistream = false;
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.notCalled(fakeMeeting.mediaRequestManagers.audio.clearPreviousRequests);
      assert.notCalled(fakeMeeting.mediaRequestManagers.video.clearPreviousRequests);
      assert.notCalled(fakeMeeting.mediaRequestManagers.audio.commit);
      assert.notCalled(fakeMeeting.mediaRequestManagers.video.commit);
    });

    it('does clear previous requests and re-request media for multistream meetings', async () => {
      fakeMeeting.isMultistream = true;
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledOnce(fakeMeeting.mediaRequestManagers.audio.clearPreviousRequests);
      assert.calledOnce(fakeMeeting.mediaRequestManagers.video.clearPreviousRequests);
      assert.calledOnce(fakeMeeting.mediaRequestManagers.audio.commit);
      assert.calledOnce(fakeMeeting.mediaRequestManagers.video.commit);
    });


    it('sends the correct client event when reconnection fails', async () => {
      sinon.stub(ReconnectionManager.prototype, 'executeReconnection').rejects();
      fakeMeeting.isMultistream = true;
      const rm = new ReconnectionManager(fakeMeeting);

      try {
        await rm.reconnect();
      } catch (err) {
        assert.calledWith(fakeMeeting.webex.internal.newMetrics.submitClientEvent, {
          name: 'client.call.aborted',
          payload: {
            errors: [
              {
                category: 'expected',
                errorCode: 2008,
                fatal: true,
                name: 'media-engine',
                shownToUser: false,
              },
            ],
          },
          options: {
            meetingId: rm.meeting.id,
          },
        });
      }
    });
  });

  /**
   * Currently, testing dependent classes that aren't available at the top
   * level causes testing errors in CI based around related files. Skipping this here until a solution
   * to this problem is generated.
   */
  describe('ReconnectionManager', () => {
    let reconnectionManager;
    let fakeMeeting;

    beforeEach(() => {
      fakeMeeting = {
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
      };

      reconnectionManager = new ReconnectionManager(fakeMeeting);
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

        it('should return a promise that rejects after a duration', (done) => {
          reconnectionManager.iceState.timeoutDuration = 100;

          assert.isRejected(reconnectionManager.waitForIceReconnect());
          done();
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

    describe('setStatus()', () => {
      beforeEach(() => {
        reconnectionManager.status = RECONNECTION.STATE.DEFAULT_STATUS;
      });

      it('should correctly change status to in progress', () => {
        reconnectionManager.setStatus(RECONNECTION.STATE.IN_PROGRESS);

        assert.equal(reconnectionManager.status, RECONNECTION.STATE.IN_PROGRESS);
      });

      it('should correctly change status to complete', () => {
        reconnectionManager.setStatus(RECONNECTION.STATE.COMPLETE);

        assert.equal(reconnectionManager.status, RECONNECTION.STATE.COMPLETE);
      });

      it('should correctly change status to failure', () => {
        reconnectionManager.setStatus(RECONNECTION.STATE.FAILURE);

        assert.equal(reconnectionManager.status, RECONNECTION.STATE.FAILURE);
      });
    });

    describe('cleanUp()', () => {
      it('should call reset and keep reference to meeting object', () => {
        const resetSpy = sinon.spy(reconnectionManager, 'reset');
        assert.equal(reconnectionManager.meeting, fakeMeeting);

        reconnectionManager.cleanUp();

        assert.equal(reconnectionManager.meeting, fakeMeeting);
        assert.calledOnce(reconnectionManager.reset);
      });
    });
  });
});
