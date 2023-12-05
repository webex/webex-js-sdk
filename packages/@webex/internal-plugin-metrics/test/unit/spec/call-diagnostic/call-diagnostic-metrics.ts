import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {WebexHttpError} from '@webex/webex-core';

import CallDiagnosticMetrics from '../../../../src/call-diagnostic/call-diagnostic-metrics';
import CallDiagnosticLatencies from '../../../../src/call-diagnostic/call-diagnostic-metrics-latencies';
import * as Utils from '../../../../src/call-diagnostic/call-diagnostic-metrics.util';
import {BrowserDetection} from '@webex/common';
import {getOSNameInternal} from '@webex/internal-plugin-metrics';
import uuid from 'uuid';
import {omit} from 'lodash';

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
          newMetrics: {
            postPreLoginMetric: sinon.stub(),
          },
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
              clientName: 'Cantina'
            },
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

      it('should build origin correctly with newEnvironment and createLaunchMethod', () => {
        sinon.stub(Utils, 'anonymizeIPAddress').returns('1.1.1.1');

        //@ts-ignore
        const res = cd.getOrigin(
          {subClientType: 'WEB_APP', clientType: 'TEAMS_CLIENT', newEnvironment: 'test-new-env', clientLaunchMethod: 'url-handler'},
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
        sinon.stub(Utils, 'anonymizeIPAddress').returns('1.1.1.1');

        //@ts-ignore
        const res = cd.getOrigin(
          {subClientType: 'WEB_APP', clientType: 'TEAMS_CLIENT', clientLaunchMethod: 'url-handler', environment: 'test-env'},
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
            clientLaunchMethod: 'url-handler'
          },
          environment: 'test-env',
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
            localNetworkPrefix: '1.3.4.0',
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

        const webexLoggerLogCalls = webex.logger.log.getCalls();
        assert.deepEqual(webexLoggerLogCalls[0].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
          `payload: undefined`,
          `options: ${JSON.stringify(options)}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @createClientEventObjectInMeeting. Creating in meeting event object.',
          `name: client.alert.displayed`
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitToCallDiagnostics. Preparing to send the request',
          `finalEvent: {"eventPayload":{"eventId":"my-fake-id","version":1,"origin":{"origin":"fake-origin"},"originTime":{"triggered":"${now.toISOString()}","sent":"not_defined_yet"},"senderCountryCode":"UK","event":{"name":"client.alert.displayed","canProceed":true,"identifiers":{"correlationId":"correlationId","userId":"userId","deviceId":"deviceUrl","orgId":"orgId","locusUrl":"locus/url","locusId":"url","locusStartTime":"lastActive","mediaAgentAlias":"alias","mediaAgentGroupId":"1"},"eventData":{"webClientDomain":"whatever"},"userType":"host","loginType":"login-ci"}},"type":["diagnostic-event"]}`,
        ]);

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

        const webexLoggerLogCalls = webex.logger.log.getCalls();

        assert.deepEqual(webexLoggerLogCalls[0].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
          `payload: undefined`,
          `options: ${JSON.stringify(options)}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @createClientEventObjectPreMeeting. Creating pre meeting event object.',
          `name: client.alert.displayed`
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitToCallDiagnostics. Preparing to send the request',
          `finalEvent: {"eventPayload":{"eventId":"my-fake-id","version":1,"origin":{"origin":"fake-origin"},"originTime":{"triggered":"${now.toISOString()}","sent":"not_defined_yet"},"senderCountryCode":"UK","event":{"name":"client.alert.displayed","canProceed":true,"identifiers":{"correlationId":"correlationId","userId":"userId","deviceId":"deviceUrl","orgId":"orgId","locusUrl":"locus-url"},"eventData":{"webClientDomain":"whatever"},"loginType":"login-ci"}},"type":["diagnostic-event"]}`,
        ]);


      });

      it('it should include errors if provided with meetingId', () => {
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

        const webexLoggerLogCalls = webex.logger.log.getCalls();
        assert.deepEqual(webexLoggerLogCalls[0].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
          `payload: undefined`,
          `options: ${JSON.stringify(options)}`,
        ]);


        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Error detected, attempting to map and attach it to the event...',
          `name: client.alert.displayed`,
          `rawError: ${options.rawError}`
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Generated errors:',
          `generatedError: {"fatal":true,"shownToUser":false,"name":"other","category":"expected","errorCode":4029,"serviceErrorCode":2409005,"errorDescription":"StartRecordingFailed"}`
        ])

        assert.deepEqual(webexLoggerLogCalls[3].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @createClientEventObjectInMeeting. Creating in meeting event object.',
          `name: client.alert.displayed`
        ]);

        assert.deepEqual(webexLoggerLogCalls[4].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitToCallDiagnostics. Preparing to send the request',
          `finalEvent: {"eventPayload":{"eventId":"my-fake-id","version":1,"origin":{"origin":"fake-origin"},"originTime":{"triggered":"${now.toISOString()}","sent":"not_defined_yet"},"senderCountryCode":"UK","event":{"name":"client.alert.displayed","canProceed":true,"identifiers":{"correlationId":"correlationId","userId":"userId","deviceId":"deviceUrl","orgId":"orgId","locusUrl":"locus/url","locusId":"url","locusStartTime":"lastActive","mediaAgentAlias":"alias","mediaAgentGroupId":"1"},"errors":[{"fatal":true,"shownToUser":false,"name":"other","category":"expected","errorCode":4029,"serviceErrorCode":2409005,"errorDescription":"StartRecordingFailed"}],"eventData":{"webClientDomain":"whatever"},"userType":"host","loginType":"login-ci"}},"type":["diagnostic-event"]}`,
        ]);
      });

      it('it send the raw error message if meetingId provided', () => {
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');

        const options = {
          meetingId: fakeMeeting.id,
          mediaConnections: [{mediaAgentAlias: 'alias', mediaAgentGroupId: '1'}],
          rawError: new Error('bad times')
        };

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          options,
        });

        console.log(submitToCallDiagnosticsSpy.getCalls()[0].args[0].event.errors)

        assert.calledWith(submitToCallDiagnosticsSpy, {
          event: {
            canProceed: true,
            eventData: {
              webClientDomain: 'whatever',
              rawErrorMessage: 'bad times',
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

        const webexLoggerLogCalls = webex.logger.log.getCalls();
        assert.deepEqual(webexLoggerLogCalls[0].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
          `payload: undefined`,
          `options: ${JSON.stringify(options)}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Error detected, attempting to map and attach it to the event...',
          `name: client.alert.displayed`,
          `rawError: ${JSON.stringify({
            message: options.rawError.message,
            name: options.rawError.name,
            stack: options.rawError.stack,
          })}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Generated errors:',
          `generatedError: {"fatal":true,"shownToUser":false,"name":"other","category":"other","errorCode":9999,"serviceErrorCode":9999,"errorDescription":"UnknownError"}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[3].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @createClientEventObjectInMeeting. Creating in meeting event object.',
          `name: client.alert.displayed`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[4].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitToCallDiagnostics. Preparing to send the request',
          `finalEvent: {"eventPayload":{"eventId":"my-fake-id","version":1,"origin":{"origin":"fake-origin"},"originTime":{"triggered":"${now.toISOString()}","sent":"not_defined_yet"},"senderCountryCode":"UK","event":{"name":"client.alert.displayed","canProceed":true,"identifiers":{"correlationId":"correlationId","userId":"userId","deviceId":"deviceUrl","orgId":"orgId","locusUrl":"locus/url","locusId":"url","locusStartTime":"lastActive","mediaAgentAlias":"alias","mediaAgentGroupId":"1"},"errors":[{"fatal":true,"shownToUser":false,"name":"other","category":"other","errorCode":9999,"serviceErrorCode":9999,"errorDescription":"UnknownError"}],"eventData":{"webClientDomain":"whatever","rawErrorMessage":"bad times"},"userType":"host","loginType":"login-ci"}},"type":["diagnostic-event"]}`,
        ]);
      });

      it('it should include errors if provided with correlationId', () => {
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
              rawErrorMessage: 'bad times',
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

        assert.deepEqual(webexLoggerLogCalls[0].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
          `payload: undefined`,
          `options: ${JSON.stringify(options)}`,
        ]);


        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Error detected, attempting to map and attach it to the event...',
          `name: client.alert.displayed`,
          `rawError: ${JSON.stringify({
            message: options.rawError.message,
            name: options.rawError.name,
            stack: options.rawError.stack,
          })}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Generated errors:',
          `generatedError: {"fatal":true,"shownToUser":false,"name":"other","category":"other","errorCode":9999,"serviceErrorCode":9999,"errorDescription":"UnknownError"}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[3].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @createClientEventObjectPreMeeting. Creating pre meeting event object.',
          `name: client.alert.displayed`
        ]);

        assert.deepEqual(webexLoggerLogCalls[4].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitToCallDiagnostics. Preparing to send the request',
          `finalEvent: {"eventPayload":{"eventId":"my-fake-id","version":1,"origin":{"origin":"fake-origin"},"originTime":{"triggered":"${now.toISOString()}","sent":"not_defined_yet"},"senderCountryCode":"UK","event":{"name":"client.alert.displayed","errors":[{"fatal":true,"shownToUser":false,"name":"other","category":"other","errorCode":9999,"serviceErrorCode":9999,"errorDescription":"UnknownError"}],"canProceed":true,"identifiers":{"correlationId":"correlationId","userId":"userId","deviceId":"deviceUrl","orgId":"orgId","locusUrl":"locus-url"},"eventData":{"webClientDomain":"whatever","rawErrorMessage":"bad times"},"loginType":"login-ci"}},"type":["diagnostic-event"]}`,
        ]);
      });

      it('it should send the raw error message if provided with correlationId', () => {
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

        assert.deepEqual(webexLoggerLogCalls[0].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
          `name: client.alert.displayed`,
          `payload: undefined`,
          `options: ${JSON.stringify(options)}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[1].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Error detected, attempting to map and attach it to the event...',
          `name: client.alert.displayed`,
          `rawError: ${options.rawError}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[2].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @prepareClientEvent. Generated errors:',
          `generatedError: {"fatal":true,"shownToUser":false,"name":"other","category":"expected","errorCode":4029,"serviceErrorCode":2409005,"errorDescription":"StartRecordingFailed"}`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[3].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @createClientEventObjectPreMeeting. Creating pre meeting event object.',
          `name: client.alert.displayed`,
        ]);

        assert.deepEqual(webexLoggerLogCalls[4].args, [
          'call-diagnostic-events -> ',
          'CallDiagnosticMetrics: @submitToCallDiagnostics. Preparing to send the request',
          `finalEvent: {"eventPayload":{"eventId":"my-fake-id","version":1,"origin":{"origin":"fake-origin"},"originTime":{"triggered":"${now.toISOString()}","sent":"not_defined_yet"},"senderCountryCode":"UK","event":{"name":"client.alert.displayed","errors":[{"fatal":true,"shownToUser":false,"name":"other","category":"expected","errorCode":4029,"serviceErrorCode":2409005,"errorDescription":"StartRecordingFailed"}],"canProceed":true,"identifiers":{"correlationId":"correlationId","userId":"userId","deviceId":"deviceUrl","orgId":"orgId","locusUrl":"locus-url"},"eventData":{"webClientDomain":"whatever"},"loginType":"login-ci"}},"type":["diagnostic-event"]}`,
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
      const defaultExpectedRes = {
        category: 'expected',
        errorDescription: 'StartRecordingFailed',
        fatal: true,
        name: 'other',
        shownToUser: false,
        errorCode: 4029,
        serviceErrorCode: 2409005,
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
        };

        if (isExpectedToBeCalled) {
          assert.deepEqual(res, expectedResult);
        } else {
          assert.notDeepEqual(res, expectedResult);
        }
      };

      it('should generate media event error payload if rawError has a media error name', () => {
        checkNameError({name: 'PermissionDeniedError'}, true);
      });

      it('should not generate media event error payload if rawError has a name that is not recognized', () => {
        checkNameError({name: 'SomeRandomError'}, false);
      });

      const checkCodeError = (payload: any, expetedRes: any) => {
        const res = cd.generateClientEventErrorPayload(payload);
        assert.deepEqual(res, expetedRes);
      };
      it('should generate event error payload correctly', () => {
        checkCodeError({body: {errorCode: 2409005}}, defaultExpectedRes);
      });

      it('should generate event error payload correctly if rawError has body.code', () => {
        checkCodeError({body: {code: 2409005}}, defaultExpectedRes);
      });

      it('should generate event error payload correctly if rawError has body.reason.reasonCode', () => {
        checkCodeError({body: {reason: {reasonCode: 2409005}}}, defaultExpectedRes);
      });

      it('should generate event error payload correctly if rawError has error.body.errorCode', () => {
        checkCodeError({error: {body: {errorCode: 2409005}}}, defaultExpectedRes);
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
        };

        if (isExpectedToBeCalled) {
          assert.deepEqual(res, expectedResult);
        } else {
          assert.notDeepEqual(res, expectedResult);
        }
      };

      it('should return default new locus event error payload correctly if locus error is recognized', () => {
        checkLocusError({body: {errorCode: 2400000}}, true);
      });

      it('should not return default new locus event error payload correctly if locus is not recognized', () => {
        checkLocusError({body: {errorCode: 1400000}}, false);
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
        };

        if (isExpectedToBeCalled) {
          assert.deepEqual(res, expectedResult);
        } else {
          assert.notDeepEqual(res, expectedResult);
        }
      };

      it('should return default meeting info lookup error payload if data.meetingInfo was found on error body', () => {
        checkMeetingInfoError({body: {data: {meetingInfo: 'something'}}}, true);
      });

      it('should return default meeting info lookup error payload if body.url contains wbxappapi', () => {
        checkMeetingInfoError({body: {url: '1234567-wbxappapiabcdefg'}}, true);
      });

      it('should not return default meeting info lookup error payload if body.url does not contain wbxappapi and data.meetingInfo was not found on error body', () => {
        checkMeetingInfoError({body: {data: '1234567-wbxappapiabcdefg'}}, false);
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
          category: 'signaling',
          errorDescription: '{}\nundefined https://example.com\nWEBEX_TRACKING_ID: undefined\n',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: undefined,
          errorCode: 1026,
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
          category: 'signaling',
          errorDescription: '{}\nundefined https://example.com\nWEBEX_TRACKING_ID: undefined\n',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: undefined,
          errorCode: 1010,
        });
      });

      it('should return unknown error otherwise', () => {
        const res = cd.generateClientEventErrorPayload({somethgin: 'new'});
        assert.deepEqual(res, {
          category: 'other',
          errorDescription: 'UnknownError',
          fatal: true,
          name: 'other',
          shownToUser: false,
          serviceErrorCode: 9999,
          errorCode: 9999,
        });
      });

      it('should generate event error payload correctly for locus error 2423012', () => {
        const res = cd.generateClientEventErrorPayload({body: {errorCode: 2423012}});
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'FraudDetection',
          fatal: true,
          name: 'locus.response',
          shownToUser: true,
          serviceErrorCode: 2423012,
          errorCode: 12000,
        });
      });
      it('should generate event error payload correctly for locus error 2409062', () => {
        const res = cd.generateClientEventErrorPayload({body: {errorCode: 2409062}});
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'E2EENotSupported',
          fatal: true,
          name: 'locus.response',
          shownToUser: true,
          serviceErrorCode: 2409062,
          errorCode: 12002,
        });
      });


      it('should generate event error payload correctly for locus error 2423021', () => {
        const res = cd.generateClientEventErrorPayload({body: {errorCode: 2423021}});
        assert.deepEqual(res, {
          category: 'expected',
          errorDescription: 'LocusLobbyFullCMR',
          fatal: true,
          name: 'locus.response',
          shownToUser: true,
          serviceErrorCode: 2423021,
          errorCode: 12001,
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
            preLoginId
          };

          const triggered = new Date();
          const fetchOptions = await cd.buildClientEventFetchRequestOptions({
            name: 'client.exit.app',
            payload: { trigger: 'user-interaction', canProceed: false },
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
          });

          const rest = omit(fetchOptions, 'body');

          if (preLoginId) {
            assert.deepEqual(rest, {
              foo: 'bar',
              method: 'POST',
              resource: 'clientmetrics-prelogin',
              service: 'metrics',
              headers: {
                authorization: false,
                'x-prelogin-userid': preLoginId,
              }
            })
          } else {
            assert.deepEqual(rest, {
              foo: 'bar',
              method: 'POST',
              resource: 'clientmetrics',
              service: 'metrics',
              headers: {}
            })
          }

          const webexLoggerLogCalls = webex.logger.log.getCalls();

          assert.deepEqual(webexLoggerLogCalls[0].args, [
            'call-diagnostic-events -> ',
            'CallDiagnosticMetrics: @buildClientEventFetchRequestOptions. Building request options object for fetch()...',
            `name: client.exit.app`,
            `payload: {"trigger":"user-interaction","canProceed":false}`,
            `options: ${JSON.stringify(options)}`,
          ]);

          assert.deepEqual(webexLoggerLogCalls[1].args, [
            'call-diagnostic-events -> ',
            'CallDiagnosticMetrics: @createClientEventObjectInMeeting. Creating in meeting event object.',
            `name: client.exit.app`
          ]);
        });
      });
    });

    describe('#submitToCallDiagnosticsPreLogin', async () => {
      it('should call webex.request with expected options', async () => {
        sinon.spy(Utils, 'prepareDiagnosticMetricItem');
        await cd.submitToCallDiagnosticsPreLogin(
          {
            //@ts-ignore
            event: {name: 'client.alert.displayed', canProceed: true},
            //@ts-ignore
            originTime: {triggered: 'now'},
          },
          'my-id'
        );

        assert.calledWith(Utils.prepareDiagnosticMetricItem, webex, {
          eventPayload: {
            event: {name: 'client.alert.displayed', canProceed: true},
            originTime: {triggered: 'now', sent: now.toISOString()},
            origin: {buildType: 'test', networkType: 'unknown'},
          },
          type: ['diagnostic-event'],
        });

        assert.calledWith(
          webex.internal.newMetrics.postPreLoginMetric,
          {
            eventPayload: {
              event: {
                name: 'client.alert.displayed',
                canProceed: true,
              },
              originTime: {
                sent: now.toISOString(),
                triggered: 'now',
              },
              origin: {
                buildType: 'test',
                networkType: 'unknown',
              },
            },
            type: ['diagnostic-event'],
          },
          'my-id'
        );
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
  });
});
