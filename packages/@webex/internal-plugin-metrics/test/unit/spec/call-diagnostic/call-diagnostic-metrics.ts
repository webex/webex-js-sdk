import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

import CallDiagnosticMetrics from '../../../../src/call-diagnostic/call-diagnostic-metrics';
import CallDiagnosticLatencies from '../../../../src/call-diagnostic/call-diagnostic-metrics-latencies';
import * as Utils from '../../../../src/call-diagnostic/call-diagnostic-metrics.util';
import {BrowserDetection} from '@webex/common';
import {getOSNameInternal} from '@webex/internal-plugin-metrics';
import uuid from 'uuid';

//@ts-ignore
global.window = {location: {hostname: 'whatever'}};

const {getOSName, getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();
const userAgent = `webex-js-sdk/test-webex-version client=Cantina; (os=${getOSName()}/${
  getOSVersion().split('.')[0]
})`;

describe('internal-plugin-metrics', () => {
  describe('CallDiagnosticMetrics', () => {
    var now = new Date();

    let cd: CallDiagnosticMetrics;

    const fakeMeeting = {
      id: '1',
      correlationId: 'correlationId',
      environment: 'meeting_evn',
      locusUrl: 'locus/url',
      locusInfo: {
        fullState: {
          lastActive: 'lastActive',
        },
      },
      meetingInfo: {},
      getCurUserType: () => 'host',
    };

    let webex;

    beforeEach(() => {
      webex = {
        canAuthorize: true,
        version: 'webex-version',
        internal: {
          services: {
            get: () => 'locus-url',
          },
          metrics: {
            submitClientMetrics: sinon.stub(),
          },
          newMetrics: {},
          device: {
            userId: 'userId',
            url: 'deviceUrl',
            orgId: 'orgId',
          },
        },
        meetings: {
          config: {
            metrics: {
              clientType: 'TEAMS_CLIENT',
              subClientType: 'WEB_APP',
            },
          },
          metrics: {
            clientName: 'Cantina',
          },
          meetingCollection: {
            get: () => fakeMeeting,
          },
          geoHintInfo: {
            clientAddress: '1.3.4.5',
            countryCode: 'UK',
          },
        },
        credentials: {
          isUnverifiedGuest: false,
        },
        prepareFetchOptions: sinon.stub().callsFake((opts: any) => ({...opts, foo: 'bar'})),
      };

      webex.internal.newMetrics.callDiagnosticLatencies = new CallDiagnosticLatencies(
        {},
        {parent: webex}
      );

      sinon.createSandbox();
      sinon.useFakeTimers(now.getTime());
      cd = new CallDiagnosticMetrics({}, {parent: webex});
      sinon.stub(uuid, 'v4').returns('my-fake-id');
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('#getOrigin', () => {
      it('should build origin correctly', () => {
        sinon.stub(Utils, 'anonymizeIPAddress').returns('1.1.1.1');

        //@ts-ignore
        const res = cd.getOrigin(
          {subClientType: 'WEB_APP', clientType: 'TEAMS_CLIENT'},
          fakeMeeting.id
        );

        assert.deepEqual(res, {
          clientInfo: {
            browser: getBrowserName(),
            browserVersion: getBrowserVersion(),
            clientType: 'TEAMS_CLIENT',
            clientVersion: 'webex-js-sdk/webex-version',
            localNetworkPrefix: '1.1.1.1',
            os: getOSNameInternal(),
            osVersion: getOSVersion(),
            subClientType: 'WEB_APP',
          },
          environment: 'meeting_evn',
          name: 'endpoint',
          networkType: 'unknown',
          userAgent,
        });
      });

      it('should build origin correctly with no meeting', () => {
        sinon.stub(Utils, 'anonymizeIPAddress').returns('1.1.1.1');

        //@ts-ignore
        const res = cd.getOrigin();

        assert.deepEqual(res, {
          clientInfo: {
            browser: getBrowserName(),
            browserVersion: getBrowserVersion(),
            clientType: 'TEAMS_CLIENT',
            clientVersion: 'webex-js-sdk/webex-version',
            localNetworkPrefix: '1.1.1.1',
            os: getOSNameInternal(),
            osVersion: getOSVersion(),
            subClientType: 'WEB_APP',
          },
          name: 'endpoint',
          networkType: 'unknown',
          userAgent,
        });
      });
    });

    describe('#getIdentifiers', () => {
      it('should build identifiers correctly', () => {
        const res = cd.getIdentifiers({
          mediaConnections: [
            {mediaAgentAlias: 'mediaAgentAlias', mediaAgentGroupId: 'mediaAgentGroupId'},
          ],
          meeting: fakeMeeting,
        });

        assert.deepEqual(res, {
          correlationId: 'correlationId',
          deviceId: 'deviceUrl',
          locusId: 'url',
          locusStartTime: 'lastActive',
          locusUrl: 'locus/url',
          mediaAgentAlias: 'mediaAgentAlias',
          mediaAgentGroupId: 'mediaAgentGroupId',
          orgId: 'orgId',
          userId: 'userId',
        });
      });

      it('should build identifiers correctly given correlationId', () => {
        const res = cd.getIdentifiers({
          correlationId: 'correlationId',
        });

        assert.deepEqual(res, {
          correlationId: 'correlationId',
          deviceId: 'deviceUrl',
          locusUrl: 'locus-url',
          orgId: 'orgId',
          userId: 'userId',
        });
      });

      it('should throw Error if correlationId is missing', () => {
        assert.throws(() =>
          cd.getIdentifiers({
            mediaConnections: [
              {mediaAgentAlias: 'mediaAgentAlias', mediaAgentGroupId: 'mediaAgentGroupId'},
            ],
            meeting: {...fakeMeeting, correlationId: undefined},
          })
        );
      });
    });

    it('should prepare diagnostic event successfully', () => {
      const options = {meetingId: fakeMeeting.id};
      const getOriginStub = sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
      const clearEmptyKeysRecursivelyStub = sinon.stub(Utils, 'clearEmptyKeysRecursively');

      const res = cd.prepareDiagnosticEvent(
        {
          canProceed: false,
          identifiers: {correlationId: 'id'},
          name: 'client.alert.displayed',
        },
        options
      );

      assert.calledWith(getOriginStub, options, options.meetingId);
      assert.calledOnce(clearEmptyKeysRecursivelyStub);
      assert.deepEqual(res, {
        event: {
          canProceed: false,
          identifiers: {
            correlationId: 'id',
          },
          name: 'client.alert.displayed',
        },
        eventId: 'my-fake-id',
        origin: {
          origin: 'fake-origin',
        },
        originTime: {
          sent: 'not_defined_yet',
          triggered: now.toISOString(),
        },
        senderCountryCode: 'UK',
        version: 1,
      });
    });

    describe('#submitClientEvent', () => {
      it('should submit client event successfully with meetingId', () => {
        const prepareDiagnosticEventSpy = sinon.spy(cd, 'prepareDiagnosticEvent');
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');
        const generateClientEventErrorPayloadSpy = sinon.spy(cd, 'generateClientEventErrorPayload');
        const getIdentifiersSpy = sinon.spy(cd, 'getIdentifiers');
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const options = {
          meetingId: fakeMeeting.id,
          mediaConnections: [{mediaAgentAlias: 'alias', mediaAgentGroupId: '1'}],
        };

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          options,
        });

        assert.calledWith(getIdentifiersSpy, {
          meeting: fakeMeeting,
          mediaConnections: [{mediaAgentAlias: 'alias', mediaAgentGroupId: '1'}],
        });
        assert.notCalled(generateClientEventErrorPayloadSpy);
        assert.calledWith(
          prepareDiagnosticEventSpy,
          {
            canProceed: true,
            eventData: {
              webClientDomain: 'whatever',
            },
            identifiers: {
              correlationId: 'correlationId',
              deviceId: 'deviceUrl',
              locusId: 'url',
              locusStartTime: 'lastActive',
              locusUrl: 'locus/url',
              mediaAgentAlias: 'alias',
              mediaAgentGroupId: '1',
              orgId: 'orgId',
              userId: 'userId',
            },
            loginType: 'login-ci',
            name: 'client.alert.displayed',
            userType: 'host',
            isConvergedArchitectureEnabled: undefined,
          },
          options
        );
        assert.calledWith(submitToCallDiagnosticsSpy, {
          event: {
            canProceed: true,
            eventData: {
              webClientDomain: 'whatever',
            },
            identifiers: {
              correlationId: 'correlationId',
              deviceId: 'deviceUrl',
              locusId: 'url',
              locusStartTime: 'lastActive',
              locusUrl: 'locus/url',
              mediaAgentAlias: 'alias',
              mediaAgentGroupId: '1',
              orgId: 'orgId',
              userId: 'userId',
            },
            loginType: 'login-ci',
            name: 'client.alert.displayed',
            userType: 'host',
            isConvergedArchitectureEnabled: undefined,
          },
          eventId: 'my-fake-id',
          origin: {
            origin: 'fake-origin',
          },
          originTime: {
            sent: 'not_defined_yet',
            triggered: now.toISOString(),
          },
          senderCountryCode: 'UK',
          version: 1,
        });
      });

      it('should submit client event successfully with correlationId', () => {
        const prepareDiagnosticEventSpy = sinon.spy(cd, 'prepareDiagnosticEvent');
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');
        const generateClientEventErrorPayloadSpy = sinon.spy(cd, 'generateClientEventErrorPayload');
        const getIdentifiersSpy = sinon.spy(cd, 'getIdentifiers');
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});

        const options = {
          correlationId: 'correlationId',
        };

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          options,
        });

        assert.calledWith(getIdentifiersSpy, {
          correlationId: 'correlationId',
        });

        assert.notCalled(generateClientEventErrorPayloadSpy);
        assert.calledWith(
          prepareDiagnosticEventSpy,
          {
            canProceed: true,
            eventData: {
              webClientDomain: 'whatever',
            },
            identifiers: {
              correlationId: 'correlationId',
              deviceId: 'deviceUrl',
              locusUrl: 'locus-url',
              orgId: 'orgId',
              userId: 'userId',
            },
            loginType: 'login-ci',
            name: 'client.alert.displayed',
          },
          options
        );
        assert.calledWith(submitToCallDiagnosticsSpy, {
          event: {
            canProceed: true,
            eventData: {
              webClientDomain: 'whatever',
            },
            identifiers: {
              correlationId: 'correlationId',
              deviceId: 'deviceUrl',
              locusUrl: 'locus-url',
              orgId: 'orgId',
              userId: 'userId',
            },
            loginType: 'login-ci',
            name: 'client.alert.displayed',
          },
          eventId: 'my-fake-id',
          origin: {
            origin: 'fake-origin',
          },
          originTime: {
            sent: 'not_defined_yet',
            triggered: now.toISOString(),
          },
          senderCountryCode: 'UK',
          version: 1,
        });
      });

      it('it should include errors if provided', () => {
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');

        const options = {
          meetingId: fakeMeeting.id,
          mediaConnections: [{mediaAgentAlias: 'alias', mediaAgentGroupId: '1'}],
          rawError: {
            body: {
              errorCode: 2409005,
            },
          },
        };

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          options,
        });

        assert.calledWith(submitToCallDiagnosticsSpy, {
          event: {
            canProceed: true,
            eventData: {
              webClientDomain: 'whatever',
            },
            identifiers: {
              correlationId: 'correlationId',
              deviceId: 'deviceUrl',
              locusId: 'url',
              locusStartTime: 'lastActive',
              locusUrl: 'locus/url',
              mediaAgentAlias: 'alias',
              mediaAgentGroupId: '1',
              orgId: 'orgId',
              userId: 'userId',
            },
            errors: [
              {
                category: 'expected',
                errorDescription: 'StartRecordingFailed',
                fatal: true,
                name: 'other',
                shownToUser: false,
                serviceErrorCode: 2409005,
                errorCode: 4029,
              },
            ],
            loginType: 'login-ci',
            name: 'client.alert.displayed',
            userType: 'host',
            isConvergedArchitectureEnabled: undefined,
          },
          eventId: 'my-fake-id',
          origin: {
            origin: 'fake-origin',
          },
          originTime: {
            sent: 'not_defined_yet',
            triggered: now.toISOString(),
          },
          senderCountryCode: 'UK',
          version: 1,
        });
      });

      it('should include errors in payload if provided via payload', () => {
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');

        const options = {
          meetingId: fakeMeeting.id,
          mediaConnections: [{mediaAgentAlias: 'alias', mediaAgentGroupId: '1'}],
        };

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          payload: {
            errors: [
              {
                name: 'locus.response',
                fatal: true,
                category: 'signaling',
                shownToUser: false,
              },
            ],
          },
          options,
        });

        assert.calledWith(submitToCallDiagnosticsSpy, {
          event: {
            canProceed: true,
            eventData: {
              webClientDomain: 'whatever',
            },
            identifiers: {
              correlationId: 'correlationId',
              deviceId: 'deviceUrl',
              locusId: 'url',
              locusStartTime: 'lastActive',
              locusUrl: 'locus/url',
              mediaAgentAlias: 'alias',
              mediaAgentGroupId: '1',
              orgId: 'orgId',
              userId: 'userId',
            },
            errors: [
              {
                name: 'locus.response',
                fatal: true,
                category: 'signaling',
                shownToUser: false,
              },
            ],
            loginType: 'login-ci',
            name: 'client.alert.displayed',
            userType: 'host',
            isConvergedArchitectureEnabled: undefined,
          },
          eventId: 'my-fake-id',
          origin: {
            origin: 'fake-origin',
          },
          originTime: {
            sent: 'not_defined_yet',
            triggered: now.toISOString(),
          },
          senderCountryCode: 'UK',
          version: 1,
        });
      });

      it('should throw if meetingId nor correlationId not provided', () => {
        assert.throws(() =>
          cd.submitClientEvent({
            name: 'client.alert.displayed',
          })
        );
      });

      it('should send behavioral event if meetingId provided but meeting is undefined', () => {
        webex.meetings.meetingCollection.get = sinon.stub().returns(undefined);
        cd.submitClientEvent({name: 'client.alert.displayed', options: {meetingId: 'meetingId'}});
        assert.calledWith(
          webex.internal.metrics.submitClientMetrics,
          'js_sdk_call_diagnostic_event_failed_to_send',
          {
            fields: {meetingId: 'meetingId', name: 'client.alert.displayed'},
          }
        );
      });
    });

    it('should send request to call diagnostic batcher', () => {
      const requestStub = sinon.stub();
      //@ts-ignore
      cd.callDiagnosticEventsBatcher = {request: requestStub};
      //@ts-ignore
      cd.submitToCallDiagnostics({event: 'test'});
      assert.calledWith(requestStub, {eventPayload: {event: 'test'}, type: ['diagnostic-event']});
    });

    describe('#submitMQE', () => {
      it('submits the event correctly', () => {
        const prepareDiagnosticEventSpy = sinon.spy(cd, 'prepareDiagnosticEvent');
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');
        const getErrorPayloadForClientErrorCodeSpy = sinon.spy(
          cd,
          'getErrorPayloadForClientErrorCode'
        );
        const getIdentifiersSpy = sinon.spy(cd, 'getIdentifiers');
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const options = {
          networkType: 'wifi' as const,
          meetingId: fakeMeeting.id,
        };

        cd.submitMQE({
          name: 'client.mediaquality.event',
          payload: {
            //@ts-ignore
            intervals: [{}],
          },
          options,
        });

        assert.calledWith(getIdentifiersSpy, {
          meeting: fakeMeeting,
          mediaConnections: undefined,
        });
        assert.notCalled(getErrorPayloadForClientErrorCodeSpy);
        assert.calledWith(
          prepareDiagnosticEventSpy,
          {
            name: 'client.mediaquality.event',
            canProceed: true,
            identifiers: {
              correlationId: 'correlationId',
              userId: 'userId',
              deviceId: 'deviceUrl',
              orgId: 'orgId',
              locusUrl: 'locus/url',
              locusId: 'url',
              locusStartTime: 'lastActive',
            },
            eventData: {webClientDomain: 'whatever'},
            intervals: [{}],
            sourceMetadata: {
              applicationSoftwareType: 'webex-js-sdk',
              applicationSoftwareVersion: 'webex-version',
              mediaEngineSoftwareType: 'browser',
              mediaEngineSoftwareVersion: getOSVersion(),
              startTime: now.toISOString(),
            },
          },
          options
        );

        assert.calledWith(submitToCallDiagnosticsSpy, {
          eventId: 'my-fake-id',
          version: 1,
          origin: {origin: 'fake-origin'},
          originTime: {triggered: now.toISOString(), sent: 'not_defined_yet'},
          senderCountryCode: 'UK',
          event: {
            name: 'client.mediaquality.event',
            canProceed: true,
            identifiers: {
              correlationId: 'correlationId',
              userId: 'userId',
              deviceId: 'deviceUrl',
              orgId: 'orgId',
              locusUrl: 'locus/url',
              locusId: 'url',
              locusStartTime: 'lastActive',
            },
            eventData: {webClientDomain: 'whatever'},
            intervals: [{}],
            sourceMetadata: {
              applicationSoftwareType: 'webex-js-sdk',
              applicationSoftwareVersion: 'webex-version',
              mediaEngineSoftwareType: 'browser',
              mediaEngineSoftwareVersion: getOSVersion(),
              startTime: now.toISOString(),
            },
          },
        });
      });

      it('throws if meeting id not provided', () => {
        assert.throws(() =>
          cd.submitMQE({
            name: 'client.mediaquality.event',
            payload: {
              //@ts-ignore
              intervals: [{}],
            },
            //@ts-ignore
            options: {meetingId: undefined, networkType: 'wifi'},
          })
        );
      });

      it('should send behavioral event if meeting is undefined', () => {
        webex.meetings.meetingCollection.get = sinon.stub().returns(undefined);
        cd.submitMQE({
          name: 'client.mediaquality.event',
          payload: {
            //@ts-ignore
            intervals: [{}],
          },
          options: {meetingId: 'meetingId'},
        });
        assert.calledWith(
          webex.internal.metrics.submitClientMetrics,
          'js_sdk_call_diagnostic_event_failed_to_send',
          {
            fields: {meetingId: 'meetingId', name: 'client.mediaquality.event'},
          }
        );
      });
    });
    describe('#getErrorPayloadForClientErrorCode', () => {
      it('it should grab the payload for client error code correctly', () => {
        const res = cd.getErrorPayloadForClientErrorCode({
          clientErrorCode: 4008,
          serviceErrorCode: 10000,
        });
        assert.deepEqual(res, {
          category: 'signaling',
          errorDescription: 'NewLocusError',
          fatal: true,
          name: 'other',
          shownToUser: false,
          errorCode: 4008,
          serviceErrorCode: 10000,
        });
      });

      it('it should return undefined if trying to get payload for client error code that doesnt exist', () => {
        const res = cd.getErrorPayloadForClientErrorCode({
          clientErrorCode: 123456,
          serviceErrorCode: 100000,
        });
        assert.deepEqual(res, undefined);
      });
    });

    describe('#generateClientEventErrorPayload', () => {
      it('should generate event error payload correctly', () => {
        const res = cd.generateClientEventErrorPayload({body: {errorCode: 2409005}});
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'StartRecordingFailed',
          fatal: true,
          name: 'other',
          shownToUser: false,
          errorCode: 4029,
          serviceErrorCode: 2409005,
        });
      });

      it('should return default new locus event error payload correctly if locus error', () => {
        const res = cd.generateClientEventErrorPayload({body: {errorCode: 2400000}});
        assert.deepEqual(res, {
          category: 'signaling',
          errorDescription: 'NewLocusError',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: 2400000,
          errorCode: 4008,
        });
      });

      it('should return default meeting info lookup error payload correctly if not locus error', () => {
        const res = cd.generateClientEventErrorPayload({body: {errorCode: 9400000}});
        assert.deepEqual(res, {
          category: 'signaling',
          errorDescription: 'MeetingInfoLookupError',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: 9400000,
          errorCode: 4100,
        });
      });

      it('should return undefined if no error code provided', () => {
        const res = cd.generateClientEventErrorPayload({body: {errorCode: undefined}});
        assert.deepEqual(res, undefined);
      });
    });

    describe('#getCurLoginType', () => {
      it('returns login-ci if not unverified guest', () => {
        webex.credentials.isUnverifiedGuest = false;
        assert.deepEqual(cd.getCurLoginType(), 'login-ci');
      });
      it('returns unverified guest', () => {
        webex.credentials.isUnverifiedGuest = true;
        assert.deepEqual(cd.getCurLoginType(), 'unverified-guest');
      });
    });

    describe('#getIsConvergedArchitectureEnabled', () => {
      it('returns true if converged architecture is enabled', () => {
        fakeMeeting.meetingInfo = {enableConvergedArchitecture: true};
        assert.deepEqual(cd.getIsConvergedArchitectureEnabled({meetingId: fakeMeeting.id}), true);
      });
      it('returns false if converged architecture is not enabled', () => {
        fakeMeeting.meetingInfo = {enableConvergedArchitecture: false};
        assert.deepEqual(cd.getIsConvergedArchitectureEnabled({meetingId: fakeMeeting.id}), false);

      });
      it('returns undefined if converged architecture is not defined', () => {
        fakeMeeting.meetingInfo = {};
        assert.deepEqual(cd.getIsConvergedArchitectureEnabled({meetingId: fakeMeeting.id}), undefined);
      });
    })

    describe('#buildClientEventFetchRequestOptions', () => {
      it('returns expected options', async () => {
        const options = {
          meetingId: fakeMeeting.id,
        };

        const triggered = new Date();
        const fetchOptions = await cd.buildClientEventFetchRequestOptions({
          name: 'client.exit.app',
          payload: {trigger: 'user-interaction', canProceed: false},
          options,
        });

        assert.deepEqual(fetchOptions, {
          body: {
            metrics: [
              {
                eventPayload: {
                  event: {
                    canProceed: false,
                    eventData: {
                      webClientDomain: 'whatever',
                    },
                    identifiers: {
                      correlationId: 'correlationId',
                      deviceId: 'deviceUrl',
                      locusId: 'url',
                      locusStartTime: 'lastActive',
                      locusUrl: 'locus/url',
                      orgId: 'orgId',
                      userId: 'userId',
                    },
                    loginType: 'login-ci',
                    name: 'client.exit.app',
                    trigger: 'user-interaction',
                    userType: 'host',
                    isConvergedArchitectureEnabled: undefined,
                  },
                  eventId: 'my-fake-id',
                  origin: {
                    buildType: 'test',
                    clientInfo: {
                      clientType: 'TEAMS_CLIENT',
                      clientVersion: 'webex-js-sdk/webex-version',
                      localNetworkPrefix:
                        Utils.anonymizeIPAddress(webex.meetings.geoHintInfo?.clientAddress) ||
                        undefined,
                      os: getOSNameInternal() || 'unknown',
                      osVersion: getOSVersion(),
                      subClientType: 'WEB_APP',
                    },
                    environment: 'meeting_evn',
                    name: 'endpoint',
                    networkType: 'unknown',
                    userAgent,
                  },
                  originTime: {
                    sent: 'not_defined_yet',
                    triggered: triggered.toISOString(),
                  },
                  senderCountryCode: webex.meetings.geoHintInfo?.countryCode,
                  version: 1,
                },
                type: ['diagnostic-event'],
              },
            ],
          },
          foo: 'bar',
          method: 'POST',
          resource: 'clientmetrics',
          service: 'metrics',
        });
      });
    });
  });
});
