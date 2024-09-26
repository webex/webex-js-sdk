import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {WebexHttpError} from '@webex/webex-core';

import * as CallDiagnosticUtils from '../../../../src/call-diagnostic/call-diagnostic-metrics.util';
import CallDiagnosticLatencies from '../../../../src/call-diagnostic/call-diagnostic-metrics-latencies';
import {
  DTLS_HANDSHAKE_FAILED_CLIENT_CODE,
  ICE_FAILED_WITHOUT_TURN_TLS_CLIENT_CODE,
  ICE_AND_REACHABILITY_FAILED_CLIENT_CODE,
  ICE_FAILED_WITH_TURN_TLS_CLIENT_CODE,
  MISSING_ROAP_ANSWER_CLIENT_CODE,
} from '../../../../src/call-diagnostic/config';
import Logger from '@webex/plugin-logger';

const {
  clearEmptyKeysRecursively,
  extractVersionMetadata,
  getBuildType,
  isBrowserMediaErrorName,
  isLocusServiceErrorCode,
  isMeetingInfoServiceError,
  prepareDiagnosticMetricItem,
  setMetricTimings,
  isNetworkError,
  isUnauthorizedError,
  generateClientErrorCodeForIceFailure,
  isSdpOfferCreationError,
} = CallDiagnosticUtils;

describe('internal-plugin-metrics', () => {
  describe('clearEmptyKeysRecursively', () => {
    it('should clear empty objects and empty nested objects recursively', () => {
      const obj: any = {
        foo: '',
        bar: {},
        baz: [],
        nested: {
          prop: {},
          arr: ['test'],
        },
      };
      clearEmptyKeysRecursively(obj);
      assert.deepEqual(obj, {nested: {arr: ['test']}});
    });

    it('should not modify non-empty objects and arrays', () => {
      const obj = {
        foo: 'bar',
        arr: [1, 2, 3],
      };
      clearEmptyKeysRecursively(obj);
      assert.deepEqual(obj, {foo: 'bar', arr: [1, 2, 3]});
    });

    it('should not modify non-object and non-array values', () => {
      const obj = {
        prop1: 'value1',
        prop2: 123,
      };
      clearEmptyKeysRecursively(obj);
      assert.deepEqual(obj, {prop1: 'value1', prop2: 123});
    });

    it('should handle nested empty objects and arrays', () => {
      const obj: any = {
        foo: {
          bar: {},
          baz: [],
        },
      };
      clearEmptyKeysRecursively(obj);
      assert.deepEqual(obj, {foo: {}});
    });

    it('should handle an empty input object', () => {
      const obj = {};
      clearEmptyKeysRecursively(obj);
      assert.deepEqual(obj, {});
    });
  });

  describe('isLocusServiceErrorCode', () => {
    [
      [10000, false],
      [2400000, true],
      ['2400000', true],
      [2400001, true],
      ['2400001', true],
      [240000, false],
      [14000000, false],
    ].forEach(([error, expected]) => {
      it(`for code ${error} returns the correct result`, () => {
        //@ts-ignore
        assert.deepEqual(isLocusServiceErrorCode(error), expected);
      });
    });
  });

  describe('isMeetingInfoServiceError', () => {
    [
      [{body: {data: {meetingInfo: 'something'}}}, true],
      [{body: {url: 'abcde-123-wbxappapi-efgh'}}, true],
      [{body: {data: {meetingInformation: 'something'}}}, false],
      [{body: {uri: 'abcde-123-wbxappap-efgh'}}, false],
      ['2400001', false],
      [2400001, false],
      [{}, false],
    ].forEach(([rawError, expected]) => {
      it(`for rawError ${rawError} returns the correct result`, () => {
        //@ts-ignore
        assert.deepEqual(isMeetingInfoServiceError(rawError), expected);
      });
    });
  });

  describe('isNetworkError', () => {
    [
      [{body: {data: {meetingInfo: 'something'}}}, false],
      [
        new WebexHttpError.NetworkOrCORSError({
          url: 'https://example.com',
          statusCode: 0,
          body: {},
          options: {headers: {}, url: 'https://example.com'},
        }),
        true,
      ],
      [
        new WebexHttpError.Unauthorized({
          url: 'https://example.com',
          statusCode: 0,
          body: {},
          options: {headers: {}, url: 'https://example.com'},
        }),
        false,
      ],
    ].forEach(([rawError, expected]) => {
      it(`for rawError ${rawError} returns the correct result`, () => {
        //@ts-ignore
        assert.deepEqual(isNetworkError(rawError), expected);
      });
    });
  });

  describe('isUnauthorizedError', () => {
    [
      [
        'unauthorized',
        new WebexHttpError.Unauthorized({
          url: 'https://example.com',
          statusCode: 0,
          body: {},
          options: {headers: {}, url: 'https://example.com'},
        }),
        true,
      ],
      [
        'network or cors',
        new WebexHttpError.NetworkOrCORSError({
          url: 'https://example.com',
          statusCode: 0,
          body: {},
          options: {headers: {}, url: 'https://example.com'},
        }),
        false,
      ],
      ['other', {body: {data: {meetingInfo: 'something'}}}, false],
    ].forEach(([errorType, rawError, expected]) => {
      it(`for ${errorType} rawError returns the correct result`, () => {
        assert.strictEqual(isUnauthorizedError(rawError), expected);
      });
    });
  });

  describe('isSdpOfferCreationError', () => {
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

    const error: TestSdpOfferCreationError = {
      code: 30005,
      name: 'SdpOfferCreationError',
      message: 'No codecs present in m-line with MID 0 after filtering.',
      cause: {
        type: 'SDP_MUNGE_MISSING_CODECS',
        message: 'No codecs present in m-line with MID 0 after filtering.',
      },
    };
    [
      ['isSdpOfferCreationError', error, true],
      ['generic error', new Error('this is an error'), false],
    ].forEach(([errorType, rawError, expected]) => {
      it(`for ${errorType} rawError returns the correct result`, () => {
        assert.strictEqual(isSdpOfferCreationError(rawError), expected);
      });
    });
  });

  describe('isBrowserMediaErrorName', () => {
    [
      ['PermissionDeniedError', true],
      ['PermissionDeniedErrors', false],
      ['NotAllowedError', true],
      ['NotAllowedErrors', false],
      ['NotReadableError', true],
      ['NotReadableErrors', false],
      ['AbortError', true],
      ['AbortErrors', false],
      ['NotFoundError', true],
      ['NotFoundErrors', false],
      ['OverconstrainedError', true],
      ['OverconstrainedErrors', false],
      ['SecurityError', true],
      ['SecurityErrors', false],
      ['TypeError', true],
      ['TypeErrors', false],
      ['', false],
      ['SomethingElse', false],
      [{name: 'SomethingElse'}, false],
    ].forEach(([errorName, expected]) => {
      it(`for rawError ${errorName} returns the correct result`, () => {
        //@ts-ignore
        assert.deepEqual(isBrowserMediaErrorName(errorName), expected);
      });
    });
  });

  describe('getBuildType', () => {
    const webex = {internal: {}};

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    [
      ['https://localhost', undefined, 'test'],
      ['https://127.0.0.1', undefined, 'test'],
      ['https://web.webex.com', undefined, 'prod'],
      ['https://web.webex.com', true, 'test'],
    ].forEach(([webClientDomain, markAsTestEvent, expected]) => {
      it(`returns expected result for ${webClientDomain}`, () => {
        assert.deepEqual(getBuildType(webex, webClientDomain, markAsTestEvent as any), expected);
      });
    });

    it('returns "test" for NODE_ENV "foo"', () => {
      process.env.NODE_ENV = 'foo';
      assert.deepEqual(getBuildType(webex, 'production'), 'test');
    });

    it('returns "test" for NODE_ENV "production" and markAsTestEvent = true', () => {
      process.env.NODE_ENV = 'production';
      assert.deepEqual(getBuildType(webex, 'my.domain', true), 'test');
    });

    it('returns "test" for NODE_ENV "production" when webex.caBuildType = "test"', () => {
      process.env.NODE_ENV = 'production';
      assert.deepEqual(getBuildType({internal: {ceBuildType: 'test'}}, 'my.domain', true), 'test');
    });
  });

  describe('prepareDiagnosticMetricItem', () => {
    let webex: any;

    const check = (eventName: string, expectedEvent: any) => {
      const eventPayload = {event: {name: eventName}};
      const item = prepareDiagnosticMetricItem(webex, {
        eventPayload,
        type: ['diagnostic-event'],
      });

      assert.deepEqual(item, {
        eventPayload: {
          origin: {
            buildType: 'prod',
            networkType: 'unknown',
          },
          event: {name: eventName, ...expectedEvent},
        },
        type: ['diagnostic-event'],
      });
    };

    beforeEach(async () => {
      webex = {internal: {newMetrics: {}}};
      webex.internal.newMetrics.callDiagnosticLatencies = new CallDiagnosticLatencies(
        {},
        {parent: webex}
      );
      webex.logger = new Logger({}, {parent: webex});
    });

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    [
      ['client.exit.app', {}],
      [
        'client.login.end',
        {
          joinTimes: {
            otherAppApiReqResp: undefined,
            exchangeCITokenJMT: undefined,
          },
        },
      ],
      [
        'client.webexapp.launched',
        {
          joinTimes: {
            downloadTime: undefined,
          },
        },
      ],
      [
        'client.interstitial-window.launched',
        {
          joinTimes: {
            clickToInterstitial: undefined,
            meetingInfoReqResp: undefined,
            refreshCaptchaServiceReqResp: undefined,
            downloadIntelligenceModelsReqResp: undefined,
          },
        },
      ],
      [
        'client.call.initiated',
        {
          joinTimes: {
            showInterstitialTime: undefined,
            meetingInfoReqResp: undefined,
            registerWDMDeviceJMT: undefined,
            getU2CTime: undefined,
            getReachabilityClustersReqResp: undefined,
          },
        },
      ],
      [
        'client.locus.join.response',
        {
          joinTimes: {
            meetingInfoReqResp: undefined,
            callInitJoinReq: undefined,
            joinReqResp: undefined,
            pageJmt: undefined,
            clickToInterstitial: undefined,
            interstitialToJoinOK: undefined,
            totalJmt: undefined,
            clientJmt: undefined,
            downloadTime: undefined,
          },
        },
      ],
      [
        'client.ice.end',
        {
          joinTimes: {
            ICESetupTime: undefined,
            audioICESetupTime: undefined,
            videoICESetupTime: undefined,
            shareICESetupTime: undefined,
          },
        },
      ],
      [
        'client.media.rx.start',
        {
          joinTimes: {
            localSDPGenRemoteSDPRecv: undefined,
          },
          audioSetupDelay: {
            joinRespRxStart: undefined,
          },
          videoSetupDelay: {
            joinRespRxStart: undefined,
          },
        },
      ],
      [
        'client.media-engine.ready',
        {
          joinTimes: {
            totalMediaJMT: undefined,
            interstitialToMediaOKJMT: undefined,
            callInitMediaEngineReady: undefined,
            stayLobbyTime: undefined,
          },
        },
      ],
      [
        'client.media.tx.start',
        {
          audioSetupDelay: {
            joinRespTxStart: undefined,
          },
          videoSetupDelay: {
            joinRespTxStart: undefined,
          },
        },
      ],
    ].forEach(([eventName, expectedEvent]) => {
      it(`returns expected result for ${eventName}`, () => {
        check(eventName as string, expectedEvent);
      });
    });

    it('getBuildType returns correct value', () => {
      const item: any = {
        eventPayload: {
          event: {
            name: 'client.exit.app',
            eventData: {
              markAsTestEvent: true,
              webClientDomain: 'https://web.webex.com',
            },
          },
        },
        type: ['diagnostic-event'],
      };

      // just submit any event
      prepareDiagnosticMetricItem(webex, item);
      assert.deepEqual(item.eventPayload.origin.buildType, 'test');

      delete item.eventPayload.origin.buildType;
      item.eventPayload.event.eventData.markAsTestEvent = false;
      prepareDiagnosticMetricItem(webex, item);
      assert.deepEqual(item.eventPayload.origin.buildType, 'prod');
    });
  });

  describe('setMetricTimings', () => {
    let webex: any;

    const check = (options: any, expectedOptions: any) => {
      const newOptions = setMetricTimings(options);

      assert.deepEqual(newOptions, expectedOptions);
    };

    it(`returns expected options`, () => {
      const now = new Date();
      sinon.useFakeTimers(now.getTime());

      const options = {
        json: true,
        body: JSON.stringify({
          metrics: [
            {
              eventPayload: {
                originTime: {
                  triggered: 555,
                  sent: 666,
                },
              },
            },
          ],
        }),
      };

      const expectedOptions = {
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

      check(options, expectedOptions);
      sinon.restore();
    });

    it(`returns expected options for multiple metrics`, () => {
      const now = new Date();
      sinon.useFakeTimers(now.getTime());

      const options = {
        json: true,
        body: JSON.stringify({
          metrics: [
            {
              eventPayload: {
                originTime: {
                  triggered: 555,
                  sent: 666,
                },
              },
            },
            {
              eventPayload: {
                originTime: {
                  triggered: 777,
                  sent: 888,
                },
              },
            },
          ],
        }),
      };

      const expectedOptions = {
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

      check(options, expectedOptions);
      sinon.restore();
    });

    it(`returns expected options when json is falsey`, () => {
      const now = new Date();
      sinon.useFakeTimers(now.getTime());

      const options = {
        body: JSON.stringify({
          metrics: [
            {
              eventPayload: {
                originTime: {
                  triggered: 555,
                  sent: 666,
                },
              },
            },
          ],
        }),
      };

      const expectedOptions = {
        body: JSON.stringify({
          metrics: [
            {
              eventPayload: {
                originTime: {
                  triggered: 555,
                  sent: 666,
                },
              },
            },
          ],
        }),
      };

      check(options, expectedOptions);
      sinon.restore();
    });

    it(`does not throw when there is no body`, () => {
      const options = {};

      const expectedOptions = {};

      check(options, expectedOptions);
    });

    it(`does not throw when body is empty`, () => {
      const options = {body: '"{}"'};

      const expectedOptions = {body: '"{}"'};

      check(options, expectedOptions);
    });
  });

  describe('extractVersionMetadata', () => {
    [
      ['1.2.3', {majorVersion: 1, minorVersion: 2}],
      ['0.0.1', {majorVersion: 0, minorVersion: 0}],
      ['0.0.0', {majorVersion: 0, minorVersion: 0}],
      ['1.2', {majorVersion: 1, minorVersion: 2}],
      ['1', {majorVersion: 1, minorVersion: NaN}],
      ['foo', {majorVersion: NaN, minorVersion: NaN}],
      ['1.foo', {majorVersion: 1, minorVersion: NaN}],
      ['foo.1', {majorVersion: NaN, minorVersion: 1}],
      ['foo.bar', {majorVersion: NaN, minorVersion: NaN}],
    ].forEach(([version, expected]) => {
      it(`returns expected result for ${version}`, () => {
        assert.deepEqual(extractVersionMetadata(version as string), expected);
      });
    });
  });

  describe('generateClientErrorCodeForIceFailure', () => {
    [
      {
        signalingState: 'have-local-offer',
        iceConnected: false,
        turnServerUsed: true,
        errorCode: MISSING_ROAP_ANSWER_CLIENT_CODE,
        unreachable: false,
      },
      {
        signalingState: 'stable',
        iceConnected: true,
        turnServerUsed: true,
        errorCode: DTLS_HANDSHAKE_FAILED_CLIENT_CODE,
        unreachable: false,
      },
      {
        signalingState: 'stable',
        iceConnected: false,
        turnServerUsed: true,
        errorCode: ICE_FAILED_WITH_TURN_TLS_CLIENT_CODE,
        unreachable: false,
      },
      {
        signalingState: 'stable',
        iceConnected: false,
        turnServerUsed: true,
        errorCode: ICE_AND_REACHABILITY_FAILED_CLIENT_CODE,
        unreachable: true,
      },
      {
        signalingState: 'stable',
        iceConnected: false,
        turnServerUsed: false,
        errorCode: ICE_FAILED_WITHOUT_TURN_TLS_CLIENT_CODE,
        unreachable: false,
      },
    ].forEach(({signalingState, iceConnected, turnServerUsed, errorCode, unreachable}: any) => {
      it('returns expected result', () => {
        assert.deepEqual(
          generateClientErrorCodeForIceFailure({
            signalingState,
            iceConnected,
            turnServerUsed,
            unreachable,
          }),
          errorCode
        );
      });
    });
  });
});
