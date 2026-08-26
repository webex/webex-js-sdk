import {assert} from '@webex/test-helper-chai';
import {
  NewMetrics,
  CallDiagnosticLatencies,
  AutomatedUserUtils,
  Utils,
} from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('internal-plugin-metrics', () => {
  const mockWebex = () =>
    new MockWebex({
      children: {
        newMetrics: NewMetrics,
      },
      meetings: {
        getBasicMeetingInformation: sinon.stub().callsFake((meetingId) => ({
          id: meetingId,
          correlationId: `correlation-${meetingId}`,
        })),
      },
      request: sinon.stub().resolves({}),
      logger: {
        log: sinon.stub(),
        error: sinon.stub(),
      },
    });

  describe('check submitClientEvent, submitFeatureEvent when webex is not ready', () => {
    let webex;
    //@ts-ignore
    webex = mockWebex();

    it('checks the log', () => {
      webex.internal.newMetrics.submitClientEvent({
        name: 'client.alert.displayed',
        options: {
          meetingId: '123',
        },
      });
      assert.calledWith(
        webex.logger.log,
        'NewMetrics: @submitClientEvent. Attempted to submit before webex.ready. Event name: client.alert.displayed'
      );
    });

    it('checks the log', () => {
      webex.internal.newMetrics.submitFeatureEvent({
        name: 'client.feature.meeting.summary',
        options: {
          meetingId: '123',
        },
        payload: {
          meetingSummaryInfo: {
            featureName: 'syncSystemMuteStatus',
            featureActions: [
              {
                actionName: 'syncMeetingMicUnmuteStatusToSystem',
                actionId: '14200',
                isInitialValue: false,
                clickCount: '1',
              },
            ],
          },
        },
      });
      assert.calledWith(
        webex.logger.log,
        'NewMetrics: @submitFeatureEvent. Attempted to submit before webex.ready. Event name: client.feature.meeting.summary'
      );
    });
  });

  describe('new-metrics contstructor', () => {
    it('checks callDiagnosticLatencies is defined before ready emit', () => {
      const webex = mockWebex();

      assert.instanceOf(webex.internal.newMetrics.callDiagnosticLatencies, CallDiagnosticLatencies);
    });

    it('checks callDiagnosticMetrics is defined before ready emit', () => {
      const webex = mockWebex();

      assert.isDefined(webex.internal.newMetrics.callDiagnosticMetrics);
    });

    it('can call buildClientEventFetchRequestOptions before ready', async () => {
      const webex = mockWebex();
      const stub = sinon.stub(
        webex.internal.newMetrics.callDiagnosticMetrics,
        'buildClientEventFetchRequestOptions'
      ).resolves({url: 'https://metrics.example.com'});

      const result = await webex.internal.newMetrics.buildClientEventFetchRequestOptions({
        name: 'client.alert.displayed',
        options: {correlationId: 'test-id'},
      });

      assert.calledOnceWithExactly(stub, {
        name: 'client.alert.displayed',
        payload: undefined,
        options: {correlationId: 'test-id'},
      });
      assert.deepEqual(result, {url: 'https://metrics.example.com'});
    });
  });

  describe('new-metrics', () => {
    let webex;

    beforeEach(() => {
      //@ts-ignore
      webex = mockWebex();

      webex.emit('ready');

      webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp = sinon.stub();
      webex.internal.newMetrics.callDiagnosticLatencies.clearTimestamps = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitDelayedClientEvents = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitMQE = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.clientMetricsAliasUser = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.buildClientEventFetchRequestOptions =
        sinon.stub();
      webex.setTimingsAndFetch = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitFeatureEvent = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('lazy metrics backend initialization when checking if backend ready', () => {
      assert.isUndefined(webex.internal.newMetrics.behavioralMetrics);
      webex.internal.newMetrics.isReadyToSubmitBehavioralEvents();
      assert.isDefined(webex.internal.newMetrics.behavioralMetrics);

      assert.isUndefined(webex.internal.newMetrics.operationalMetrics);
      webex.internal.newMetrics.isReadyToSubmitOperationalEvents();
      assert.isDefined(webex.internal.newMetrics.operationalMetrics);

      assert.isUndefined(webex.internal.newMetrics.businessMetrics);
      webex.internal.newMetrics.isReadyToSubmitBusinessEvents();
      assert.isDefined(webex.internal.newMetrics.businessMetrics);
    });

    it('returns the automated user classification', () => {
      assert.strictEqual(
        webex.internal.newMetrics.isAutomatedUser(),
        AutomatedUserUtils.isAutomatedUser()
      );
    });

    it('passes the table through to the business metrics', () => {
      assert.isUndefined(webex.internal.newMetrics.businessMetrics);
      webex.internal.newMetrics.isReadyToSubmitBusinessEvents();
      assert.isDefined(webex.internal.newMetrics.businessMetrics);
      webex.internal.newMetrics.businessMetrics.submitBusinessEvent = sinon.stub();
      webex.internal.newMetrics.submitBusinessEvent({
        name: 'foobar',
        payload: {},
        table: 'test',
        metadata: {foo: 'bar'},
      });

      assert.calledWith(webex.internal.newMetrics.businessMetrics.submitBusinessEvent, {
        name: 'foobar',
        payload: {},
        table: 'test',
        metadata: {foo: 'bar'},
      });
    });

    it('submits Client Event successfully', () => {
      webex.internal.newMetrics.submitClientEvent({
        name: 'client.alert.displayed',
        options: {
          meetingId: '123',
        },
      });

      assert.calledWith(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp, {
        key: 'client.alert.displayed',
        options: {meetingId: '123'},
      });
      assert.calledWith(webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent, {
        name: 'client.alert.displayed',
        payload: undefined,
        options: {meetingId: '123'},
        delaySubmitEvent: false,
      });
    });

    describe('privacy and security permission enrichment', () => {
      const permission = {
        camera: {status: 'GRANTED' as const},
        microphone: {status: 'DENIED' as const, reason: 'DENIED_BY_USER' as const},
        contentShare: {status: 'REQUESTING' as const},
      };

      it('enriches an eligible client event through the public metrics API', () => {
        webex.internal.newMetrics.setPrivacyAndSecurityPermission(permission);
        webex.internal.newMetrics.submitClientEvent({name: 'client.call.initiated'});

        const submittedPayload =
          webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent.firstCall.args[0]
            .payload;

        assert.deepEqual(submittedPayload.privacyAndSecurityPermission, {
          camera: permission.camera,
          microphone: permission.microphone,
        });
      });

      it('uses the meeting correlation id to preserve history across identifier transitions', () => {
        webex.meetings.getBasicMeetingInformation
          .withArgs('meeting-1')
          .returns({id: 'meeting-1', correlationId: 'correlation-1'});
        webex.internal.newMetrics.setPrivacyAndSecurityPermission(permission);

        webex.internal.newMetrics.submitClientEvent({
          name: 'client.call.initiated',
          options: {correlationId: 'correlation-1'},
        });
        webex.internal.newMetrics.submitClientEvent({
          name: 'client.ice.end',
          payload: {},
          options: {meetingId: 'meeting-1'},
        });

        const submissions = webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent.args;

        assert.property(submissions[0][0].payload, 'privacyAndSecurityPermission');
        assert.notProperty(submissions[1][0].payload, 'privacyAndSecurityPermission');
      });

      it('uses the default scope when no correlation id can be resolved', () => {
        webex.internal.newMetrics.setPrivacyAndSecurityPermission(permission);

        webex.internal.newMetrics.submitClientEvent({
          name: 'client.call.initiated',
          options: {sessionCorrelationId: 'session-1'},
        });
        webex.internal.newMetrics.submitClientEvent({
          name: 'client.ice.end',
          payload: {},
          options: {sessionCorrelationId: 'session-2'},
        });

        const submissions = webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent.args;

        assert.property(submissions[0][0].payload, 'privacyAndSecurityPermission');
        assert.notProperty(submissions[1][0].payload, 'privacyAndSecurityPermission');
      });

      it('captures the permission snapshot before a delayed event is queued', () => {
        webex.internal.newMetrics.setPrivacyAndSecurityPermission(permission);
        webex.internal.newMetrics.setDelaySubmitClientEvents({shouldDelay: true});
        webex.internal.newMetrics.submitClientEvent({name: 'client.call.initiated'});
        webex.internal.newMetrics.setPrivacyAndSecurityPermission({
          camera: {status: 'DENIED' as const},
        });

        const submission =
          webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent.firstCall.args[0];

        assert.isTrue(submission.delaySubmitEvent);
        assert.deepEqual(submission.payload.privacyAndSecurityPermission, {
          camera: permission.camera,
          microphone: permission.microphone,
        });
      });
    });

    it('submits feature Event successfully', () => {
      webex.internal.newMetrics.submitFeatureEvent({
        name: 'client.feature.meeting.summary',
        options: {
          meetingId: '123',
        },
        payload: {
          meetingSummaryInfo: {
            featureName: 'syncSystemMuteStatus',
            featureActions: [
              {
                actionName: 'syncMeetingMicUnmuteStatusToSystem',
                actionId: '14200',
                isInitialValue: false,
                clickCount: '1',
              },
            ],
          },
        },
      });

      assert.calledWith(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp, {
        key: 'client.feature.meeting.summary',
        options: {meetingId: '123'},
      });
      assert.calledWith(webex.internal.newMetrics.callDiagnosticMetrics.submitFeatureEvent, {
        name: 'client.feature.meeting.summary',
        payload: {
          meetingSummaryInfo: {
            featureName: 'syncSystemMuteStatus',
            featureActions: [
              {
                actionName: 'syncMeetingMicUnmuteStatusToSystem',
                actionId: '14200',
                isInitialValue: false,
                clickCount: '1',
              },
            ],
          },
        },
        options: {meetingId: '123'},
        delaySubmitEvent: false,
      });
    });

    it('submits MQE successfully', () => {
      webex.internal.newMetrics.submitMQE({
        name: 'client.mediaquality.event',
        //@ts-ignore
        payload: {intervals: [{}]},
        options: {
          meetingId: '123',
          networkType: 'wifi',
        },
      });

      assert.calledWith(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp, {
        key: 'client.mediaquality.event',
      });
      assert.calledWith(webex.internal.newMetrics.callDiagnosticMetrics.submitMQE, {
        name: 'client.mediaquality.event',
        //@ts-ignore
        payload: {intervals: [{}]},
        options: {
          meetingId: '123',
          networkType: 'wifi',
        },
      });
    });

    it('submits Internal Event successfully', () => {
      webex.internal.newMetrics.submitInternalEvent({
        name: 'client.mediaquality.event',
      });

      assert.calledWith(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp, {
        key: 'client.mediaquality.event',
      });
      assert.notCalled(webex.internal.newMetrics.callDiagnosticLatencies.clearTimestamps);
    });

    it('submits Internal Event successfully for clearing the join latencies', () => {
      webex.internal.newMetrics.submitInternalEvent({
        name: 'internal.reset.join.latencies',
      });

      assert.notCalled(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp);
      assert.calledOnce(webex.internal.newMetrics.callDiagnosticLatencies.clearTimestamps);
    });

    describe('#clientMetricsAliasUser', () => {
      it('aliases the user correctly', async () => {
        webex.request.resolves({response: 'abc'});
        await webex.internal.newMetrics.clientMetricsAliasUser('my-id');
        assert.calledWith(webex.request, {
          method: 'POST',
          api: 'metrics',
          resource: 'clientmetrics',
          headers: {'x-prelogin-userid': 'my-id'},
          body: {},
          qs: {alias: true},
        });
        assert.calledWith(
          webex.logger.log,
          'NewMetrics: @clientMetricsAliasUser. Request successful.'
        );
      });

      it('handles failed request correctly', async () => {
        webex.request.rejects(new Error('test error'));
        sinon.stub(Utils, 'generateCommonErrorMetadata').returns('formattedError');
        try {
          await webex.internal.newMetrics.clientMetricsAliasUser({event: 'test'}, 'my-id');
        } catch (err) {
          assert.calledWith(
            webex.logger.error,
            'NewMetrics: @clientMetricsAliasUser. Request failed:',
            `err: formattedError`
          );
        }
      });
    });

    describe('#buildClientEventFetchRequestOptions', () => {
      it('builds client event fetch options successfully', () => {
        webex.internal.newMetrics.buildClientEventFetchRequestOptions({
          name: 'client.alert.displayed',
          options: {
            meetingId: '123',
          },
        });

        assert.calledWith(
          webex.internal.newMetrics.callDiagnosticMetrics.buildClientEventFetchRequestOptions,
          {
            name: 'client.alert.displayed',
            payload: undefined,
            options: {meetingId: '123'},
          }
        );
      });
    });

    describe('#setMetricTimingsAndFetch', () => {
      beforeEach(() => {
        global.fetch = sinon.stub();
      });

      it('calls fetch with the expected options', () => {
        const now = new Date();
        sinon.useFakeTimers(now.getTime());

        webex.internal.newMetrics.setMetricTimingsAndFetch({
          json: true,
          body: JSON.stringify({metrics: [{eventPayload: {}}]}),
        });

        const expected = {
          json: true,
          body: JSON.stringify({
            metrics: [
              {
                eventPayload: {
                  originTime: {
                    triggered: now.toISOString(),
                    sent: now.toISOString(),
                  },
                },
              },
            ],
          }),
        };

        sinon.assert.calledOnce(webex.setTimingsAndFetch);
        sinon.assert.calledWith(webex.setTimingsAndFetch, expected);

        sinon.restore();
      });
    });

    describe('#setDelaySubmitClientEvents', () => {
      it('sets delaySubmitClientEvents correctly and calls submitDelayedClientEvents when set to false', () => {
        sinon.assert.match(webex.internal.newMetrics.delaySubmitClientEvents, false);
        sinon.assert.match(webex.internal.newMetrics.delayedClientEventsOverrides, {});

        webex.internal.newMetrics.setDelaySubmitClientEvents({shouldDelay: true});

        assert.notCalled(webex.internal.newMetrics.callDiagnosticMetrics.submitDelayedClientEvents);

        sinon.assert.match(webex.internal.newMetrics.delaySubmitClientEvents, true);
        sinon.assert.match(webex.internal.newMetrics.delayedClientEventsOverrides, {});

        webex.internal.newMetrics.setDelaySubmitClientEvents({
          shouldDelay: false,
          overrides: {foo: 'bar'},
        });

        assert.calledOnce(
          webex.internal.newMetrics.callDiagnosticMetrics.submitDelayedClientEvents
        );
        assert.calledWith(
          webex.internal.newMetrics.callDiagnosticMetrics.submitDelayedClientEvents,
          {foo: 'bar'}
        );

        sinon.assert.match(webex.internal.newMetrics.delaySubmitClientEvents, false);
        sinon.assert.match(webex.internal.newMetrics.delayedClientEventsOverrides, {foo: 'bar'});
      });

      it('should not fail when called before webex is ready', () => {
        // Create mock
        webex = mockWebex();

        webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp = sinon.stub();
        webex.internal.newMetrics.callDiagnosticLatencies.clearTimestamps = sinon.stub();
        webex.setTimingsAndFetch = sinon.stub();

        sinon.assert.match(webex.internal.newMetrics.delaySubmitClientEvents, false);

        // Call the method before webex is ready, will not throw error
        webex.internal.newMetrics.setDelaySubmitClientEvents({shouldDelay: false});
        webex.internal.newMetrics.setDelaySubmitClientEvents({shouldDelay: true});

        webex.internal.newMetrics.setDelaySubmitClientEvents({shouldDelay: false});
        // Webex is ready
        webex.emit('ready');
      });
    });
  });
});
