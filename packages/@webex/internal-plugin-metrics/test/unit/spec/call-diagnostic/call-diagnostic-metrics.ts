import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {WebexHttpError} from '@webex/webex-core';
import {BrowserDetection} from '@webex/common';
import {
  CallDiagnosticLatencies,
  CallDiagnosticMetrics,
  getOSNameInternal,
  CallDiagnosticUtils,
  config,
} from '@webex/internal-plugin-metrics';
import uuid from 'uuid';
import {omit} from 'lodash';

//@ts-ignore
global.window = {location: {hostname: 'whatever'}};
process.env.NODE_ENV = 'test';

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
      callStateForMetrics: {},
      environment: 'meeting_evn',
      locusUrl: 'locus/url',
      locusInfo: {
        fullState: {
          lastActive: 'lastActive',
        },
      },
      meetingInfo: {},
      getCurUserType: () => 'host',
      statsAnalyzer: {
        getLocalIpAddress: () => '192.168.1.90',
      },
    };

    const fakeMeeting2 = {
      ...fakeMeeting,
      id: '2',
      correlationId: 'correlationId2',
      callStateForMetrics: {loginType: 'fakeLoginType'},
    };

    const fakeMeetings = {
      1: fakeMeeting,
      2: fakeMeeting2,
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
            config: {...config.metrics},
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
              clientName: 'Cantina',
            },
          },
          meetingCollection: {
            get: (id) => fakeMeetings[id],
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
        request: sinon.stub().resolves({body: {}}),
        logger: {
          log: sinon.stub(),
          error: sinon.stub(),
        },
      };

      webex.internal.newMetrics.callDiagnosticLatencies = new CallDiagnosticLatencies(
        {},
        {parent: webex}
      );

      sinon.createSandbox();
      sinon.useFakeTimers(now.getTime());
      cd = new CallDiagnosticMetrics({}, {parent: webex});
      sinon.stub(uuid, 'v4').returns('my-fake-id');
      cd.setDeviceInfo(webex.internal.device);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('#validator', () => {
      it('should have a validator function defined', () => {
        assert.isDefined(cd.validator);
      });
    });

    describe('#getOrigin', () => {
      it('should build origin correctly', () => {
        sinon.stub(CallDiagnosticUtils, 'anonymizeIPAddress').returns('1.1.1.1');
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
            publicNetworkPrefix: '1.1.1.1',
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

      it('should build origin correctly with newEnvironment and createLaunchMethod', () => {
        sinon.stub(CallDiagnosticUtils, 'anonymizeIPAddress').returns('1.1.1.1');

        //@ts-ignore
        const res = cd.getOrigin(
          {
            subClientType: 'WEB_APP',
            clientType: 'TEAMS_CLIENT',
            newEnvironment: 'test-new-env',
            clientLaunchMethod: 'url-handler',
          },
          fakeMeeting.id
        );

        assert.deepEqual(res, {
          clientInfo: {
            browser: getBrowserName(),
            browserVersion: getBrowserVersion(),
            clientType: 'TEAMS_CLIENT',
            clientVersion: 'webex-js-sdk/webex-version',
            publicNetworkPrefix: '1.1.1.1',
            localNetworkPrefix: '1.1.1.1',
            os: getOSNameInternal(),
            osVersion: getOSVersion(),
            subClientType: 'WEB_APP',
            clientLaunchMethod: 'url-handler',
          },
          environment: 'meeting_evn',
          newEnvironment: 'test-new-env',
          name: 'endpoint',
          networkType: 'unknown',
          userAgent,
        });
      });

      it('should build origin correctly and environment can be passed in options', () => {
        sinon.stub(CallDiagnosticUtils, 'anonymizeIPAddress').returns('1.1.1.1');

        //@ts-ignore
        const res = cd.getOrigin(
          {
            subClientType: 'WEB_APP',
            clientType: 'TEAMS_CLIENT',
            clientLaunchMethod: 'url-handler',
            environment: 'test-env',
          },
          fakeMeeting.id
        );

        assert.deepEqual(res, {
          clientInfo: {
            browser: getBrowserName(),
            browserVersion: getBrowserVersion(),
            clientType: 'TEAMS_CLIENT',
            clientVersion: 'webex-js-sdk/webex-version',
            publicNetworkPrefix: '1.1.1.1',
            localNetworkPrefix: '1.1.1.1',
            os: getOSNameInternal(),
            osVersion: getOSVersion(),
            subClientType: 'WEB_APP',
            clientLaunchMethod: 'url-handler',
          },
          environment: 'test-env',
          name: 'endpoint',
          networkType: 'unknown',
          userAgent,
        });
      });

      it('should build origin correctly with browserLaunchMethod', () => {
        sinon.stub(CallDiagnosticUtils, 'anonymizeIPAddress').returns('1.1.1.1');

        //@ts-ignore
        const res = cd.getOrigin(
          {
            subClientType: 'WEB_APP',
            clientType: 'TEAMS_CLIENT',
            newEnvironment: 'test-new-env',
            clientLaunchMethod: 'url-handler',
            browserLaunchMethod: 'thinclient',
          },
          fakeMeeting.id
        );

        assert.deepEqual(res, {
          clientInfo: {
            browser: getBrowserName(),
            browserVersion: getBrowserVersion(),
            clientType: 'TEAMS_CLIENT',
            clientVersion: 'webex-js-sdk/webex-version',
            publicNetworkPrefix: '1.1.1.1',
            localNetworkPrefix: '1.1.1.1',
            os: getOSNameInternal(),
            osVersion: getOSVersion(),
            subClientType: 'WEB_APP',
            clientLaunchMethod: 'url-handler',
            browserLaunchMethod: 'thinclient',
          },
          environment: 'meeting_evn',
          newEnvironment: 'test-new-env',
          name: 'endpoint',
          networkType: 'unknown',
          userAgent,
        });
      });

      it('should build origin correctly with no meeting', () => {
        sinon.stub(CallDiagnosticUtils, 'anonymizeIPAddress').returns('1.1.1.1');

        //@ts-ignore
        const res = cd.getOrigin();

        assert.deepEqual(res, {
          clientInfo: {
            browser: getBrowserName(),
            browserVersion: getBrowserVersion(),
            clientType: 'TEAMS_CLIENT',
            clientVersion: 'webex-js-sdk/webex-version',
            publicNetworkPrefix: '1.1.1.1',
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

      it('builds origin correctly, when overriding clientVersion', () => {
        webex.meetings.config.metrics.clientVersion = '43.9.0.1234';

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
            clientVersion: '43.9.0.1234',
            publicNetworkPrefix: '1.3.4.0',
            localNetworkPrefix: '192.168.1.80',
            majorVersion: 43,
            minorVersion: 9,
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

      it('should build origin correctly with no meeting or stats analyzer', () => {
        //@ts-ignore
        const res = cd.getOrigin();

        assert.deepEqual(res, {
          clientInfo: {
            browser: getBrowserName(),
            browserVersion: getBrowserVersion(),
            clientType: 'TEAMS_CLIENT',
            clientVersion: 'webex-js-sdk/webex-version',
            publicNetworkPrefix: '1.3.4.0',
            localNetworkPrefix: undefined,
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
        cd.device = {
          ...cd.device,
          config: {installationId: 'installationId'},
        };

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
          machineId: 'installationId',
          mediaAgentAlias: 'mediaAgentAlias',
          mediaAgentGroupId: 'mediaAgentGroupId',
          orgId: 'orgId',
          userId: 'userId',
        });
      });

      it('should build identifiers correctly with a meeting that has meetingInfo with a webexConferenceIdStr and globalMeetingId, and that should take precedence over the options passed to it', () => {
        const res = cd.getIdentifiers({
          mediaConnections: [
            {mediaAgentAlias: 'mediaAgentAlias', mediaAgentGroupId: 'mediaAgentGroupId'},
          ],
          webexConferenceIdStr: 'webexConferenceIdStr',
          globalMeetingId: 'globalMeetingId',
          meeting: {
            ...fakeMeeting,
            meetingInfo: {
              ...fakeMeeting.meetingInfo,
              confID: 'webexConferenceIdStr1',
              meetingId: 'globalMeetingId1',
            },
          },
        });

        assert.deepEqual(res, {
          correlationId: 'correlationId',
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
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

      it('should build identifiers correctly with a meeting that has meetingInfo with a webexConferenceIdStr and globalMeetingId, and that should take precedence over the options passed to it', () => {
        const res = cd.getIdentifiers({
          mediaConnections: [
            {mediaAgentAlias: 'mediaAgentAlias', mediaAgentGroupId: 'mediaAgentGroupId'},
          ],
          webexConferenceIdStr: 'webexConferenceIdStr',
          globalMeetingId: 'globalMeetingId',
          meeting: {
            ...fakeMeeting,
            meetingInfo: {
              ...fakeMeeting.meetingInfo,
              confIdStr: 'webexConferenceIdStr1',
              meetingId: 'globalMeetingId1',
            },
          },
        });

        assert.deepEqual(res, {
          correlationId: 'correlationId',
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
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

      it('should build identifiers correctly with a meeting that has meetingInfo with siteName', () => {
        const res = cd.getIdentifiers({
          mediaConnections: [
            {mediaAgentAlias: 'mediaAgentAlias', mediaAgentGroupId: 'mediaAgentGroupId'},
          ],
          webexConferenceIdStr: 'webexConferenceIdStr',
          globalMeetingId: 'globalMeetingId',
          meeting: {
            ...fakeMeeting,
            meetingInfo: {
              ...fakeMeeting.meetingInfo,
              confIdStr: 'webexConferenceIdStr1',
              meetingId: 'globalMeetingId1',
              siteName: 'siteName1',
            },
          },
        });

        assert.deepEqual(res, {
          correlationId: 'correlationId',
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
          deviceId: 'deviceUrl',
          locusId: 'url',
          locusStartTime: 'lastActive',
          locusUrl: 'locus/url',
          mediaAgentAlias: 'mediaAgentAlias',
          mediaAgentGroupId: 'mediaAgentGroupId',
          orgId: 'orgId',
          userId: 'userId',
          webexSiteName: 'siteName1',
        });
      });

      it('should build identifiers correctly given webexConferenceIdStr', () => {
        const res = cd.getIdentifiers({
          correlationId: 'correlationId',
          webexConferenceIdStr: 'webexConferenceIdStr1',
        });

        assert.deepEqual(res, {
          correlationId: 'correlationId',
          webexConferenceIdStr: 'webexConferenceIdStr1',
          deviceId: 'deviceUrl',
          locusUrl: 'locus-url',
          orgId: 'orgId',
          userId: 'userId',
        });
      });

      it('should build identifiers correctly given globalMeetingId', () => {
        const res = cd.getIdentifiers({
          correlationId: 'correlationId',
          globalMeetingId: 'globalMeetingId1',
        });

        assert.deepEqual(res, {
          correlationId: 'correlationId',
          globalMeetingId: 'globalMeetingId1',
          deviceId: 'deviceUrl',
          locusUrl: 'locus-url',
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

      it('should build identifiers correctly given preLoginId and no device userId available', () => {
        cd.device.userId = undefined;

        const res = cd.getIdentifiers({
          correlationId: 'correlationId',
          preLoginId: 'preLoginId',
        });

        assert.deepEqual(res, {
          correlationId: 'correlationId',
          locusUrl: 'locus-url',
          deviceId: 'deviceUrl',
          orgId: 'orgId',
          userId: 'preLoginId',
        });
      });
    });

    it('should prepare diagnostic event successfully', () => {
      const options = {meetingId: fakeMeeting.id};
      const getOriginStub = sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
      const clearEmptyKeysRecursivelyStub = sinon.stub(
        CallDiagnosticUtils,
        'clearEmptyKeysRecursively'
      );

      const res = cd.prepareDiagnosticEvent(
        {
          canProceed: false,
          identifiers: {
            correlationId: 'id',
            webexConferenceIdStr: 'webexConferenceIdStr1',
            globalMeetingId: 'globalMeetingId1',
          },
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
            webexConferenceIdStr: 'webexConferenceIdStr1',
            globalMeetingId: 'globalMeetingId1',
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
        const getSubServiceTypeSpy = sinon.spy(cd, 'getSubServiceType');
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const validatorSpy = sinon.spy(cd, 'validator');
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
          webexConferenceIdStr: undefined,
          globalMeetingId: undefined,
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
            webexSubServiceType: undefined,
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
            webexSubServiceType: undefined,
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
        assert.calledWith(validatorSpy, {
          type: 'ce',
          event: {
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
              webexSubServiceType: undefined,
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
          },
        });

        const webexLoggerLogCalls = webex.logger.log.getCalls();
        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
        ]);
      });

      it('should log browser data, but only for the first call diagnostic event', () => {
        const prepareDiagnosticEventSpy = sinon.spy(cd, 'prepareDiagnosticEvent');
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');
        const generateClientEventErrorPayloadSpy = sinon.spy(cd, 'generateClientEventErrorPayload');
        const getIdentifiersSpy = sinon.spy(cd, 'getIdentifiers');
        const getSubServiceTypeSpy = sinon.spy(cd, 'getSubServiceType');
        const validatorSpy = sinon.spy(cd, 'validator');
        const options = {
          meetingId: fakeMeeting.id,
          mediaConnections: [{mediaAgentAlias: 'alias', mediaAgentGroupId: '1'}],
        };

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          options,
        });

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          options,
        });

        const webexLoggerLogCalls = webex.logger.log.getCalls();

        assert.deepEqual(webexLoggerLogCalls.length, 4);

        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @createClientEventObjectInMeeting => collected browser data',
          '{"error":"unable to access window.navigator.userAgent"}',
        ]);

        assert.deepEqual(webexLoggerLogCalls[3].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
        ]);
      });

      it('should submit client event successfully with correlationId, webexConferenceIdStr and globalMeetingId', () => {
        const prepareDiagnosticEventSpy = sinon.spy(cd, 'prepareDiagnosticEvent');
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');
        const generateClientEventErrorPayloadSpy = sinon.spy(cd, 'generateClientEventErrorPayload');
        const getIdentifiersSpy = sinon.spy(cd, 'getIdentifiers');
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});

        const options = {
          correlationId: 'correlationId',
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
        };

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          options,
        });

        assert.calledWith(getIdentifiersSpy, {
          correlationId: 'correlationId',
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
          preLoginId: undefined,
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
              webexConferenceIdStr: 'webexConferenceIdStr1',
              globalMeetingId: 'globalMeetingId1',
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
              webexConferenceIdStr: 'webexConferenceIdStr1',
              globalMeetingId: 'globalMeetingId1',
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

        const webexLoggerLogCalls = webex.logger.log.getCalls();

        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
        ]);
      });

      it('should submit client event successfully with preLoginId', () => {
        cd.device.userId = undefined;

        const prepareDiagnosticEventSpy = sinon.spy(cd, 'prepareDiagnosticEvent');
        const submitToCallDiagnosticsPreLoginSpy = sinon.spy(cd, 'submitToCallDiagnosticsPreLogin');
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');
        const generateClientEventErrorPayloadSpy = sinon.spy(cd, 'generateClientEventErrorPayload');
        const getIdentifiersSpy = sinon.spy(cd, 'getIdentifiers');
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});

        const options = {
          correlationId: 'correlationId',
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
          preLoginId: 'myPreLoginId',
        };

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          options,
        });

        assert.calledWith(getIdentifiersSpy, {
          correlationId: 'correlationId',
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
          preLoginId: 'myPreLoginId',
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
              webexConferenceIdStr: 'webexConferenceIdStr1',
              globalMeetingId: 'globalMeetingId1',
              deviceId: 'deviceUrl',
              locusUrl: 'locus-url',
              orgId: 'orgId',
              userId: 'myPreLoginId',
            },
            loginType: 'login-ci',
            name: 'client.alert.displayed',
          },
          options
        );
        assert.notCalled(submitToCallDiagnosticsSpy);
        assert.calledWith(
          submitToCallDiagnosticsPreLoginSpy,
          {
            eventId: 'my-fake-id',
            version: 1,
            origin: {origin: 'fake-origin'},
            originTime: {triggered: now.toISOString(), sent: 'not_defined_yet'},
            senderCountryCode: 'UK',
            event: {
              name: 'client.alert.displayed',
              canProceed: true,
              identifiers: {
                correlationId: 'correlationId',
                userId: 'myPreLoginId',
                deviceId: 'deviceUrl',
                orgId: 'orgId',
                locusUrl: 'locus-url',
                webexConferenceIdStr: 'webexConferenceIdStr1',
                globalMeetingId: 'globalMeetingId1',
              },
              eventData: {webClientDomain: 'whatever'},
              loginType: 'login-ci',
            },
          },
          options.preLoginId
        );
      });

      it('should use meeting loginType if present and meetingId provided', () => {
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const options = {
          meetingId: fakeMeeting2.id,
          mediaConnections: [{mediaAgentAlias: 'alias', mediaAgentGroupId: '1'}],
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
              correlationId: 'correlationId2',
              deviceId: 'deviceUrl',
              locusId: 'url',
              locusStartTime: 'lastActive',
              locusUrl: 'locus/url',
              mediaAgentAlias: 'alias',
              mediaAgentGroupId: '1',
              orgId: 'orgId',
              userId: 'userId',
            },
            loginType: 'fakeLoginType',
            name: 'client.alert.displayed',
            userType: 'host',
            isConvergedArchitectureEnabled: undefined,
            webexSubServiceType: undefined,
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

      it('it should include errors if provided with meetingId', () => {
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');

        const options = {
          meetingId: fakeMeeting.id,
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
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
              webexConferenceIdStr: 'webexConferenceIdStr1',
              globalMeetingId: 'globalMeetingId1',
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
                rawErrorMessage: undefined,
              },
            ],
            loginType: 'login-ci',
            name: 'client.alert.displayed',
            userType: 'host',
            isConvergedArchitectureEnabled: undefined,
            webexSubServiceType: undefined,
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

        const webexLoggerLogCalls = webex.logger.log.getCalls();
        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Generated errors:',
          `generatedError: {"fatal":true,"shownToUser":false,"name":"other","category":"expected","errorCode":4029,"serviceErrorCode":2409005,"errorDescription":"StartRecordingFailed"}`,
        ]);
      });

      it('it send the raw error message if meetingId provided', () => {
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');

        const options = {
          meetingId: fakeMeeting.id,
          mediaConnections: [{mediaAgentAlias: 'alias', mediaAgentGroupId: '1'}],
          rawError: new Error('bad times'),
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
                fatal: true,
                shownToUser: false,
                name: 'other',
                category: 'other',
                errorCode: 9999,
                serviceErrorCode: 9999,
                errorDescription: 'UnknownError',
                rawErrorMessage: 'bad times',
              },
            ],
            loginType: 'login-ci',
            name: 'client.alert.displayed',
            userType: 'host',
            isConvergedArchitectureEnabled: undefined,
            webexSubServiceType: undefined,
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

        const webexLoggerLogCalls = webex.logger.log.getCalls();
        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Generated errors:',
          `generatedError: {"fatal":true,"shownToUser":false,"name":"other","category":"other","errorCode":9999,"serviceErrorCode":9999,"rawErrorMessage":"bad times","errorDescription":"UnknownError"}`,
        ]);
      });

      it('it should send the raw error message if provided with correlationId', () => {
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');

        const options = {
          correlationId: 'correlationId',
          rawError: new Error('bad times'),
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
              locusUrl: 'locus-url',
              orgId: 'orgId',
              userId: 'userId',
            },
            errors: [
              {
                fatal: true,
                shownToUser: false,
                name: 'other',
                category: 'other',
                errorCode: 9999,
                serviceErrorCode: 9999,
                errorDescription: 'UnknownError',
                rawErrorMessage: 'bad times',
              },
            ],
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

        const webexLoggerLogCalls = webex.logger.log.getCalls();

        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Generated errors:',
          `generatedError: {"fatal":true,"shownToUser":false,"name":"other","category":"other","errorCode":9999,"serviceErrorCode":9999,"rawErrorMessage":"bad times","errorDescription":"UnknownError"}`,
        ]);
      });

      it('it should include errors if provided with correlationId', () => {
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');

        const options = {
          correlationId: 'correlationId',
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
              locusUrl: 'locus-url',
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
                rawErrorMessage: undefined,
              },
            ],
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

        const webexLoggerLogCalls = webex.logger.log.getCalls();

        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Generated errors:',
          `generatedError: {"fatal":true,"shownToUser":false,"name":"other","category":"expected","errorCode":4029,"serviceErrorCode":2409005,"errorDescription":"StartRecordingFailed"}`,
        ]);
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
            webexSubServiceType: undefined,
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

      it('should submit client to diagnostic when no preLoginId provided', () => {
        const testEvent = {name: 'client.alert.displayed', options: {meetingId: 'meetingId'}};
        sinon.stub(cd, 'prepareClientEvent').returns(testEvent);
        sinon.stub(cd, 'submitToCallDiagnostics');
        sinon.stub(cd, 'submitToCallDiagnosticsPreLogin');
        //@ts-ignore
        cd.submitClientEvent(testEvent);
        assert.calledWith(cd.submitToCallDiagnostics, testEvent);
        assert.notCalled(cd.submitToCallDiagnosticsPreLogin);
      });

      it('should submit event to prelogin when preLoginId provided', () => {
        const testEvent = {name: 'client.alert.displayed', options: {preLoginId: 'preLoginId'}};
        sinon.stub(cd, 'prepareClientEvent').returns(testEvent);
        sinon.stub(cd, 'submitToCallDiagnosticsPreLogin');
        sinon.stub(cd, 'submitToCallDiagnostics');
        //@ts-ignore
        cd.submitClientEvent(testEvent);
        assert.calledWith(cd.submitToCallDiagnosticsPreLogin, testEvent);
        assert.notCalled(cd.submitToCallDiagnostics);
      });
    });

    describe('#submitToCallDiagnostics', () => {
      it('should send request to call diagnostic batcher', () => {
        const requestStub = sinon.stub();
        //@ts-ignore
        cd.callDiagnosticEventsBatcher = {request: requestStub};
        //@ts-ignore
        cd.submitToCallDiagnostics({event: 'test'});
        assert.calledWith(requestStub, {eventPayload: {event: 'test'}, type: ['diagnostic-event']});
      });
    });

    describe('#submitMQE', () => {
      it('submits the event correctly', () => {
        const prepareDiagnosticEventSpy = sinon.spy(cd, 'prepareDiagnosticEvent');
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');
        const getErrorPayloadForClientErrorCodeSpy = sinon.spy(
          cd,
          'getErrorPayloadForClientErrorCode'
        );
        const validatorSpy = sinon.spy(cd, 'validator');
        const getIdentifiersSpy = sinon.spy(cd, 'getIdentifiers');
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const options = {
          networkType: 'wifi' as const,
          meetingId: fakeMeeting.id,
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
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
          webexConferenceIdStr: 'webexConferenceIdStr1',
          globalMeetingId: 'globalMeetingId1',
        });
        assert.notCalled(getErrorPayloadForClientErrorCodeSpy);
        assert.calledWith(
          prepareDiagnosticEventSpy,
          {
            name: 'client.mediaquality.event',
            canProceed: true,
            identifiers: {
              correlationId: 'correlationId',
              webexConferenceIdStr: 'webexConferenceIdStr1',
              globalMeetingId: 'globalMeetingId1',
              userId: 'userId',
              deviceId: 'deviceUrl',
              orgId: 'orgId',
              locusUrl: 'locus/url',
              locusId: 'url',
              locusStartTime: 'lastActive',
            },
            eventData: {webClientDomain: 'whatever'},
            intervals: [{}],
            callingServiceType: 'LOCUS',
            meetingJoinInfo: {
              clientSignallingProtocol: 'WebRTC',
            },
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

        assert.calledWith(validatorSpy, {
          type: 'mqe',
          event: {
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
                webexConferenceIdStr: 'webexConferenceIdStr1',
                globalMeetingId: 'globalMeetingId1',
                userId: 'userId',
                deviceId: 'deviceUrl',
                orgId: 'orgId',
                locusUrl: 'locus/url',
                locusId: 'url',
                locusStartTime: 'lastActive',
              },
              eventData: {webClientDomain: 'whatever'},
              intervals: [{}],
              callingServiceType: 'LOCUS',
              meetingJoinInfo: {
                clientSignallingProtocol: 'WebRTC',
              },
              sourceMetadata: {
                applicationSoftwareType: 'webex-js-sdk',
                applicationSoftwareVersion: 'webex-version',
                mediaEngineSoftwareType: 'browser',
                mediaEngineSoftwareVersion: getOSVersion(),
                startTime: now.toISOString(),
              },
            },
          },
        });

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
              webexConferenceIdStr: 'webexConferenceIdStr1',
              globalMeetingId: 'globalMeetingId1',
              userId: 'userId',
              deviceId: 'deviceUrl',
              orgId: 'orgId',
              locusUrl: 'locus/url',
              locusId: 'url',
              locusStartTime: 'lastActive',
            },
            eventData: {webClientDomain: 'whatever'},
            intervals: [{}],
            callingServiceType: 'LOCUS',
            meetingJoinInfo: {
              clientSignallingProtocol: 'WebRTC',
            },
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
          rawErrorMessage: undefined,
        });
      });

      it('should include rawErrorMessage if provided', () => {
        const res = cd.getErrorPayloadForClientErrorCode({
          clientErrorCode: 4008,
          serviceErrorCode: 10000,
          rawErrorMessage: 'bad times',
        });
        assert.deepEqual(res, {
          category: 'signaling',
          errorDescription: 'NewLocusError',
          fatal: true,
          name: 'other',
          shownToUser: false,
          errorCode: 4008,
          serviceErrorCode: 10000,
          rawErrorMessage: 'bad times',
        });
      });

      it('should generate the correct payload for client error 4009', () => {
        const res = cd.getErrorPayloadForClientErrorCode({
          clientErrorCode: 4009,
          serviceErrorCode: undefined,
        });
        assert.deepEqual(res, {
          category: 'network',
          errorDescription: 'NetworkUnavailable',
          fatal: true,
          name: 'other',
          shownToUser: false,
          errorCode: 4009,
          serviceErrorCode: undefined,
          rawErrorMessage: undefined,
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
      const defaultExpectedRes = {
        category: 'expected',
        errorDescription: 'StartRecordingFailed',
        fatal: true,
        name: 'other',
        shownToUser: false,
        errorCode: 4029,
        serviceErrorCode: 2409005,
        rawErrorMessage: 'bad times',
      };

      const checkNameError = (payload: any, isExpectedToBeCalled: boolean) => {
        const res = cd.generateClientEventErrorPayload(payload);
        const expectedResult = {
          category: 'expected',
          errorDescription: 'CameraPermissionDenied',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: undefined,
          errorCode: 4032,
          errorData: {errorName: payload.name},
          rawErrorMessage: payload.message,
        };

        if (isExpectedToBeCalled) {
          assert.deepEqual(res, expectedResult);
        } else {
          assert.notDeepEqual(res, expectedResult);
        }
      };

      it('should generate media event error payload if rawError has a media error name', () => {
        checkNameError({name: 'PermissionDeniedError', message: 'bad times'}, true);
      });

      it('should not generate media event error payload if rawError has a name that is not recognized', () => {
        checkNameError({name: 'SomeRandomError', message: 'bad times'}, false);
      });

      const checkCodeError = (payload: any, expetedRes: any) => {
        const res = cd.generateClientEventErrorPayload(payload);
        assert.deepEqual(res, expetedRes);
      };
      it('should generate event error payload correctly', () => {
        checkCodeError({body: {errorCode: 2409005}, message: 'bad times'}, defaultExpectedRes);
      });

      it('should generate event error payload correctly if rawError has body.code', () => {
        checkCodeError({body: {code: 2409005}, message: 'bad times'}, defaultExpectedRes);
      });

      it('should generate event error payload correctly if rawError has body.reason.reasonCode', () => {
        checkCodeError(
          {body: {reason: {reasonCode: 2409005}}, message: 'bad times'},
          defaultExpectedRes
        );
      });

      it('should generate event error payload correctly if rawError has error.body.errorCode', () => {
        checkCodeError(
          {error: {body: {errorCode: 2409005}}, message: 'bad times'},
          defaultExpectedRes
        );
      });

      const checkLocusError = (payload: any, isExpectedToBeCalled: boolean) => {
        const res = cd.generateClientEventErrorPayload(payload);
        const expectedResult = {
          category: 'signaling',
          errorDescription: 'NewLocusError',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: 2400000,
          errorCode: 4008,
          rawErrorMessage: 'bad times',
        };

        if (isExpectedToBeCalled) {
          assert.deepEqual(res, expectedResult);
        } else {
          assert.notDeepEqual(res, expectedResult);
        }
      };

      it('should return default new locus event error payload correctly if locus error is recognized', () => {
        checkLocusError({body: {errorCode: 2400000}, message: 'bad times'}, true);
      });

      it('should not return default new locus event error payload correctly if locus is not recognized', () => {
        checkLocusError({body: {errorCode: 1400000}, message: 'bad times'}, false);
      });

      const checkMeetingInfoError = (payload: any, isExpectedToBeCalled: boolean) => {
        const res = cd.generateClientEventErrorPayload(payload);
        const expectedResult = {
          category: 'signaling',
          errorDescription: 'MeetingInfoLookupError',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: undefined,
          errorCode: 4100,
          rawErrorMessage: 'bad times',
        };

        if (isExpectedToBeCalled) {
          assert.deepEqual(res, expectedResult);
        } else {
          assert.notDeepEqual(res, expectedResult);
        }
      };

      it('should return default meeting info lookup error payload if data.meetingInfo was found on error body', () => {
        checkMeetingInfoError(
          {body: {data: {meetingInfo: 'something'}}, message: 'bad times'},
          true
        );
      });

      it('should return default meeting info lookup error payload if body.url contains wbxappapi', () => {
        checkMeetingInfoError(
          {body: {url: '1234567-wbxappapiabcdefg'}, message: 'bad times'},
          true
        );
      });

      it('should not return default meeting info lookup error payload if body.url does not contain wbxappapi and data.meetingInfo was not found on error body', () => {
        checkMeetingInfoError(
          {body: {data: '1234567-wbxappapiabcdefg'}, message: 'bad times'},
          false
        );
      });

      it('should return NetworkError code for a NetworkOrCORSERror', () => {
        const res = cd.generateClientEventErrorPayload(
          new WebexHttpError.NetworkOrCORSError({
            url: 'https://example.com',
            statusCode: 0,
            body: {},
            options: {headers: {}, url: 'https://example.com'},
          })
        );
        assert.deepEqual(res, {
          category: 'network',
          errorDescription: 'NetworkError',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: undefined,
          errorCode: 1026,
          rawErrorMessage: '{}\nundefined https://example.com\nWEBEX_TRACKING_ID: undefined\n',
          httpStatusCode: 0,
        });
      });

      describe('SdpOfferCreationError', () => {
        // cant use actual types from internal-media-core because the dependency causes issues
        type TestWcmeError = {
          type: string;
          message: string;
        };

        type TestSdpOfferCreationError = {
          code: number;
          message: string;
          name: string;
          cause: TestWcmeError;
        };
        it('should return SDP error code correctly for a SdpOfferCreationError with cause of missing codecs', () => {
          const error: TestSdpOfferCreationError = {
            code: 30005,
            name: 'SdpOfferCreationError',
            message: 'No codecs present in m-line with MID 0 after filtering.',
            cause: {
              type: 'SDP_MUNGE_MISSING_CODECS',
              message: 'No codecs present in m-line with MID 0 after filtering.',
            },
          };
          const res = cd.generateClientEventErrorPayload(error);
          assert.deepEqual(res, {
            category: 'expected',
            errorCode: 2051,
            errorData: {
              errorName: 'SdpOfferCreationError',
            },
            errorDescription: 'SdpOfferCreationErrorMissingCodec',
            fatal: true,
            name: 'other',
            rawErrorMessage: 'No codecs present in m-line with MID 0 after filtering.',
            serviceErrorCode: undefined,
            shownToUser: true,
          });
        });

        it('should return SDP error code correctly for a SdpOfferCreationError with any cause other than missing codecs', () => {
          const error: TestSdpOfferCreationError = {
            code: 30005,
            name: 'SdpOfferCreationError',
            message: 'error message',
            cause: {
              type: 'CREATE_OFFER_FAILED',
              message: 'empty local SDP',
            },
          };
          const res = cd.generateClientEventErrorPayload(error);
          assert.deepEqual(res, {
            category: 'media',
            errorCode: 2050,
            errorData: {
              errorName: 'SdpOfferCreationError',
            },
            errorDescription: 'SdpOfferCreationError',
            fatal: true,
            name: 'other',
            rawErrorMessage: 'error message',
            serviceErrorCode: undefined,
            shownToUser: true,
          });
        });
      });

      it('should override custom properties for an unknown error', () => {
        const error = new Error('bad times');

        (error as any).payloadOverrides = {
          shownToUser: true,
          category: 'expected',
        };

        const res = cd.generateClientEventErrorPayload(error);
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'UnknownError',
          fatal: true,
          name: 'other',
          shownToUser: true,
          serviceErrorCode: 9999,
          errorCode: 9999,
          rawErrorMessage: 'bad times',
        });
      });

      it('should override custom properties for a NetworkOrCORSError', () => {
        const error = new WebexHttpError.NetworkOrCORSError({
          url: 'https://example.com',
          statusCode: 0,
          body: {},
          options: {headers: {}, url: 'https://example.com'},
        });

        error.payloadOverrides = {
          shownToUser: true,
          category: 'expected',
        };

        const res = cd.generateClientEventErrorPayload(error);
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'NetworkError',
          fatal: true,
          name: 'other',
          shownToUser: true,
          serviceErrorCode: undefined,
          errorCode: 1026,
          rawErrorMessage: '{}\nundefined https://example.com\nWEBEX_TRACKING_ID: undefined\n',
          httpStatusCode: 0,
        });
      });

      it('should return AuthenticationFailed code for an Unauthorized error', () => {
        const res = cd.generateClientEventErrorPayload(
          new WebexHttpError.Unauthorized({
            url: 'https://example.com',
            statusCode: 0,
            body: {},
            options: {headers: {}, url: 'https://example.com'},
          })
        );
        assert.deepEqual(res, {
          category: 'network',
          errorDescription: 'AuthenticationFailed',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: undefined,
          errorCode: 1010,
          rawErrorMessage: '{}\nundefined https://example.com\nWEBEX_TRACKING_ID: undefined\n',
          httpStatusCode: 0,
        });
      });

      it('should override custom properties for an Unauthorized error', () => {
        const error = new WebexHttpError.Unauthorized({
          url: 'https://example.com',
          statusCode: 0,
          body: {},
          options: {headers: {}, url: 'https://example.com'},
        });
        error.payloadOverrides = {
          shownToUser: true,
          category: 'expected',
        };

        const res = cd.generateClientEventErrorPayload(error);
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'AuthenticationFailed',
          fatal: true,
          name: 'other',
          shownToUser: true,
          serviceErrorCode: undefined,
          errorCode: 1010,
          rawErrorMessage: '{}\nundefined https://example.com\nWEBEX_TRACKING_ID: undefined\n',
          httpStatusCode: 0,
        });
      });

      it('should return unknown error otherwise', () => {
        const res = cd.generateClientEventErrorPayload({something: 'new', message: 'bad times'});
        assert.deepEqual(res, {
          category: 'other',
          errorDescription: 'UnknownError',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: 9999,
          errorCode: 9999,
          rawErrorMessage: 'bad times',
        });
      });

      it('should generate event error payload correctly for locus error 2423012', () => {
        const res = cd.generateClientEventErrorPayload({
          body: {errorCode: 2423012},
          message: 'bad times',
        });
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'FraudDetection',
          fatal: true,
          name: 'locus.response',
          shownToUser: true,
          serviceErrorCode: 2423012,
          errorCode: 12000,
          rawErrorMessage: 'bad times',
        });
      });
      it('should generate event error payload correctly for locus error 2409062', () => {
        const res = cd.generateClientEventErrorPayload({
          body: {errorCode: 2409062},
          message: 'bad times',
        });
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'E2EENotSupported',
          fatal: true,
          name: 'locus.response',
          shownToUser: true,
          serviceErrorCode: 2409062,
          errorCode: 12002,
          rawErrorMessage: 'bad times',
        });
      });

      it('should generate event error payload correctly for locus error 2423021', () => {
        const res = cd.generateClientEventErrorPayload({
          body: {errorCode: 2423021},
          message: 'bad times',
        });
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'LocusLobbyFullCMR',
          fatal: true,
          name: 'locus.response',
          shownToUser: true,
          serviceErrorCode: 2423021,
          errorCode: 12001,
          rawErrorMessage: 'bad times',
        });
      });

      describe('httpStatusCode', () => {
        it('should include httpStatusCode for browser media errors', () => {
          const res = cd.generateClientEventErrorPayload({
            name: 'PermissionDeniedError',
            message: 'bad times',
            statusCode: 401,
          });
          assert.deepEqual(res, {
            category: 'expected',
            errorCode: 4032,
            errorData: {
              errorName: 'PermissionDeniedError',
            },
            errorDescription: 'CameraPermissionDenied',
            fatal: true,
            name: 'other',
            rawErrorMessage: 'bad times',
            serviceErrorCode: undefined,
            shownToUser: false,
            httpStatusCode: 401,
          });
        });

        it('should include httpStatusCode for SdpOfferCreationErrors', () => {
          const res = cd.generateClientEventErrorPayload({
            name: 'SdpOfferCreationError',
            message: 'bad times',
            statusCode: 404,
          });
          assert.deepEqual(res, {
            category: 'media',
            errorCode: 2050,
            errorData: {
              errorName: 'SdpOfferCreationError',
            },
            errorDescription: 'SdpOfferCreationError',
            fatal: true,
            name: 'other',
            rawErrorMessage: 'bad times',
            serviceErrorCode: undefined,
            shownToUser: true,
            httpStatusCode: 404,
          });
        });

        it('should include httpStatusCode for service error codes', () => {
          const res = cd.generateClientEventErrorPayload({
            body: {errorCode: 58400},
            message: 'bad times',
            statusCode: 400,
          });
          assert.deepEqual(res, {
            category: 'signaling',
            errorCode: 4100,
            errorDescription: 'MeetingInfoLookupError',
            fatal: true,
            name: 'other',
            rawErrorMessage: 'bad times',
            serviceErrorCode: 58400,
            shownToUser: false,
            httpStatusCode: 400,
          });
        });

        it('should include httpStatusCode for locus service error codes', () => {
          const res = cd.generateClientEventErrorPayload({
            body: {errorCode: 2403001},
            message: 'bad times',
            statusCode: 400,
          });
          assert.deepEqual(res, {
            category: 'expected',
            errorCode: 3007,
            errorDescription: 'StreamErrorNoMedia',
            fatal: true,
            name: 'other',
            rawErrorMessage: 'bad times',
            serviceErrorCode: 2403001,
            shownToUser: false,
            httpStatusCode: 400,
          });
        });

        it('should include httpStatusCode for meetingInfo service error codes', () => {
          const res = cd.generateClientEventErrorPayload({
            body: {data: {meetingInfo: {}}},
            message: 'bad times',
            statusCode: 400,
          });
          assert.deepEqual(res, {
            category: 'signaling',
            errorCode: 4100,
            errorDescription: 'MeetingInfoLookupError',
            fatal: true,
            name: 'other',
            rawErrorMessage: 'bad times',
            serviceErrorCode: undefined,
            shownToUser: false,
            httpStatusCode: 400,
          });
        });

        it('should include httpStatusCode for network errors', () => {
          const error = new WebexHttpError.NetworkOrCORSError({
            statusCode: 400,
            options: {service: '', headers: {}},
          });
          const res = cd.generateClientEventErrorPayload(error);
          assert.deepEqual(res, {
            category: 'network',
            errorCode: 1026,
            errorDescription: 'NetworkError',
            fatal: true,
            name: 'other',
            rawErrorMessage: 'undefined\nundefined /undefined\nWEBEX_TRACKING_ID: undefined\n',
            serviceErrorCode: undefined,
            shownToUser: false,
            httpStatusCode: 400,
          });
        });

        it('should include httpStatusCode for unauthorized errors', () => {
          const error = new WebexHttpError.Unauthorized({
            statusCode: 401,
            options: {service: '', headers: {}},
          });
          const res = cd.generateClientEventErrorPayload(error);
          assert.deepEqual(res, {
            category: 'network',
            errorCode: 1010,
            errorDescription: 'AuthenticationFailed',
            fatal: true,
            name: 'other',
            rawErrorMessage: 'undefined\nundefined /undefined\nWEBEX_TRACKING_ID: undefined\n',
            serviceErrorCode: undefined,
            shownToUser: false,
            httpStatusCode: 401,
          });
        });

        it('should include httpStatusCode for unknown errors', () => {
          const res = cd.generateClientEventErrorPayload({
            message: 'bad times',
            statusCode: 404,
          });
          assert.deepEqual(res, {
            fatal: true,
            shownToUser: false,
            name: 'other',
            category: 'other',
            errorCode: 9999,
            serviceErrorCode: 9999,
            errorDescription: 'UnknownError',
            rawErrorMessage: 'bad times',
            httpStatusCode: 404,
          });
        });
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

    describe('#getSubServiceType', () => {
      it('returns subServicetype as PMR when PMR meeting', () => {
        fakeMeeting.meetingInfo = {
          webexScheduled: false,
          pmr: true,
          enableEvent: false,
        };
        assert.deepEqual(cd.getSubServiceType(fakeMeeting), 'PMR');
      });

      it('returns subServicetype as ScheduledMeeting when regular meeting', () => {
        fakeMeeting.meetingInfo = {
          webexScheduled: true,
          pmr: false,
          enableEvent: false,
        };
        assert.deepEqual(cd.getSubServiceType(fakeMeeting), 'ScheduledMeeting');
      });

      it('returns subServicetype as Webinar when meeting is Webinar', () => {
        fakeMeeting.meetingInfo = {
          webexScheduled: true,
          pmr: false,
          enableEvent: true,
        };
        assert.deepEqual(cd.getSubServiceType(fakeMeeting), 'Webinar');
      });

      it('returns subServicetype as undefined when correct parameters are not found', () => {
        fakeMeeting.meetingInfo = {};
        assert.deepEqual(cd.getSubServiceType(fakeMeeting), undefined);
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
        assert.deepEqual(
          cd.getIsConvergedArchitectureEnabled({meetingId: fakeMeeting.id}),
          undefined
        );
      });
    });

    describe('#buildClientEventFetchRequestOptions', () => {
      [undefined, 'myPreLoginId'].forEach((preLoginId) => {
        it('returns expected options without preLoginId', async () => {
          const options = {
            meetingId: fakeMeeting.id,
            preLoginId,
          };

          const triggered = new Date();
          const fetchOptions = await cd.buildClientEventFetchRequestOptions({
            name: 'client.exit.app',
            payload: {trigger: 'user-interaction', canProceed: false},
            options,
          });

          assert.deepEqual(fetchOptions.body, {
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
                    webexSubServiceType: undefined,
                  },
                  eventId: 'my-fake-id',
                  origin: {
                    buildType: 'test',
                    clientInfo: {
                      clientType: 'TEAMS_CLIENT',
                      clientVersion: 'webex-js-sdk/webex-version',
                      localNetworkPrefix: '192.168.1.80',
                      publicNetworkPrefix: '1.3.4.0',
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
          });

          const rest = omit(fetchOptions, 'body');

          if (preLoginId) {
            assert.deepEqual(rest, {
              foo: 'bar',
              method: 'POST',
              resource: 'clientmetrics-prelogin',
              service: 'metrics',
              waitForServiceTimeout: config.metrics.waitForServiceTimeout,
              headers: {
                authorization: false,
                'x-prelogin-userid': preLoginId,
              },
            });
          } else {
            assert.deepEqual(rest, {
              foo: 'bar',
              method: 'POST',
              resource: 'clientmetrics',
              service: 'metrics',
              headers: {},
              waitForServiceTimeout: config.metrics.waitForServiceTimeout,
            });
          }

          const webexLoggerLogCalls = webex.logger.log.getCalls();

          assert.deepEqual(webexLoggerLogCalls[1].args, [
            'call-diagnostic-events -> ',
            'CallDiagnosticMetrics: @buildClientEventFetchRequestOptions. Building request options object for fetch()...',
            `name: client.exit.app`,
          ]);
        });
      });
    });

    describe('#submitToCallDiagnosticsPreLogin', () => {
      it('should send request to call diagnostic batcher and saves preLoginId', () => {
        const requestStub = sinon.stub();
        //@ts-ignore
        const preLoginId = '123';
        //@ts-ignore
        cd.preLoginMetricsBatcher = {request: requestStub, savePreLoginId: sinon.stub()};
        //@ts-ignore
        cd.submitToCallDiagnosticsPreLogin({event: 'test'}, preLoginId);
        //@ts-ignore
        assert.calledWith(cd.preLoginMetricsBatcher.savePreLoginId, preLoginId);
        assert.calledWith(requestStub, {eventPayload: {event: 'test'}, type: ['diagnostic-event']});
      });
    });

    describe('#isServiceErrorExpected', () => {
      it('returns true for code mapped to "expected"', () => {
        assert.isTrue(cd.isServiceErrorExpected(2423012));
      });

      it('returns false for code mapped to "signaling"', () => {
        assert.isFalse(cd.isServiceErrorExpected(400001));
      });

      it('returns false for unmapped code', () => {
        assert.isFalse(cd.isServiceErrorExpected(999999));
      });
    });

    describe('#setDeviceInfo', () => {
      // The method is called in beforeEach itself. We are just testing it here
      it('sets the received deviceInfo to call-diagnostics', () => {
        const webexLoggerLogCalls = webex.logger.log.getCalls();
        const device = { userId: 'userId', url: 'deviceUrl', orgId: 'orgId' };

        assert.deepEqual(webexLoggerLogCalls[0].args, [
          'CallDiagnosticMetrics: @setDeviceInfo called',
          device
        ]);

        assert.deepEqual(cd.device, device);
      });
    });
  });
});
