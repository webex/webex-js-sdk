import {assert} from '@webex/test-helper-chai';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import Webinar from '@webex/plugin-meetings/src/webinar';
import MockWebex from '@webex/test-helper-mock-webex';
import uuid from 'uuid';
import sinon from 'sinon';
import {DataChannelTokenType} from '@webex/internal-plugin-llm';
import {LOCUS_LLM_EVENT, SHARE_STATUS} from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings', () => {
    describe('Webinar', () => {
      let webex;
      let webinar;
      let uuidStub;
      let getUserTokenStub;

      /**
       * Creates a mock LLM channel with all the expected methods
       */
      function createMockLLMChannel(overrides = {}) {
        return {
          registerAndConnect: sinon.stub().resolves('REGISTER_AND_CONNECT_RESULT'),
          disconnect: sinon.stub().resolves(),
          isConnected: sinon.stub().returns(false),
          isConnecting: sinon.stub().returns(false),
          getLocusUrl: sinon.stub().returns(undefined),
          getDatachannelUrl: sinon.stub().returns(undefined),
          getDatachannelToken: sinon.stub().returns(undefined),
          setDatachannelToken: sinon.stub(),
          getBinding: sinon.stub().returns(undefined),
          setRefreshHandler: sinon.stub(),
          on: sinon.stub(),
          off: sinon.stub(),
          ...overrides,
        };
      }

      beforeEach(() => {
        // @ts-ignore
        getUserTokenStub = sinon.stub().resolves('test-token');
        uuidStub = sinon.stub(uuid, 'v4').returns('test-uuid');
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

        // Factory pattern: createChannel returns a mock channel
        webex.internal.llm = {
          isDataChannelTokenEnabled: sinon.stub().resolves(false),
          createChannel: sinon.stub().callsFake(() => createMockLLMChannel()),
        };

        // Mock voicea createChannel for practice session
        webex.internal.voicea.createChannel = sinon.stub().callsFake(() => ({
          on: sinon.stub(),
          off: sinon.stub(),
          announce: sinon.stub(),
          turnOnCaptions: sinon.stub().resolves(),
          deregisterEvents: sinon.stub(),
          getIsCaptionBoxOn: sinon.stub().returns(false),
          updateSubchannelSubscriptions: sinon.stub(),
        }));
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
          webinar.updateWebcastUrl({resources: {webcastInstance: {url: 'newUrl'}}});

          assert.equal(webinar.webcastInstanceUrl, 'newUrl');
        });
      });

      describe('#updateCanManageWebcast', () => {
        it('sets the webcast instance url when valid', () => {
          webinar.updateWebcastUrl({resources: {webcastInstance: {url: 'newUrl'}}});
          assert.equal(
            webinar.webcastInstanceUrl,
            'newUrl',
            'webcast instance URL should be updated'
          );
        });

        it('handles missing resources gracefully', () => {
          webinar.updateWebcastUrl({});
          assert.isUndefined(
            webinar.webcastInstanceUrl,
            'webcast instance URL should be undefined'
          );
        });

        it('handles missing webcastInstance gracefully', () => {
          webinar.updateWebcastUrl({resources: {}});
          assert.isUndefined(
            webinar.webcastInstanceUrl,
            'webcast instance URL should be undefined'
          );
        });

        it('handles missing URL gracefully', () => {
          webinar.updateWebcastUrl({resources: {webcastInstance: {}}});
          assert.isUndefined(
            webinar.webcastInstanceUrl,
            'webcast instance URL should be undefined'
          );
        });
      });

      describe('#updateRoleChanged', () => {
        it('updates roles when promoted from attendee to panelist', () => {
          const payload = {
            oldRoles: ['ATTENDEE'],
            newRoles: ['PANELIST'],
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, true, 'self should be a panelist');
          assert.equal(webinar.selfIsAttendee, false, 'self should not be an attendee');
          assert.equal(
            webinar.canManageWebcast,
            false,
            'self should not have manage webcast capability'
          );
          assert.equal(result.isPromoted, true, 'should indicate promotion');
          assert.equal(result.isDemoted, false, 'should not indicate demotion');
        });

        it('updates roles when demoted from panelist to attendee', () => {
          const payload = {
            oldRoles: ['PANELIST'],
            newRoles: ['ATTENDEE'],
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, false, 'self should not be a panelist');
          assert.equal(webinar.selfIsAttendee, true, 'self should be an attendee');
          assert.equal(
            webinar.canManageWebcast,
            false,
            'self should not have manage webcast capability'
          );
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, true, 'should indicate demotion');
        });

        it('updates roles when attendee just join meeting', () => {
          const payload = {
            oldRoles: [''],
            newRoles: ['ATTENDEE'],
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, false, 'self should not be a panelist');
          assert.equal(webinar.selfIsAttendee, true, 'self should be an attendee');
          assert.equal(
            webinar.canManageWebcast,
            false,
            'self should not have manage webcast capability'
          );
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, true, 'should indicate demotion');
        });

        it('updates roles when promoted to moderator', () => {
          const payload = {
            oldRoles: ['PANELIST'],
            newRoles: ['MODERATOR'],
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, false, 'self should not be a panelist');
          assert.equal(webinar.selfIsAttendee, false, 'self should not be an attendee');
          assert.equal(
            webinar.canManageWebcast,
            true,
            'self should have manage webcast capability'
          );
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, false, 'should not indicate demotion');
        });

        it('updates roles when unchanged (remains as panelist)', () => {
          const payload = {
            oldRoles: ['PANELIST'],
            newRoles: ['PANELIST'],
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, true, 'self should remain a panelist');
          assert.equal(webinar.selfIsAttendee, false, 'self should not be an attendee');
          assert.equal(
            webinar.canManageWebcast,
            false,
            'self should not have manage webcast capability'
          );
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
          assert.calledOnceWithExactly(updateStatusByRoleStub, {
            isPromoted: false,
            isDemoted: false,
          });
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

      describe('#getPracticeSessionBinding', () => {
        it('returns binding when practice session channel exists and is connected', () => {
          const mockChannel = createMockLLMChannel({
            getBinding: sinon.stub().returns('test-binding-123'),
          });
          webinar._practiceSessionLLMChannel = mockChannel;

          const binding = webinar.getPracticeSessionBinding();

          assert.equal(binding, 'test-binding-123');
          assert.calledOnce(mockChannel.getBinding);
        });

        it('returns undefined when no practice session channel exists', () => {
          webinar._practiceSessionLLMChannel = undefined;

          const binding = webinar.getPracticeSessionBinding();

          assert.isUndefined(binding);
        });
      });

      describe('#getPracticeSessionLocusUrl', () => {
        it('returns locus URL when practice session channel exists', () => {
          const mockChannel = createMockLLMChannel({
            getLocusUrl: sinon.stub().returns('https://locus.example.com/practice'),
          });
          webinar._practiceSessionLLMChannel = mockChannel;

          const locusUrl = webinar.getPracticeSessionLocusUrl();

          assert.equal(locusUrl, 'https://locus.example.com/practice');
          assert.calledOnce(mockChannel.getLocusUrl);
        });

        it('returns undefined when no practice session channel exists', () => {
          webinar._practiceSessionLLMChannel = undefined;

          const locusUrl = webinar.getPracticeSessionLocusUrl();

          assert.isUndefined(locusUrl);
        });
      });

      describe('#ensurePracticeSessionDatachannelToken', () => {
        let meeting;

        beforeEach(() => {
          meeting = {
            refreshDataChannelToken: sinon.stub().resolves({
              body: {datachannelToken: 'refreshed-token'},
            }),
          };
        });

        it('returns undefined when data channel token is not enabled', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(false);

          const token = await webinar.ensurePracticeSessionDatachannelToken(meeting);

          assert.isUndefined(token);
          assert.notCalled(meeting.refreshDataChannelToken);
        });

        it('returns cached token from channel when available', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
          const mockChannel = createMockLLMChannel({
            getDatachannelToken: sinon.stub().returns('cached-channel-token'),
          });
          webinar._practiceSessionLLMChannel = mockChannel;

          const token = await webinar.ensurePracticeSessionDatachannelToken(meeting);

          assert.equal(token, 'cached-channel-token');
          assert.notCalled(meeting.refreshDataChannelToken);
        });

        it('returns pending token when available', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
          webinar._pendingPracticeSessionDatachannelToken = 'pending-token';

          const token = await webinar.ensurePracticeSessionDatachannelToken(meeting);

          assert.equal(token, 'pending-token');
          assert.notCalled(meeting.refreshDataChannelToken);
        });

        it('refreshes token when no cached token exists', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
          webinar._practiceSessionLLMChannel = undefined;
          webinar._pendingPracticeSessionDatachannelToken = undefined;

          const token = await webinar.ensurePracticeSessionDatachannelToken(meeting);

          assert.equal(token, 'refreshed-token');
          assert.calledOnce(meeting.refreshDataChannelToken);
        });

        it('stores refreshed token on channel when channel exists', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
          const mockChannel = createMockLLMChannel({
            getDatachannelToken: sinon.stub().returns(undefined),
            setDatachannelToken: sinon.stub(),
          });
          webinar._practiceSessionLLMChannel = mockChannel;

          await webinar.ensurePracticeSessionDatachannelToken(meeting);

          assert.calledOnceWithExactly(mockChannel.setDatachannelToken, 'refreshed-token');
        });

        it('stores refreshed token as pending when no channel exists', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
          webinar._practiceSessionLLMChannel = undefined;
          webinar._pendingPracticeSessionDatachannelToken = undefined;

          await webinar.ensurePracticeSessionDatachannelToken(meeting);

          assert.equal(webinar._pendingPracticeSessionDatachannelToken, 'refreshed-token');
        });

        it('returns undefined and logs warning when refresh fails', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
          webinar._practiceSessionLLMChannel = undefined;
          webinar._pendingPracticeSessionDatachannelToken = undefined;
          meeting.refreshDataChannelToken.rejects(new Error('refresh failed'));
          const warnStub = sinon.stub(LoggerProxy.logger, 'warn');

          const token = await webinar.ensurePracticeSessionDatachannelToken(meeting);

          assert.isUndefined(token);
          assert.calledOnce(warnStub);
        });

        it('returns undefined when refresh returns no token', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
          webinar._practiceSessionLLMChannel = undefined;
          webinar._pendingPracticeSessionDatachannelToken = undefined;
          meeting.refreshDataChannelToken.resolves({body: {}});

          const token = await webinar.ensurePracticeSessionDatachannelToken(meeting);

          assert.isUndefined(token);
        });
      });

      describe('#cleanupPSDataChannel', () => {
        let mockPSChannel;
        let meeting;
        let mockVoiceaChannel;

        beforeEach(() => {
          webinar.meetingId = 'meeting-id';
          mockPSChannel = createMockLLMChannel();
          webinar._practiceSessionLLMChannel = mockPSChannel;
          mockVoiceaChannel = {
            switchLLMChannel: sinon.stub().resolves(),
          };
          meeting = {
            id: 'meeting-id',
            locusUrl: 'locusUrl',
            processRelayEvent: sinon.stub(),
            processLocusLLMEvent: sinon.stub(),
            handleLLMOnline: sinon.stub(),
            llmChannel: createMockLLMChannel(),
            voiceaChannel: mockVoiceaChannel,
            annotation: {registerChannel: sinon.stub()},
            trigger: sinon.stub(),
          };
          webex.meetings.getMeetingByType = sinon.stub().returns(meeting);
        });

        it('disconnects the practice session channel and removes listeners', async () => {
          await webinar.cleanupPSDataChannel();

          assert.calledOnceWithExactly(mockPSChannel.disconnect, {
            code: 3050,
            reason: 'done (permanent)',
          });
          assert.calledWithExactly(
            mockPSChannel.off,
            'event:relay.event',
            meeting.processRelayEvent
          );
          assert.calledWithExactly(
            mockPSChannel.off,
            LOCUS_LLM_EVENT,
            meeting.processLocusLLMEvent
          );
          assert.calledWithExactly(mockPSChannel.off, 'online', meeting.handleLLMOnline);
          assert.isUndefined(webinar._practiceSessionLLMChannel);
        });

        it('switches annotation back to meeting default channel after cleanup', async () => {
          await webinar.cleanupPSDataChannel();

          assert.calledOnceWithExactly(meeting.annotation.registerChannel, meeting.llmChannel);
        });

        it('removes listeners even when disconnect throws', async () => {
          const disconnectError = new Error('disconnect failed');
          mockPSChannel.disconnect.rejects(disconnectError);

          let caughtError;
          try {
            await webinar.cleanupPSDataChannel();
          } catch (error) {
            caughtError = error;
          }

          assert.equal(caughtError, disconnectError);
          assert.calledWithExactly(
            mockPSChannel.off,
            'event:relay.event',
            meeting.processRelayEvent
          );
          assert.calledWithExactly(
            mockPSChannel.off,
            LOCUS_LLM_EVENT,
            meeting.processLocusLLMEvent
          );
          assert.isUndefined(webinar._practiceSessionLLMChannel);
        });

        it('removes a pending online listener if one exists', async () => {
          const listener = sinon.stub();
          webinar._pendingOnlineListener = listener;

          await webinar.cleanupPSDataChannel();

          assert.calledWith(meeting.llmChannel.off, 'online', listener);
          assert.isNull(webinar._pendingOnlineListener);
        });

        it('no-ops when no practice session channel exists', async () => {
          webinar._practiceSessionLLMChannel = undefined;

          await webinar.cleanupPSDataChannel();

          // Should not throw and should complete successfully
          assert.notCalled(mockPSChannel.disconnect);
        });

        it('switches voicea channel back to main meeting LLM channel', async () => {
          await webinar.cleanupPSDataChannel();

          assert.calledOnceWithExactly(mockVoiceaChannel.switchLLMChannel, meeting.llmChannel);
        });

        it('does not switch voicea channel when meeting has no voiceaChannel', async () => {
          meeting.voiceaChannel = undefined;

          await webinar.cleanupPSDataChannel();

          // Should not throw - cleanup should continue without voicea switch
          assert.calledOnce(mockPSChannel.disconnect);
        });
      });

      describe('#updatePSDataChannel', () => {
        let meeting;
        let mockPSChannel;
        let mockVoiceaChannel;

        beforeEach(() => {
          webinar.meetingId = 'meeting-id';
          mockPSChannel = createMockLLMChannel({
            isConnected: sinon.stub().returns(false),
            getLocusUrl: sinon.stub().returns('old-locus-url'),
            getDatachannelUrl: sinon.stub().returns('old-dc-url'),
            getDatachannelToken: sinon.stub().callsFake((tokenType) => {
              if (tokenType === DataChannelTokenType.PracticeSession) return 'ps-token';
              return undefined;
            }),
          });
          mockVoiceaChannel = {
            switchLLMChannel: sinon.stub().resolves(),
          };

          // Default session channel on the meeting
          const mockDefaultChannel = createMockLLMChannel({
            isConnected: sinon.stub().returns(true),
          });

          meeting = {
            id: 'meeting-id',
            locusUrl: 'locusUrl',
            isJoined: sinon.stub().returns(true),
            processRelayEvent: sinon.stub(),
            processLocusLLMEvent: sinon.stub(),
            handleLLMOnline: sinon.stub(),
            llmChannel: mockDefaultChannel,
            voiceaChannel: mockVoiceaChannel,
            annotation: {registerChannel: sinon.stub()},
            locusInfo: {
              url: 'locus-url',
              info: {practiceSessionDatachannelUrl: 'dc-url'},
            },
            refreshDataChannelToken: sinon.stub().resolves({
              body: {
                datachannelToken: 'ps-token',
                dataChannelTokenType: DataChannelTokenType.PracticeSession,
              },
            }),
            voiceaListenerCallbacks: {},
            trigger: sinon.stub(),
          };

          webex.meetings.getMeetingByType = sinon.stub().returns(meeting);
          webex.internal.llm.createChannel = sinon.stub().returns(mockPSChannel);

          // Ensure connect path is eligible
          webinar.selfIsPanelist = true;
          webinar.practiceSessionEnabled = true;

          // Set a pending token so the channel can connect without requiring token refresh
          webinar._pendingPracticeSessionDatachannelToken = 'ps-token';
        });

        it('refreshes practice-session token before register when cached token is missing', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
          webinar._pendingPracticeSessionDatachannelToken = undefined; // Clear the pending token

          await webinar.updatePSDataChannel();

          assert.calledOnceWithExactly(meeting.refreshDataChannelToken);
          assert.calledWith(
            mockPSChannel.registerAndConnect,
            'locus-url',
            'dc-url',
            'ps-token' // Token from refreshDataChannelToken
          );
        });

        it('does not reconnect if practice-session eligibility changes during async token refresh', async () => {
          webex.internal.llm.isDataChannelTokenEnabled.resolves(true);
          mockPSChannel.getDatachannelToken.returns(undefined);

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
          assert.notCalled(mockPSChannel.registerAndConnect);
        });

        it('no-ops when practice session join eligibility is false', async () => {
          webinar.practiceSessionEnabled = false;
          const cleanupPSDataChannelStub = sinon.stub(webinar, 'cleanupPSDataChannel').resolves();

          const result = await webinar.updatePSDataChannel();

          assert.isUndefined(result);
          assert.calledOnceWithExactly(cleanupPSDataChannelStub);
          assert.notCalled(mockPSChannel.registerAndConnect);
        });

        it('no-ops when meeting is not joined', async () => {
          meeting.isJoined.returns(false);
          const cleanupPSDataChannelStub = sinon.stub(webinar, 'cleanupPSDataChannel').resolves();

          const result = await webinar.updatePSDataChannel();

          assert.isUndefined(result);
          assert.calledOnceWithExactly(cleanupPSDataChannelStub);
          assert.notCalled(mockPSChannel.registerAndConnect);
        });

        it('no-ops when practiceSessionDatachannelUrl is missing', async () => {
          meeting.locusInfo.info.practiceSessionDatachannelUrl = undefined;

          const result = await webinar.updatePSDataChannel();

          assert.isUndefined(result);
          assert.notCalled(webex.internal.llm.createChannel);
        });

        it('no-ops when already connected to the same endpoints', async () => {
          // Set up existing channel already connected to same endpoints
          const existingChannel = createMockLLMChannel({
            isConnected: sinon.stub().returns(true),
            getLocusUrl: sinon.stub().returns('locus-url'),
            getDatachannelUrl: sinon.stub().returns('dc-url'),
          });
          webinar._practiceSessionLLMChannel = existingChannel;
          const cleanupPSDataChannelStub = sinon.stub(webinar, 'cleanupPSDataChannel').resolves();

          const result = await webinar.updatePSDataChannel();

          assert.isUndefined(result);
          assert.notCalled(cleanupPSDataChannelStub);
          assert.notCalled(webex.internal.llm.createChannel);
        });

        it('connects when eligible', async () => {
          const result = await webinar.updatePSDataChannel();

          assert.calledOnce(webex.internal.llm.createChannel);
          assert.calledWith(mockPSChannel.registerAndConnect, 'locus-url', 'dc-url', 'ps-token');
          assert.equal(result, 'REGISTER_AND_CONNECT_RESULT');
        });

        it('sets up refresh handler on the channel', async () => {
          await webinar.updatePSDataChannel();

          assert.calledOnce(mockPSChannel.setRefreshHandler);
          // The refresh handler should call meeting.refreshDataChannelToken
          const refreshHandler = mockPSChannel.setRefreshHandler.firstCall.args[0];
          refreshHandler();
          assert.calledOnce(meeting.refreshDataChannelToken);
        });

        it('registers event listeners on the practice session channel', async () => {
          await webinar.updatePSDataChannel();

          assert.calledWith(mockPSChannel.on, 'event:relay.event', meeting.processRelayEvent);
          assert.calledWith(mockPSChannel.on, LOCUS_LLM_EVENT, meeting.processLocusLLMEvent);
          assert.calledWith(mockPSChannel.on, 'online', meeting.handleLLMOnline);
        });

        it('switches annotation to practice session channel after connect', async () => {
          await webinar.updatePSDataChannel();

          assert.calledOnceWithExactly(meeting.annotation.registerChannel, mockPSChannel);
        });

        it('cleans up the existing practice session channel before reconnecting to new endpoints', async () => {
          // Set up existing channel connected to different endpoints
          const existingChannel = createMockLLMChannel({
            isConnected: sinon.stub().returns(true),
            getLocusUrl: sinon.stub().returns('old-locus-url'),
            getDatachannelUrl: sinon.stub().returns('old-dc-url'),
          });
          webinar._practiceSessionLLMChannel = existingChannel;
          const cleanupPSDataChannelStub = sinon.stub(webinar, 'cleanupPSDataChannel').resolves();

          await webinar.updatePSDataChannel();

          assert.calledOnceWithExactly(cleanupPSDataChannelStub);
          assert.calledOnce(mockPSChannel.registerAndConnect);
        });

        it('switches voicea channel to practice session LLM channel after connect', async () => {
          await webinar.updatePSDataChannel();

          assert.calledOnceWithExactly(mockVoiceaChannel.switchLLMChannel, mockPSChannel);
        });

        it('does not call switchLLMChannel when meeting has no voiceaChannel', async () => {
          meeting.voiceaChannel = undefined;

          await webinar.updatePSDataChannel();

          // Should complete without error
          assert.calledOnce(mockPSChannel.registerAndConnect);
        });

        it('defers connect when default session is not yet connected', async () => {
          // Default session is not connected initially
          meeting.llmChannel.isConnected.returns(false);

          const result = await webinar.updatePSDataChannel();

          // Should return undefined immediately (deferred)
          assert.isUndefined(result);
          // Should register an 'online' listener but NOT call registerAndConnect yet
          assert.calledWith(meeting.llmChannel.on, 'online', sinon.match.func);
          assert.notCalled(mockPSChannel.registerAndConnect);
          // Should store the pending listener
          assert.isNotNull(webinar._pendingOnlineListener);
        });

        it('does not register duplicate online listeners on repeated calls', async () => {
          meeting.llmChannel.isConnected.returns(false);

          await webinar.updatePSDataChannel();
          await webinar.updatePSDataChannel();
          await webinar.updatePSDataChannel();

          // Only one 'online' listener should have been registered
          const onlineCalls = meeting.llmChannel.on.args.filter(([event]) => event === 'online');
          assert.equal(onlineCalls.length, 1, 'should register exactly one online listener');
        });

        it('re-invokes updatePSDataChannel when default session comes online', async () => {
          meeting.llmChannel.isConnected.returns(false);

          const updatePSDataChannelSpy = sinon.spy(webinar, 'updatePSDataChannel');

          // First call defers
          await webinar.updatePSDataChannel();

          // Capture the 'online' listener
          const onlineCall = meeting.llmChannel.on.args.find(([event]) => event === 'online');
          assert.isDefined(onlineCall, 'should have registered an online listener');

          // Now simulate default session coming online
          meeting.llmChannel.isConnected.returns(true);

          // Fire the captured listener
          onlineCall[1]();

          // The listener should have cleared itself, removed itself, and re-called updatePSDataChannel
          assert.isNull(webinar._pendingOnlineListener);
          assert.calledWith(meeting.llmChannel.off, 'online', sinon.match.func);
          assert.equal(updatePSDataChannelSpy.callCount, 2);
        });

        it('does not reconnect with stale data if demoted before default session comes online', async () => {
          meeting.llmChannel.isConnected.returns(false);

          await webinar.updatePSDataChannel();

          // Capture the 'online' listener
          const onlineCall = meeting.llmChannel.on.args.find(([event]) => event === 'online');
          assert.isDefined(onlineCall);

          // Simulate demotion while waiting
          webinar.selfIsPanelist = false;

          // Now default session comes online
          meeting.llmChannel.isConnected.returns(true);

          // Fire the listener — re-invokes updatePSDataChannel which will see isPracticeSession = false
          onlineCall[1]();

          // Should NOT have called registerAndConnect since the user is no longer eligible
          assert.notCalled(mockPSChannel.registerAndConnect);
        });

        it('proceeds immediately when default session is already connected', async () => {
          meeting.llmChannel.isConnected.returns(true);

          const result = await webinar.updatePSDataChannel();

          assert.calledOnce(mockPSChannel.registerAndConnect);
          assert.equal(result, 'REGISTER_AND_CONNECT_RESULT');
        });

        it('clears channel reference when registerAndConnect rejects', async () => {
          const registerError = new Error('register failed');
          mockPSChannel.registerAndConnect.rejects(registerError);

          try {
            await webinar.updatePSDataChannel();
            assert.fail('Expected updatePSDataChannel to reject when registerAndConnect fails');
          } catch (error) {
            assert.equal(error, registerError);
          }

          assert.isUndefined(webinar._practiceSessionLLMChannel);
        });

        it('stores pending token on channel when one exists', async () => {
          webinar._pendingPracticeSessionDatachannelToken = 'pending-token';

          await webinar.updatePSDataChannel();

          assert.calledOnceWithExactly(mockPSChannel.setDatachannelToken, 'pending-token');
          assert.isUndefined(webinar._pendingPracticeSessionDatachannelToken);
        });

        it('disconnects and returns undefined when channel replaced mid-connect', async () => {
          // Simulate a race condition where another updatePSDataChannel call replaces the channel
          // while registerAndConnect is in progress
          const replacementChannel = createMockLLMChannel();
          mockPSChannel.registerAndConnect = sinon.stub().callsFake(async () => {
            // Mid-connect, another call replaces the channel
            webinar._practiceSessionLLMChannel = replacementChannel;
            return 'CONNECT_RESULT';
          });

          const result = await webinar.updatePSDataChannel();

          // Original channel should be disconnected (replaced scenario)
          assert.calledOnceWithExactly(mockPSChannel.disconnect, {code: 3050, reason: 'replaced'});
          // Should return undefined since the channel was replaced
          assert.isUndefined(result);
        });
      });

      describe('#updateStatusByRole', () => {
        let updateMediaShares;
        beforeEach(() => {
          updateMediaShares = sinon.stub();
          webinar.webex.meetings = {
            getMeetingByType: sinon.stub().returns({
              id: 'meeting-id',
              locusUrl: 'locusUrl',
              isJoined: sinon.stub().returns(false),
              updateLLMConnection: sinon.stub(),
              shareStatus: SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE,
              locusInfo: {
                mediaShares: 'mediaShares',
                updateMediaShares: updateMediaShares,
              },
            }),
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
              id: 'meeting-id',
              locusUrl: 'locusUrl',
              isJoined: sinon.stub().returns(false),
              updateLLMConnection: sinon.stub(),
              shareStatus: SHARE_STATUS.REMOTE_SHARE_ACTIVE,
              locusInfo: {
                mediaShares: 'mediaShares',
                updateMediaShares: updateMediaShares,
              },
            }),
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

      describe('#setPracticeSessionState', () => {
        [true, false].forEach((enabled) => {
          it(`sends a PATCH request to ${
            enabled ? 'enable' : 'disable'
          } the practice session`, async () => {
            const result = await webinar.setPracticeSessionState(enabled);
            assert.calledOnce(webex.request);
            assert.calledWith(webex.request, {
              method: 'PATCH',
              uri: `${webinar.locusUrl}/controls`,
              body: {
                practiceSession: {enabled},
              },
            });
            assert.equal(
              result,
              'REQUEST_RETURN_VALUE',
              'should return the resolved value from the request'
            );
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
            assert.calledWith(
              errorLogger,
              'Meeting:webinar#setPracticeSessionState failed',
              sinon.match.instanceOf(Error)
            );
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

      describe('#startWebcast', () => {
        const meeting = {
          locusId: 'locusId',
          correlationId: 'correlationId',
        };
        const layout = {
          videoLayout: 'Prominent',
          contentLayout: 'Prominent',
          syncStageLayout: false,
          syncStageInMeeting: false,
        };
        it(`sends a PUT request to start the webcast`, async () => {
          const result = await webinar.startWebcast(meeting, layout);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'PUT',
            uri: `${webinar.webcastInstanceUrl}/streaming`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
              'Content-Type': 'application/json',
            },
            body: {
              action: 'start',
              meetingInfo: {
                locusId: meeting.locusId,
                correlationId: meeting.correlationId,
              },
              layout,
            },
          });
          assert.equal(
            result,
            'REQUEST_RETURN_VALUE',
            'should return the resolved value from the request'
          );
        });

        it('should handle undefined meeting parameter', async () => {
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.startWebcast(undefined, layout);
            assert.fail('startWebcast should throw an error');
          } catch (error) {
            assert.equal(
              error.message,
              'Meeting parameter does not meet expectations',
              'should throw the correct error'
            );
            assert.calledOnce(errorLogger);
            assert.calledWith(
              errorLogger,
              `Meeting:webinar#startWebcast failed --> meeting parameter : ${undefined}`
            );
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
            assert.calledWith(
              errorLogger,
              'Meeting:webinar#startWebcast failed',
              sinon.match.instanceOf(Error)
            );
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe('#stopWebcast', () => {
        it(`sends a PUT request to stop the webcast`, async () => {
          const result = await webinar.stopWebcast();
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'PUT',
            uri: `${webinar.webcastInstanceUrl}/streaming`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
              'Content-Type': 'application/json',
            },
            body: {
              action: 'stop',
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
            await webinar.stopWebcast();
            assert.fail('stopWebcast should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(
              errorLogger,
              'Meeting:webinar#stopWebcast failed',
              sinon.match.instanceOf(Error)
            );
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe('#queryWebcastLayout', () => {
        it(`sends a GET request to query the webcast layout`, async () => {
          const result = await webinar.queryWebcastLayout();
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'GET',
            uri: `${webinar.webcastInstanceUrl}/layout`,
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
            await webinar.queryWebcastLayout();
            assert.fail('queryWebcastLayout should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(
              errorLogger,
              'Meeting:webinar#queryWebcastLayout failed',
              sinon.match.instanceOf(Error)
            );
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe('#updateWebcastLayout', () => {
        const layout = {
          videoLayout: 'Prominent',
          contentLayout: 'Prominent',
          syncStageLayout: false,
          syncStageInMeeting: false,
        };
        it(`sends a PUT request to update the webcast layout`, async () => {
          const result = await webinar.updateWebcastLayout(layout);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'PUT',
            uri: `${webinar.webcastInstanceUrl}/layout`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
              'Content-Type': 'application/json',
            },
            body: {
              ...layout,
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
            await webinar.updateWebcastLayout(layout);
            assert.fail('updateWebcastLayout should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(
              errorLogger,
              'Meeting:webinar#updateWebcastLayout failed',
              sinon.match.instanceOf(Error)
            );
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe('#searchWebcastAttendees', () => {
        const queryString = 'queryString';
        const specialCharsQuery = 'query@string!';
        const emptyQuery = '';

        it('sends a GET request to search the webcast attendees', async () => {
          const result = await webinar.searchWebcastAttendees(queryString);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'GET',
            uri: `${webinar.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(
              queryString
            )}`,
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
            await webinar.searchWebcastAttendees(queryString);
            assert.fail('searchWebcastAttendees should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(
              errorLogger,
              'Meeting:webinar#searchWebcastAttendees failed',
              sinon.match.instanceOf(Error)
            );
          } finally {
            errorLogger.restore();
          }
        });

        it('should handle empty query string', async () => {
          const result = await webinar.searchWebcastAttendees(emptyQuery);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'GET',
            uri: `${webinar.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(
              emptyQuery
            )}`,
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

        it('should handle query string with special characters', async () => {
          const result = await webinar.searchWebcastAttendees(specialCharsQuery);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'GET',
            uri: `${webinar.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(
              specialCharsQuery
            )}`,
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
      });

      describe('#viewAllWebcastAttendees', () => {
        it(`sends a GET request to view all the webcast attendees`, async () => {
          const result = await webinar.viewAllWebcastAttendees();
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'GET',
            uri: `${webinar.webcastInstanceUrl}/attendees`,
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
            await webinar.viewAllWebcastAttendees();
            assert.fail('viewAllWebcastAttendees should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(
              errorLogger,
              'Meeting:webinar#viewAllWebcastAttendees failed',
              sinon.match.instanceOf(Error)
            );
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe('#expelWebcastAttendee', () => {
        const participantId = 'participantId';
        it(`sends a DELETE request to expel the webcast attendee`, async () => {
          const result = await webinar.expelWebcastAttendee(participantId);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'DELETE',
            uri: `${webinar.webcastInstanceUrl}/attendees/${participantId}`,
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
            await webinar.expelWebcastAttendee(participantId);
            assert.fail('expelWebcastAttendee should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(
              errorLogger,
              'Meeting:webinar#expelWebcastAttendee failed',
              sinon.match.instanceOf(Error)
            );
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe('#searchLargeScaleWebinarAttendees', () => {
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
              id: 'meeting-id',
              locusUrl: 'locusUrl',
              locusInfo: {
                links: {
                  resources: {
                    attendeeSearch: {
                      url: attendeeSearchUrl,
                    },
                  },
                },
              },
            }),
          };
        });

        it('throws an error if attendeeSearchUrl is not available', async () => {
          webinar.webex.meetings = {
            getMeetingByType: sinon.stub().returns({
              id: 'meeting-id',
              locusUrl: 'locusUrl',
              locusInfo: {
                links: {
                  resources: {
                    attendeeSearch: {
                      url: null,
                    },
                  },
                },
              },
            }),
          };
          try {
            await webinar.searchLargeScaleWebinarAttendees(params);
            assert.fail('searchLargeScaleWebinarAttendees should throw an error');
          } catch (error) {
            assert.equal(
              error.message,
              'Meeting:webinar5k#Attendee search url is not available',
              'should throw the correct error'
            );
          }
        });

        it('sends a GET request to search the large scale webinar attendees', async () => {
          const result = await webinar.searchLargeScaleWebinarAttendees(params);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: 'GET',
            uri: `${attendeeSearchUrl}?search_text=${encodeURIComponent(
              params.queryString
            )}&limit=50`,
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
    });
})
