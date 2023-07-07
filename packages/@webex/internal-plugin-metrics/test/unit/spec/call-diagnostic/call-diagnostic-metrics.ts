import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

import CallDiagnosticMetrics from '../../../../src/call-diagnostic/call-diagnostic-metrics';
import * as Utils from '../../../../src/call-diagnostic/call-diagnostic-metrics.util';
import {BrowserDetection} from '@webex/common';
import {getOSNameInternal} from '@webex/internal-plugin-metrics';
import uuid from 'uuid';

//@ts-ignore
global.window = {location: {hostname: 'whatever'}};

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

describe('internal-plugin-metrics', () => {
  describe('CallDiagnosticMetrics', () => {
    var now = new Date();

    let cd: CallDiagnosticMetrics;

    const fakeMeeting = {
      id: '1',
      correlationId: 'correlationId',
      userId: 'userId',
      deviceUrl: 'deviceUrl',
      orgId: 'orgId',
      environment: 'meeting_evn',
      locusUrl: 'locus/url',
      locusInfo: {
        fullState: {
          lastActive: 'lastActive',
        },
      },
      getCurUserType: () => 'host',
      getCurLoginType: () => 'login-ci',
      config: {
        metrics: {
          clientType: 'TEAMS_CLIENT',
          subClientType: 'WEB_APP',
        },
      },
    };

    const webex = {
      version: 'webex-version',
      internal: {
        services: {
          get: () => 'locus-url',
        },
      },
      meetings: {
        metrics: {
          clientName: 'Cantina',
        },
        meetingCollection: {
          get: () => fakeMeeting
        },
        geoHintInfo: {
          clientAddress: '1.3.4.5',
          countryCode: 'UK',
        },
      },
    };

    beforeEach(() => {
      sinon.createSandbox();
      sinon.useFakeTimers(now.getTime());
      cd = new CallDiagnosticMetrics({}, {parent: webex});
      sinon.stub(uuid, 'v4').returns('my-fake-id');
    });

    afterEach(() => {
      sinon.restore();
    });

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
        userAgent: 'webex-js-sdk/test-webex-version client=Cantina; (os=linux/5)',
      });
    });

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
      it('should submit client event successfully', () => {
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
            errors: [{
              category: 'expected',
              errorDescription: 'StartRecordingFailed',
              fatal: true,
              name: 'other',
              shownToUser: false,
            }],
            loginType: 'login-ci',
            name: 'client.alert.displayed',
            userType: 'host',
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

      it('should include erros in payload if provided via payload', () => {
        sinon.stub(cd, 'getOrigin').returns({origin: 'fake-origin'});
        const submitToCallDiagnosticsSpy = sinon.spy(cd, 'submitToCallDiagnostics');

        const options = {
          meetingId: fakeMeeting.id,
          mediaConnections: [{mediaAgentAlias: 'alias', mediaAgentGroupId: '1'}],
        };

        cd.submitClientEvent({
          name: 'client.alert.displayed',
          payload: {
            errors: [{
              name: 'locus.response',
              fatal: true,
              category: 'signaling',
              shownToUser: false,
            }]
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
            errors: [{
              name: 'locus.response',
              fatal: true,
              category: 'signaling',
              shownToUser: false,
            }],
            loginType: 'login-ci',
            name: 'client.alert.displayed',
            userType: 'host',
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

      })

      it('should throw if meetingId not provided', () => {
        assert.throws(() =>
          cd.submitClientEvent({
            name: 'client.alert.displayed',
            options: {},
          })
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
        const generateErrorPayloadSpy = sinon.spy(cd, 'generateErrorPayload');
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
        assert.notCalled(generateErrorPayloadSpy);
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
    });
    describe('#getErrorPayloadForClientErrorCode', () => {
      it('it should grab the payload for client error code correctly', () => {
        const res = cd.getErrorPayloadForClientErrorCode(4008);
        assert.deepEqual(res, {
          category: 'signaling',
          errorDescription: 'NewLocusError',
          fatal: true,
          name: 'other',
          shownToUser: false,
        });
      });

      it('it should return undefined if trying to get payload for client error code that doesnt exist', () => {
        const res = cd.getErrorPayloadForClientErrorCode(123456);
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
        });
      });

      it('should return undefined if no error code provided', () => {
        const res = cd.generateClientEventErrorPayload({body: {errorCode: undefined}});
        assert.deepEqual(res, undefined);
      });
    });
  });
});
