import {assert} from '@webex/test-helper-chai';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import Webinar from '@webex/plugin-meetings/src/webinar';
import MockWebex from '@webex/test-helper-mock-webex';
import uuid from 'uuid';
import sinon from 'sinon';
import {DataChannelTokenType} from '@webex/internal-plugin-llm';
import {LLM_PRACTICE_SESSION, SHARE_STATUS} from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings', () => {
    describe('Webinar', () => {

        let webex;
        let webinar;
        let uuidStub;
        let getUserTokenStub;

        beforeEach(() => {
            // @ts-ignore
            getUserTokenStub = sinon.stub().resolves('test-token');
            uuidStub = sinon.stub(uuid,'v4').returns('test-uuid');
            webex = new MockWebex({});
            webex.internal.mercury.on = sinon.stub();
            webinar = new Webinar({}, {parent: webex});
            webinar.locusUrl = 'locusUrl';
            webinar.webcastInstanceUrl = 'webcastInstanceUrl';
            webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
            webex.meetings = {};
            webex.credentials.getUserToken = getUserTokenStub;
            webex.meetings.getMeetingByType = sinon.stub();
            webex.internal.voicea.announce = sinon.stub();

      webex.internal.llm = {
        getDatachannelToken: sinon.stub().returns(undefined),
        setDatachannelToken: sinon.stub(),
        isDataChannelTokenEnabled: sinon.stub().resolves(false),
        isConnected: sinon.stub().returns(false),
        disconnectLLM: sinon.stub().resolves(),
        off: sinon.stub(),
        on: sinon.stub(),
        getLocusUrl: sinon.stub().returns('old-locus-url'),
        getDatachannelUrl: sinon.stub().returns('old-dc-url'),
        registerAndConnect: sinon.stub().resolves('REGISTER_AND_CONNECT_RESULT'),
      };
        });

        afterEach(() => {
          sinon.restore();
        });

        describe('#locusUrlUpdate', () => {
            it('sets the locus url', () => {
                webinar.locusUrlUpdate('newUrl');

                assert.equal(webinar.locusUrl, 'newUrl');
            });
        });

        describe('#updateWebcastUrl', () => {
            it('sets the webcast instance url', () => {
                webinar.updateWebcastUrl({resources: {webcastInstance: {url:'newUrl'}}});

                assert.equal(webinar.webcastInstanceUrl, 'newUrl');
            });
        });


        describe('#updateCanManageWebcast', () => {
          it('sets the webcast instance url when valid', () => {
            webinar.updateWebcastUrl({resources: {webcastInstance: {url:'newUrl'}}});
            assert.equal(webinar.webcastInstanceUrl, 'newUrl', 'webcast instance URL should be updated');
          });

          it('handles missing resources gracefully', () => {
              webinar.updateWebcastUrl({});
              assert.isUndefined(webinar.webcastInstanceUrl, 'webcast instance URL should be undefined');
          });

          it('handles missing webcastInstance gracefully', () => {
              webinar.updateWebcastUrl({resources: {}});
              assert.isUndefined(webinar.webcastInstanceUrl, 'webcast instance URL should be undefined');
          });

          it('handles missing URL gracefully', () => {
              webinar.updateWebcastUrl({resources: {webcastInstance: {}}});
              assert.isUndefined(webinar.webcastInstanceUrl, 'webcast instance URL should be undefined');
          });
        });

      describe('#updateRoleChanged', () => {
        it('updates roles when promoted from attendee to panelist', () => {
          const payload = {
            oldRoles: ['ATTENDEE'],
            newRoles: ['PANELIST']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, true, 'self should be a panelist');
          assert.equal(webinar.selfIsAttendee, false, 'self should not be an attendee');
          assert.equal(webinar.canManageWebcast, false, 'self should not have manage webcast capability');
          assert.equal(result.isPromoted, true, 'should indicate promotion');
          assert.equal(result.isDemoted, false, 'should not indicate demotion');
        });

        it('updates roles when demoted from panelist to attendee', () => {
          const payload = {
            oldRoles: ['PANELIST'],
            newRoles: ['ATTENDEE']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, false, 'self should not be a panelist');
          assert.equal(webinar.selfIsAttendee, true, 'self should be an attendee');
          assert.equal(webinar.canManageWebcast, false, 'self should not have manage webcast capability');
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, true, 'should indicate demotion');
        });

        it('updates roles when attendee just join meeting', () => {
          const payload = {
            oldRoles: [''],
            newRoles: ['ATTENDEE']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, false, 'self should not be a panelist');
          assert.equal(webinar.selfIsAttendee, true, 'self should be an attendee');
          assert.equal(webinar.canManageWebcast, false, 'self should not have manage webcast capability');
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, true, 'should indicate demotion');
        });

        it('updates roles when promoted to moderator', () => {
          const payload = {
            oldRoles: ['PANELIST'],
            newRoles: ['MODERATOR']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, false, 'self should not be a panelist');
          assert.equal(webinar.selfIsAttendee, false, 'self should not be an attendee');
          assert.equal(webinar.canManageWebcast, true, 'self should have manage webcast capability');
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, false, 'should not indicate demotion');
        });

        it('updates roles when unchanged (remains as panelist)', () => {
          const payload = {
            oldRoles: ['PANELIST'],
            newRoles: ['PANELIST']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, true, 'self should remain a panelist');
          assert.equal(webinar.selfIsAttendee, false, 'self should not be an attendee');
          assert.equal(webinar.canManageWebcast, false, 'self should not have manage webcast capability');
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, false, 'should not indicate demotion');
        });

      it('handles missing role payload safely', () => {
        const updateStatusByRoleStub = sinon.stub(webinar, 'updateStatusByRole');

        const result = webinar.updateRoleChanged(undefined);

        assert.equal(webinar.selfIsPanelist, false);
        assert.equal(webinar.selfIsAttendee, false);
        assert.equal(webinar.canManageWebcast, false);
        assert.deepEqual(result, {isPromoted: false, isDemoted: false});
        assert.calledOnceWithExactly(updateStatusByRoleStub, {isPromoted: false, isDemoted: false});
      });
    });

    describe('#getValidatedWebinarMeeting', () => {
      it('returns the meeting when its locusUrl matches the webinar locusUrl', () => {
        const meeting = {locusUrl: 'locusUrl'};
        webex.meetings.getMeetingByType = sinon.stub().returns(meeting);
        webinar.locusUrl = 'locusUrl';

        assert.equal(webinar.getValidatedWebinarMeeting(), meeting);
      });

      it('returns undefined and warns when the resolved meeting locusUrl does not match', () => {
        const warnStub = sinon.stub(LoggerProxy.logger, 'warn');
        const meeting = {locusUrl: 'other-locus-url'};
        webex.meetings.getMeetingByType = sinon.stub().returns(meeting);
        webinar.locusUrl = 'locusUrl';

        assert.isUndefined(webinar.getValidatedWebinarMeeting());
        assert.calledOnce(warnStub);
      });

      it('returns undefined when no meeting is resolved', () => {
        webex.meetings.getMeetingByType = sinon.stub().returns(undefined);

        assert.isUndefined(webinar.getValidatedWebinarMeeting());
      });

      it('returns undefined and warns when webinar locusUrl is not yet initialized', () => {
        const warnStub = sinon.stub(LoggerProxy.logger, 'warn');
        const meeting = {locusUrl: 'some-url'};
        webex.meetings.getMeetingByType = sinon.stub().returns(meeting);
        webinar.locusUrl = undefined;

        assert.isUndefined(webinar.getValidatedWebinarMeeting());
        assert.calledOnce(warnStub);
      });
    });

    describe('#cleanUp', () => {
      it('delegates to cleanupPSDataChannel', () => {
        const cleanupPSDataChannelStub = sinon.stub(webinar, 'cleanupPSDataChannel').resolves();

        webinar.cleanUp();

        assert.calledOnceWithExactly(cleanupPSDataChannelStub);
      });
    });

    describe('#cleanupPSDataChannel', () => {
      let relayListener;

      beforeEach(() => {
        relayListener = sinon.stub();
        webinar._practiceSessionRelayListener = relayListener;
      });

      it('disconnects the practice session channel and removes the tracked relay listener', async () => {
        await webinar.cleanupPSDataChannel();

        assert.calledOnceWithExactly(
          webex.internal.llm.disconnectLLM,
          {code: 3050, reason: 'done (permanent)'},
          LLM_PRACTICE_SESSION
        );
        assert.calledOnceWithExactly(
          webex.internal.llm.off,
          `event:relay.event:${LLM_PRACTICE_SESSION}`,
          relayListener
        );
        assert.isNull(webinar._practiceSessionRelayListener);
      });

      it('skips relay listener removal when no listener has been tracked', async () => {
        webinar._practiceSessionRelayListener = null;

        await webinar.cleanupPSDataChannel();

        const relayOffCalls = webex.internal.llm.off.args.filter(
          ([event]) => event === `event:relay.event:${LLM_PRACTICE_SESSION}`
        );
        assert.equal(relayOffCalls.length, 0);
      });

      it('does not consult the meeting collection during cleanup', async () => {
        webex.meetings.getMeetingByType = sinon.stub();

        await webinar.cleanupPSDataChannel();

        assert.notCalled(webex.meetings.getMeetingByType);
      });

      it('removes a pending online listener if one exists', async () => {
        const listener = sinon.stub();
        webinar._pendingOnlineListener = listener;

        await webinar.cleanupPSDataChannel();

        assert.calledWith(webex.internal.llm.off, 'online', listener);
        assert.isNull(webinar._pendingOnlineListener);
      });

      it('skips online listener removal when none is pending', async () => {
        webinar._pendingOnlineListener = null;

        await webinar.cleanupPSDataChannel();

        // 'off' should only be called for the relay event, not for 'online'
        const onlineOffCalls = webex.internal.llm.off.args.filter(([event]) => event === 'online');
        assert.equal(onlineOffCalls.length, 0);
      });
    });

    describe('#updatePSDataChannel', () => {
      let meeting;
      let processRelayEvent;

      beforeEach(() => {
        processRelayEvent = sinon.stub();
        meeting = {
          locusUrl: 'locusUrl',
          isJoined: sinon.stub().returns(true),
          processRelayEvent,
          locusInfo: {
            url: 'locus-url',
            info: {practiceSessionDatachannelUrl: 'dc-url'},
          },
        };

        webex.meetings.getMeetingByType = sinon.stub().returns(meeting);

        // Default session is connected by default; practice session is not
        webex.internal.llm.isConnected = sinon.stub().callsFake((sessionId) => {
          return sessionId !== LLM_PRACTICE_SESSION;
        });

        // Token is pre-saved into LLM by saveDataChannelToken
        webex.internal.llm.getDatachannelToken = sinon.stub().callsFake((tokenType) => {
          if (tokenType === DataChannelTokenType.PracticeSession) return 'ps-token';
          return undefined;
        });

        // Ensure connect path is eligible
        webinar.selfIsPanelist = true;
        webinar.practiceSessionEnabled = true;
        webex.internal.voicea.getIsCaptionBoxOn = sinon.stub().returns(false);
        webex.internal.voicea.updateSubchannelSubscriptions = sinon.stub();
      });

      it('refreshes practice-session token before register when cached token is missing', async () => {
        webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
        webex.internal.llm.getDatachannelToken = sinon.stub().callsFake((tokenType) => {
          if (tokenType === DataChannelTokenType.PracticeSession) return undefined;

          return undefined;
        });
        meeting.refreshDataChannelToken = sinon.stub().resolves({
          body: {
            datachannelToken: 'ps-token-from-refresh',
            dataChannelTokenType: DataChannelTokenType.PracticeSession,
          },
        });

        await webinar.updatePSDataChannel();

        assert.calledOnceWithExactly(meeting.refreshDataChannelToken);
        assert.calledWithExactly(
          webex.internal.llm.setDatachannelToken,
          'ps-token-from-refresh',
          DataChannelTokenType.PracticeSession
        );
        assert.calledWith(
          webex.internal.llm.registerAndConnect,
          'locus-url',
          'dc-url',
          'ps-token-from-refresh',
          LLM_PRACTICE_SESSION
        );
      });

      it('does not reconnect if practice-session eligibility changes during async token refresh', async () => {
        webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
        webex.internal.llm.getDatachannelToken = sinon.stub().returns(undefined);

        let resolveRefresh;
        meeting.refreshDataChannelToken = sinon.stub().returns(
          new Promise((resolve) => {
            resolveRefresh = resolve;
          })
        );

        const updatePromise = webinar.updatePSDataChannel();

        webinar.practiceSessionEnabled = false;

        resolveRefresh({
          body: {
            datachannelToken: 'stale-ps-token',
            dataChannelTokenType: DataChannelTokenType.PracticeSession,
          },
        });

        const result = await updatePromise;

        assert.isUndefined(result);
        assert.notCalled(webex.internal.llm.registerAndConnect);
      });

      it('no-ops when practice session join eligibility is false', async () => {
        webinar.practiceSessionEnabled = false;
        const cleanupPSDataChannelStub = sinon.stub(webinar, 'cleanupPSDataChannel').resolves();

        const result = await webinar.updatePSDataChannel();

        assert.isUndefined(result);
        assert.calledOnceWithExactly(cleanupPSDataChannelStub);
        assert.notCalled(webex.internal.llm.registerAndConnect);
      });

      it('no-ops when meeting is not joined', async () => {
        meeting.isJoined.returns(false);
        const cleanupPSDataChannelStub = sinon.stub(webinar, 'cleanupPSDataChannel').resolves();

        const result = await webinar.updatePSDataChannel();

        assert.isUndefined(result);
        assert.calledOnceWithExactly(cleanupPSDataChannelStub);
        assert.notCalled(webex.internal.llm.registerAndConnect);
      });

      it('no-ops when practiceSessionDatachannelUrl is missing', async () => {
        meeting.locusInfo.info.practiceSessionDatachannelUrl = undefined;

        const result = await webinar.updatePSDataChannel();

        assert.isUndefined(result);
        assert.notCalled(webex.internal.llm.registerAndConnect);
      });

      it('no-ops when already connected to the same endpoints', async () => {
        webex.internal.llm.isConnected.returns(true);
        webex.internal.llm.getLocusUrl.returns('locus-url');
        webex.internal.llm.getDatachannelUrl.returns('dc-url');
        const cleanupPSDataChannelStub = sinon.stub(webinar, 'cleanupPSDataChannel').resolves();

        const result = await webinar.updatePSDataChannel();

        assert.isUndefined(result);
        assert.notCalled(cleanupPSDataChannelStub);
        assert.notCalled(webex.internal.llm.registerAndConnect);
      });

      it('connects when eligible', async () => {
        const result = await webinar.updatePSDataChannel();

        assert.calledOnce(webex.internal.llm.registerAndConnect);
        assert.calledWith(
          webex.internal.llm.registerAndConnect,
          'locus-url',
          'dc-url',
          'ps-token',
          LLM_PRACTICE_SESSION
        );
        assert.calledOnceWithExactly(webex.internal.voicea.announce);
        assert.equal(result, 'REGISTER_AND_CONNECT_RESULT');
      });

      it('uses token from LLM', async () => {
        webex.internal.llm.getDatachannelToken = sinon.stub().callsFake((tokenType) => {
          if (tokenType === DataChannelTokenType.PracticeSession) return 'cached-token';
          return undefined;
        });

        await webinar.updatePSDataChannel();

        assert.calledWithExactly(
          webex.internal.llm.getDatachannelToken,
          DataChannelTokenType.PracticeSession
        );
        assert.notCalled(webex.internal.llm.setDatachannelToken);
        assert.calledWith(
          webex.internal.llm.registerAndConnect,
          'locus-url',
          'dc-url',
          'cached-token',
          LLM_PRACTICE_SESSION
        );
      });

      it('cleans up the existing practice session channel before reconnecting to new endpoints', async () => {
        webex.internal.llm.isConnected.returns(true);
        const cleanupPSDataChannelStub = sinon.stub(webinar, 'cleanupPSDataChannel').resolves();

        await webinar.updatePSDataChannel();

        assert.calledOnceWithExactly(cleanupPSDataChannelStub);
        assert.calledOnce(webex.internal.llm.registerAndConnect);
      });

      it('tracks and binds the relay listener after successful connect', async () => {
        await webinar.updatePSDataChannel();

        // Stores the exact listener reference for deterministic cleanup
        assert.equal(webinar._practiceSessionRelayListener, processRelayEvent);
        assert.calledWith(
          webex.internal.llm.on,
          `event:relay.event:${LLM_PRACTICE_SESSION}`,
          processRelayEvent
        );
      });

      it('removes a previously tracked relay listener before re-binding on reconnect', async () => {
        const previousListener = sinon.stub();
        webinar._practiceSessionRelayListener = previousListener;

        await webinar.updatePSDataChannel();

        assert.calledWith(
          webex.internal.llm.off,
          `event:relay.event:${LLM_PRACTICE_SESSION}`,
          previousListener
        );
        assert.equal(webinar._practiceSessionRelayListener, processRelayEvent);
      });

      it('subscribes to transcription when caption intent is enabled', async () => {
        webex.internal.voicea.getIsCaptionBoxOn = sinon.stub().returns(true);

        await webinar.updatePSDataChannel();

        assert.calledOnceWithExactly(webex.internal.voicea.updateSubchannelSubscriptions, { subscribe: ['transcription'] });
      });

      it('does not subscribe to transcription when caption intent is disabled', async () => {
        webex.internal.voicea.getIsCaptionBoxOn = sinon.stub().returns(false);

        await webinar.updatePSDataChannel();

        assert.notCalled(webex.internal.voicea.updateSubchannelSubscriptions);
      });

      it('defers connect when default session is not yet connected', async () => {
        // Default session is not connected initially
        webex.internal.llm.isConnected = sinon.stub().returns(false);

        const result = await webinar.updatePSDataChannel();

        // Should return undefined immediately (deferred)
        assert.isUndefined(result);
        // Should register an 'online' listener but NOT call registerAndConnect yet
        assert.calledWith(webex.internal.llm.on, 'online', sinon.match.func);
        assert.notCalled(webex.internal.llm.registerAndConnect);
        // Should store the pending listener
        assert.isNotNull(webinar._pendingOnlineListener);
      });

      it('does not register duplicate online listeners on repeated calls', async () => {
        webex.internal.llm.isConnected = sinon.stub().returns(false);

        await webinar.updatePSDataChannel();
        await webinar.updatePSDataChannel();
        await webinar.updatePSDataChannel();

        // Only one 'online' listener should have been registered
        const onlineCalls = webex.internal.llm.on.args.filter(([event]) => event === 'online');
        assert.equal(onlineCalls.length, 1, 'should register exactly one online listener');
      });

      it('re-invokes updatePSDataChannel when default session comes online', async () => {
        // Default session is not connected initially
        webex.internal.llm.isConnected = sinon.stub().returns(false);

        const updatePSDataChannelSpy = sinon.spy(webinar, 'updatePSDataChannel');

        // First call defers
        await webinar.updatePSDataChannel();

        // Capture the 'online' listener
        const onlineCall = webex.internal.llm.on.args.find(([event]) => event === 'online');
        assert.isDefined(onlineCall, 'should have registered an online listener');

        // Now simulate default session coming online
        webex.internal.llm.isConnected = sinon.stub().callsFake((sessionId) => {
          return sessionId !== LLM_PRACTICE_SESSION;
        });

        // Fire the captured listener
        onlineCall[1]();

        // The listener should have cleared itself, removed itself, and re-called updatePSDataChannel
        assert.isNull(webinar._pendingOnlineListener);
        assert.calledWith(webex.internal.llm.off, 'online', sinon.match.func);
        assert.equal(updatePSDataChannelSpy.callCount, 2);
      });

      it('does not reconnect with stale data if demoted before default session comes online', async () => {
        // Default session is not connected initially
        webex.internal.llm.isConnected = sinon.stub().returns(false);

        await webinar.updatePSDataChannel();

        // Capture the 'online' listener
        const onlineCall = webex.internal.llm.on.args.find(([event]) => event === 'online');
        assert.isDefined(onlineCall);

        // Simulate demotion while waiting
        webinar.selfIsPanelist = false;

        // Now default session comes online
        webex.internal.llm.isConnected = sinon.stub().callsFake((sessionId) => {
          return sessionId !== LLM_PRACTICE_SESSION;
        });

        // Fire the listener — re-invokes updatePSDataChannel which will see isPracticeSession = false
        onlineCall[1]();

        // Should NOT have called registerAndConnect since the user is no longer eligible
        assert.notCalled(webex.internal.llm.registerAndConnect);
      });

      it('proceeds immediately when default session is already connected', async () => {
        // Default session already connected, practice session not
        webex.internal.llm.isConnected = sinon.stub().callsFake((sessionId) => {
          return sessionId !== LLM_PRACTICE_SESSION;
        });

        const result = await webinar.updatePSDataChannel();

        // The 'online' listener is registered then immediately removed since default session is already connected
        assert.calledWith(webex.internal.llm.on, 'online', sinon.match.func);
        assert.calledWith(webex.internal.llm.off, 'online', sinon.match.func);
        assert.isNull(webinar._pendingOnlineListener);
        assert.calledOnce(webex.internal.llm.registerAndConnect);
        assert.equal(result, 'REGISTER_AND_CONNECT_RESULT');
      });
      });

      describe('#updateStatusByRole', () => {
        let updateMediaShares;
        beforeEach(() => {
          updateMediaShares = sinon.stub()
          webinar.webex.meetings = {
            getMeetingByType: sinon.stub().returns({
              id: 'meeting-id', locusUrl: 'locusUrl',
              isJoined: sinon.stub().returns(false),
              updateLLMConnection: sinon.stub(),
              shareStatus: SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE,
              locusInfo: {
                mediaShares: 'mediaShares',
                updateMediaShares: updateMediaShares
              }
            })
          };
        });

        afterEach(() => {
          sinon.restore();
        });

        it('trigger updateMediaShares if promoted', () => {

          const roleChange = {isPromoted: true, isDemoted: false};

          webinar.updateStatusByRole(roleChange);

          assert.calledOnceWithExactly(updateMediaShares, 'mediaShares', true);
        });

        it('Not trigger updateMediaShares if no role change', () => {

          const roleChange = {isPromoted: false, isDemoted: false};

          webinar.updateStatusByRole(roleChange);

          assert.notCalled(updateMediaShares);
        });
        it('trigger updateMediaShares if is promoted', () => {

          const roleChange = {isPromoted: true, isDemoted: false};

          webinar.updateStatusByRole(roleChange);

          assert.calledOnceWithExactly(updateMediaShares, 'mediaShares', true);
        });

        it('trigger updateMediaShares if is attendee with whiteboard share', () => {

          const roleChange = {isPromoted: false, isDemoted: true};

          webinar.updateStatusByRole(roleChange);

          assert.calledOnceWithExactly(updateMediaShares, 'mediaShares', true);
        });

        it('Not trigger updateMediaShares if is attendee with screen share', () => {

          webinar.webex.meetings = {
            getMeetingByType: sinon.stub().returns({
              id: 'meeting-id', locusUrl: 'locusUrl',
              isJoined: sinon.stub().returns(false),
              updateLLMConnection: sinon.stub(),
              shareStatus: SHARE_STATUS.REMOTE_SHARE_ACTIVE,
              locusInfo: {
                mediaShares: 'mediaShares',
                updateMediaShares: updateMediaShares
              }
            })
          };

          const roleChange = {isPromoted: false, isDemoted: true};

          webinar.updateStatusByRole(roleChange);

          assert.notCalled(updateMediaShares);
        });

      it('updates PS data channel based on join eligibility', () => {
        const updatePSDataChannelStub = sinon.stub(webinar, 'updatePSDataChannel').resolves();

        webinar.updateStatusByRole({isPromoted: false, isDemoted: false});

        assert.calledOnceWithExactly(updatePSDataChannelStub);
      });
      });

      describe("#setPracticeSessionState", () => {
        [true, false].forEach((enabled) => {
          it(`sends a PATCH request to ${enabled ? "enable" : "disable"} the practice session`, async () => {
            const result = await webinar.setPracticeSessionState(enabled);
            assert.calledOnce(webex.request);
            assert.calledWith(webex.request, {
              method: "PATCH",
              uri: `${webinar.locusUrl}/controls`,
              body: {
                practiceSession: { enabled }
              }
            });
            assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
          });
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.setPracticeSessionState(true);
            assert.fail('setPracticeSessionState should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#setPracticeSessionState failed', sinon.match.instanceOf(Error));
          }

          errorLogger.restore();
        });
      });

      describe('#isJoinPracticeSessionDataChannel', () => {
        it('check whether should join PS data channel', () => {
          webinar.selfIsPanelist = true;
          webinar.practiceSessionEnabled = false;

          assert.equal(webinar.isJoinPracticeSessionDataChannel(), false);

          webinar.selfIsPanelist = true;
          webinar.practiceSessionEnabled = true;

          assert.equal(webinar.isJoinPracticeSessionDataChannel(), true);

          webinar.selfIsPanelist = false;
          webinar.practiceSessionEnabled = false;

          assert.equal(webinar.isJoinPracticeSessionDataChannel(), false);

          webinar.selfIsPanelist = false;
          webinar.practiceSessionEnabled = true;

          assert.equal(webinar.isJoinPracticeSessionDataChannel(), false);
        });
      });

      describe('#updatePracticeSessionStatus', () => {
        it('sets PS state true', () => {
          webinar.updatePracticeSessionStatus({enabled: true});

          assert.equal(webinar.practiceSessionEnabled, true);
        });
        it('sets PS state true', () => {
          webinar.updatePracticeSessionStatus({enabled: false});

          assert.equal(webinar.practiceSessionEnabled, false);
        });
        it('sets PS state when payload is undefined', () => {
          webinar.updatePracticeSessionStatus(undefined);

          assert.equal(webinar.practiceSessionEnabled, false);
        });
      it('triggers PS data channel update using computed eligibility', () => {
        webinar.selfIsPanelist = true;
        const updatePSDataChannelStub = sinon.stub(webinar, 'updatePSDataChannel').resolves();

        webinar.updatePracticeSessionStatus({enabled: true});

        assert.calledOnceWithExactly(updatePSDataChannelStub);
      });
      });

      describe("#startWebcast", () => {
        const meeting = {
          locusId: 'locusId',
          correlationId: 'correlationId',
        }
        const layout = {
          videoLayout: 'Prominent',
          contentLayout: 'Prominent',
          syncStageLayout: false,
          syncStageInMeeting: false,
        }
        it(`sends a PUT request to start the webcast`, async () => {
          const result = await webinar.startWebcast(meeting, layout);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "PUT",
            uri: `${webinar.webcastInstanceUrl}/streaming`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
              'Content-Type': 'application/json'
            },
            body: {
              action: 'start',
              meetingInfo: {
                locusId: meeting.locusId,
                correlationId: meeting.correlationId,
              },
              layout,
            }
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('should handle undefined meeting parameter', async () => {
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.startWebcast(undefined, layout);
            assert.fail('startWebcast should throw an error');
          } catch (error) {
            assert.equal(error.message, 'Meeting parameter does not meet expectations', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, `Meeting:webinar#startWebcast failed --> meeting parameter : ${undefined}`);
          } finally {
            errorLogger.restore();
          }
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.startWebcast(meeting, layout);
            assert.fail('startWebcast should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#startWebcast failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe("#stopWebcast", () => {
        it(`sends a PUT request to stop the webcast`, async () => {
          const result = await webinar.stopWebcast();
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "PUT",
            uri: `${webinar.webcastInstanceUrl}/streaming`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
              'Content-Type': 'application/json'
            },
            body: {
              action: 'stop',
            }
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.stopWebcast();
            assert.fail('stopWebcast should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#stopWebcast failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });


      describe("#queryWebcastLayout", () => {
        it(`sends a GET request to query the webcast layout`, async () => {
          const result = await webinar.queryWebcastLayout();
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/layout`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.queryWebcastLayout();
            assert.fail('queryWebcastLayout should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#queryWebcastLayout failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe("#updateWebcastLayout", () => {
        const layout = {
          videoLayout: 'Prominent',
          contentLayout: 'Prominent',
          syncStageLayout: false,
          syncStageInMeeting: false,
        }
        it(`sends a PUT request to update the webcast layout`, async () => {
          const result = await webinar.updateWebcastLayout(layout);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "PUT",
            uri: `${webinar.webcastInstanceUrl}/layout`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
              'Content-Type': 'application/json'
            },
            body: {
              ...layout
            }
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.updateWebcastLayout(layout);
            assert.fail('updateWebcastLayout should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#updateWebcastLayout failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe("#searchWebcastAttendees", () => {
        const queryString = 'queryString';
        const specialCharsQuery = 'query@string!';
        const emptyQuery = '';

        it("sends a GET request to search the webcast attendees", async () => {
          const result = await webinar.searchWebcastAttendees(queryString);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(queryString)}`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.searchWebcastAttendees(queryString);
            assert.fail('searchWebcastAttendees should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#searchWebcastAttendees failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });

        it("should handle empty query string", async () => {
          const result = await webinar.searchWebcastAttendees(emptyQuery);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(emptyQuery)}`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it("should handle query string with special characters", async () => {
          const result = await webinar.searchWebcastAttendees(specialCharsQuery);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(specialCharsQuery)}`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });
      });


      describe("#viewAllWebcastAttendees", () => {
        it(`sends a GET request to view all the webcast attendees`, async () => {
          const result = await webinar.viewAllWebcastAttendees();
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/attendees`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.viewAllWebcastAttendees();
            assert.fail('viewAllWebcastAttendees should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#viewAllWebcastAttendees failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe("#expelWebcastAttendee", () => {
        const participantId = 'participantId'
        it(`sends a DELETE request to expel the webcast attendee`, async () => {
          const result = await webinar.expelWebcastAttendee(participantId);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "DELETE",
            uri: `${webinar.webcastInstanceUrl}/attendees/${participantId}`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.expelWebcastAttendee(participantId);
            assert.fail('expelWebcastAttendee should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#expelWebcastAttendee failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe("#searchLargeScaleWebinarAttendees", () => {
        const attendeeSearchUrl = 'https://locusUrl/attendees/search';
        const params = {
          queryString: 'queryString',
          limit: 50,
          next: null,
        };
        beforeEach(() => {
          // @ts-ignore
          webinar.webex.meetings = {
            getMeetingByType: sinon.stub().returns({
              id: 'meeting-id', locusUrl: 'locusUrl',
              locusInfo: {
                links:{
                  resources: {
                    attendeeSearch: {
                      url: attendeeSearchUrl
                    }
                  }
                }
              }
            })
          };
        });

        it('throws an error if attendeeSearchUrl is not available', async () => {
          webinar.webex.meetings = {
            getMeetingByType: sinon.stub().returns({
              id: 'meeting-id', locusUrl: 'locusUrl',
              locusInfo: {
                links:{
                  resources: {
                    attendeeSearch: {
                      url: null
                    }
                  }
                }
              }
            })
          };
          try {
            await webinar.searchLargeScaleWebinarAttendees(params);
            assert.fail('searchLargeScaleWebinarAttendees should throw an error');
          } catch (error) {
            assert.equal(error.message,'Meeting:webinar5k#Attendee search url is not available', 'should throw the correct error');
          }
        });

        it('sends a GET request to search the large scale webinar attendees', async () => {
          const result = await webinar.searchLargeScaleWebinarAttendees(params);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'GET',
            uri: `${attendeeSearchUrl}?search_text=${encodeURIComponent(params.queryString)}&limit=50`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(
            result,
            'REQUEST_RETURN_VALUE',
            'should return the resolved value from the request'
          );
        });

        it('queryString is empty string', async () => {
          params.queryString = '';
          const result = await webinar.searchLargeScaleWebinarAttendees(params);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'GET',
            uri: `${attendeeSearchUrl}?limit=50`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(
            result,
            'REQUEST_RETURN_VALUE',
            'should return the resolved value from the request'
          );
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.searchLargeScaleWebinarAttendees(params);
            assert.fail('searchLargeScaleWebinarAttendees should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(
              errorLogger,
              'Meeting:webinar5k#searchLargeScaleWebinarAttendees failed',
              sinon.match.instanceOf(Error)
            );
          } finally {
            errorLogger.restore();
          }
        });
      });
    })
})
