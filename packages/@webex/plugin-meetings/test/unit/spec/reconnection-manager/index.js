import 'jsdom-global/register';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {Defer} from '@webex/common';
import ReconnectionManager from '@webex/plugin-meetings/src/reconnection-manager';
import ReconnectionNotStartedError from '@webex/plugin-meetings/src/common/errors/reconnection-not-started';
import TriggerProxy from '@webex/plugin-meetings/src/common/events/trigger-proxy';
import Metrics from '@webex/plugin-meetings/src/metrics';
import { RECONNECTION } from '../../../../src/constants';
import LoggerProxy from '../../../../src/common/logs/logger-proxy';
import LoggerConfig from '../../../../src/common/logs/logger-config';
const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('plugin-meetings', () => {
  describe('ReconnectionManager.reconnect', () => {
    let fakeMediaConnection;
    let fakeMeeting;
    let loggerSpy;

    beforeEach(() => {
      LoggerConfig.set({ enable: false });
      LoggerProxy.set();
      loggerSpy = sinon.spy(LoggerProxy.logger, 'info');

      fakeMediaConnection = {
        initiateOffer: sinon.stub().resolves({}),
        reconnect: sinon.stub().resolves({}),
      };
      fakeMeeting = {
        closePeerConnections: sinon.stub().resolves({}),
        createMediaConnection: sinon.stub().returns(fakeMediaConnection),
        correlationId: 'correlationId',
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
        locusUrl: 'test/id',
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
              urls: ['fake_turn_url1', 'fake_turn_url2'],
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
            startReachability: sinon.stub().resolves({}),
          },
          internal: {
            newMetrics: {
              submitClientEvent: sinon.stub()
            }
          }
        },
        trigger: sinon.stub(),
      };

      sinon.stub(TriggerProxy, 'trigger').returns(true);
      sinon.stub(Metrics, 'sendBehavioralMetric');
    });

    afterEach(() => {
      sinon.reset();
      sinon.restore();
    });

    it('calls syncMeetings', async () => {
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledOnce(rm.webex.meetings.syncMeetings);
      assert.calledWith(rm.webex.meetings.syncMeetings, {keepOnlyLocusMeetings: false});
    });

    it('calls startReachability on reconnect', async () => {
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledOnce(rm.webex.meetings.startReachability);
    });

    it('continues with reconnection attempt if startReachability throws an error', async () => {
      const reachabilityError = new Error();
      fakeMeeting.webex.meetings.startReachability = sinon.stub().throws(reachabilityError);

      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledOnce(rm.webex.meetings.startReachability);
      assert.calledWith(loggerSpy, 'ReconnectionManager:index#reconnect --> Reachability failed, continuing with reconnection attempt, err: ', reachabilityError);
      assert.calledWith(loggerSpy, 'ReconnectionManager:index#executeReconnection --> Attempting to reconnect to meeting.');
    });

    it('uses correct TURN TLS information on the reconnection', async () => {
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledOnce(fakeMeeting.roap.doTurnDiscovery);
      assert.calledWith(fakeMeeting.roap.doTurnDiscovery, fakeMeeting, true, true);
      assert.calledOnce(fakeMediaConnection.reconnect);
      assert.calledWith(fakeMediaConnection.reconnect, [
        {
          urls: ['fake_turn_url1', 'fake_turn_url2'],
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

    // this can happen when we land on a video mesh node
    it('does not use TURN server if TURN urls is an empty array', async () => {
      const rm = new ReconnectionManager(fakeMeeting);

      fakeMeeting.roap.doTurnDiscovery.resolves({
        turnServerInfo: {
          urls: [],
          username: 'whatever',
          password: 'whatever',
        },
        turnDiscoverySkippedReason: undefined,
      });

      await rm.reconnect();

      assert.calledOnce(fakeMeeting.roap.doTurnDiscovery);
      assert.calledWith(fakeMeeting.roap.doTurnDiscovery, fakeMeeting, true, true);
      assert.calledOnce(fakeMediaConnection.reconnect);
      assert.calledWith(fakeMediaConnection.reconnect, []);

      assert.calledWith(fakeMeeting.webex.internal.newMetrics.submitClientEvent, {
        name: 'client.media.reconnecting',
        options: {
          meetingId: rm.meeting.id,
        },
      });
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

    describe('media requests', () => {
      let task1;
      let task2;

      const sendMediaRequests = (rm) => {
        rm.sendMediaRequest('task1', task1);
        rm.sendMediaRequest('task2', task2);
      };

      beforeEach(() => {
        task1 = sinon.stub();
        task2 = sinon.stub();
      });

      it('sends media requests immediately when reconnection is not in progress', () => {
        const rm = new ReconnectionManager(fakeMeeting);

        sendMediaRequests(rm);

        assert.calledOnceWithExactly(task1);
        assert.calledOnceWithExactly(task2);
      });

      it('defers media requests until reconnection succeeds and sends them in order before success event', async () => {
        const rm = new ReconnectionManager(fakeMeeting);
        const completionCallback = sinon.stub().callsFake(async () => {
          assert.notCalled(task1);
          assert.notCalled(task2);
        });

        fakeMediaConnection.reconnect.callsFake(async () => sendMediaRequests(rm));

        await rm.reconnect({}, completionCallback);

        assert.calledOnceWithExactly(completionCallback);
        assert.calledOnceWithExactly(task1);
        assert.calledOnceWithExactly(task2);
        sinon.assert.callOrder(completionCallback, task1, task2);
        assert.isTrue(
          task2.calledBefore(
            TriggerProxy.trigger.withArgs(
              fakeMeeting,
              sinon.match.any,
              'meeting:reconnectionSuccess'
            )
          )
        );
      });

      it('discards deferred media requests when reconnection fails', async () => {
        const rm = new ReconnectionManager(fakeMeeting);

        fakeMediaConnection.reconnect.callsFake(async () => sendMediaRequests(rm));

        await assert.isRejected(rm.reconnect({}, sinon.stub().rejects(new Error('fake error'))));

        assert.notCalled(task1);
        assert.notCalled(task2);

        sendMediaRequests(rm);

        assert.calledOnceWithExactly(task1);
        assert.calledOnceWithExactly(task2);
      });

      it('keeps media requests deferred across network retries', async () => {
        const rm = new ReconnectionManager(fakeMeeting);

        fakeMeeting.webex.internal.device = {url: 'fake-device-url'};
        fakeMeeting.webex.internal.mercury = {
          connected: false,
          connect: sinon.stub().resolves(),
        };
        fakeMeeting.webex.meetings.syncMeetings.onFirstCall().callsFake(async () => {
          rm.sendMediaRequest('task1', task1);
          throw new Error('fake sync error');
        });
        fakeMediaConnection.reconnect.callsFake(async () => rm.sendMediaRequest('task2', task2));

        await rm.reconnect();

        assert.calledTwice(fakeMeeting.webex.meetings.syncMeetings);
        assert.calledOnceWithExactly(task1);
        assert.calledOnceWithExactly(task2);
        sinon.assert.callOrder(task1, task2);
      });

      it('sends deferred media requests after successful auto rejoin', async () => {
        fakeMeeting.state = 'LEFT';
        fakeMeeting.config.reconnection.autoRejoin = true;
        const rm = new ReconnectionManager(fakeMeeting);

        sinon.stub(rm, 'rejoinMeeting').callsFake(async () => {
          sendMediaRequests(rm);
          assert.notCalled(task1);
        });

        await rm.reconnect();

        assert.calledOnceWithExactly(task1);
        assert.calledOnceWithExactly(task2);
        sinon.assert.callOrder(task1, task2);
      });

      it('discards deferred media requests on cleanUp', async () => {
        const rm = new ReconnectionManager(fakeMeeting);
        const defer = new Defer();

        fakeMediaConnection.reconnect.callsFake(async () => {
          rm.sendMediaRequest('task1', task1);
          await defer.promise;
        });

        const reconnectPromise = rm.reconnect();

        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.calledOnce(fakeMediaConnection.reconnect);
        rm.cleanUp();
        defer.resolve();
        await reconnectPromise;

        assert.notCalled(task1);
      });
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

    it('sends the right metrics and events when succeeds', async () => {
      const rm = new ReconnectionManager(fakeMeeting);

      await rm.reconnect();

      assert.calledWith(
        TriggerProxy.trigger,
        fakeMeeting,
        {file: 'reconnection-manager/index', function: 'reconnect'},
        'meeting:reconnectionSuccess'
      );
      assert.calledWithMatch(fakeMeeting.webex.internal.newMetrics.submitClientEvent, {
        name: 'client.media.recovered',
        payload: {
          recoveredBy: 'new',
        },
        options: {
          meetingId: fakeMeeting.id,
        },
      });
      assert.equal(rm.status, RECONNECTION.STATE.DEFAULT_STATUS);
    });

    it('sends the right metrics and events when fails', async () => {
      const rm = new ReconnectionManager(fakeMeeting);

      sinon.stub(rm, 'executeReconnection').rejects(new Error('fake error'));

      await assert.isRejected(rm.reconnect());

      assert.calledWith(
        TriggerProxy.trigger,
        fakeMeeting,
        {file: 'reconnection-manager/index', function: 'reconnect'},
        'meeting:reconnectionFailure'
      );
      assert.calledWithMatch(fakeMeeting.webex.internal.newMetrics.submitClientEvent, {
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
          meetingId: fakeMeeting.id,
        },
      });
      assert.calledWith(Metrics.sendBehavioralMetric, 'js_sdk_meeting_reconnect_failures', {
        correlation_id: fakeMeeting.correlationId,
        locus_id: 'id',
        reason: 'fake error',
        stack: sinon.match.any,
      });
      assert.equal(rm.status, RECONNECTION.STATE.DEFAULT_STATUS);
    });

    it('throws ReconnectionNotStartedError if reconnection is already in progress', async () => {
      const rm = new ReconnectionManager(fakeMeeting);
      const defer = new Defer();

      sinon.stub(rm, 'executeReconnection').returns(defer.promise);

      rm.reconnect();

      try {
        await rm.reconnect();

        fail("rm.reconnect() should have thrown, but it hasn't");
      } catch (e) {
        assert.instanceOf(e, ReconnectionNotStartedError);
      }
    });

    it('throws ReconnectionNotStartedError if reconnection is disabled in config', async () => {
      fakeMeeting.config.reconnection.enabled = false;

      const rm = new ReconnectionManager(fakeMeeting);

      try {
        await rm.reconnect();

        fail("rm.reconnect() should have thrown, but it hasn't");
      } catch (e) {
        assert.instanceOf(e, ReconnectionNotStartedError);
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
        let clock;

        beforeEach(() => {
          clock = sinon.useFakeTimers();
          reconnectionManager.iceState.disconnected = false;
        });

        afterEach(() => {
          clock.restore();
        });

        it('should set the disconnected state to true', () => {
          const promise = reconnectionManager.waitForIceReconnect();

          assert.isTrue(reconnectionManager.iceState.disconnected);

          // we let the timer expire
          clock.tick(reconnectionManager.iceState.timeoutDuration);
          assert.isRejected(promise);
        });

        it('should return a promise that rejects after a duration', async () => {
          const promise = reconnectionManager.waitForIceReconnect();

          // we let the timer expire
          clock.tick(reconnectionManager.iceState.timeoutDuration);
          assert.isRejected(promise);
        });

        it('should resolve when ICE is reconnected', async () => {
          const promise = reconnectionManager.waitForIceReconnect();

          reconnectionManager.iceReconnected();

          await promise;
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
