import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {
  clearEmptyKeysRecursively,
  getBuildType,
  isLocusServiceErrorCode,
  prepareDiagnosticMetricItem,
  setMetricTimings,
} from '../../../../src/call-diagnostic/call-diagnostic-metrics.util';
import CallDiagnosticLatencies from '../../../../src/call-diagnostic/call-diagnostic-metrics-latencies';

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
      console.log(obj);
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

  describe('getBuildType', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    [
      ['https://localhost', 'test'],
      ['https://127.0.0.1', 'test'],
      ['https://web.webex.com', 'production'],
    ].forEach(([webClientDomain, expected]) => {
      it(`returns expected result for ${webClientDomain}`, () => {
        assert.deepEqual(getBuildType(webClientDomain), expected);
      });
    });

    it('returns "test" for NODE_ENV "foo"', () => {
      process.env.NODE_ENV = 'foo';
      assert.deepEqual(getBuildType('production'), 'test');
    });
  });

  describe('prepareDiagnosticMetricItem', async () => {
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
            buildType: 'production',
            networkType: 'unknown',
          },
          event: {name: eventName, ...expectedEvent},
        },
        type: ['diagnostic-event'],
      });
    };

    before(async () => {
      webex = {internal: {newMetrics: {}}};
      webex.internal.newMetrics.callDiagnosticLatencies = new CallDiagnosticLatencies(
        {},
        {parent: webex}
      );
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
        'client.interstitial-window.launched',
        {
          joinTimes: {
            clickToInterstitial: undefined,
            meetingInfoReqResp: undefined,
          },
        },
      ],
      [
        'client.call.initiated',
        {
          joinTimes: {
            showInterstitialTime: undefined,
            meetingInfoReqResp: undefined,
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
            joinReqSentReceived: undefined,
            pageJmt: undefined,
            clickToInterstitial: undefined,
            interstitialToJoinOK: undefined,
            totalJmt: undefined,
            clientJmt: undefined,
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
        'client.mediaquality.event',
        {
          audioSetupDelay: {
            joinRespRxStart: undefined,
            joinRespTxStart: undefined,
          },
          videoSetupDelay: {
            joinRespRxStart: undefined,
            joinRespTxStart: undefined,
          },
        },
      ],
    ].forEach(([eventName, expectedEvent]) => {
      it(`returns expected result for ${eventName}`, () => {
        check(eventName as string, expectedEvent);
      });
    });
  });

  describe('setMetricTimings', async () => {
    let webex: any;

    const check = (options: any, expectedOptions: any) => {
      const newOptions = setMetricTimings(options);

      assert.deepEqual(newOptions, expectedOptions);
    };

    it(`returns expected options`, () => {
      const now = new Date();
      sinon.useFakeTimers(now.getTime());

      const options = {
        body: {
          metrics: [
            {
              eventPayload: {
                originTime: {
                  triggered: 555,
                  send: 666,
                },
              },
            },
          ],
        },
      };

      const expectedOptions = {
        body: {
          metrics: [
            {
              eventPayload: {
                originTime: {
                  triggered: now.toISOString(),
                  send: now.toISOString(),
                },
              },
            },
          ],
        },
      };

      check(options, expectedOptions);
      sinon.restore();
    });

    it(`returns expected options for multiple metrics`, () => {
      const now = new Date();
      sinon.useFakeTimers(now.getTime());

      const options = {
        body: {
          metrics: [
            {
              eventPayload: {
                originTime: {
                  triggered: 555,
                  send: 666,
                },
              },
            },
            {
              eventPayload: {
                originTime: {
                  triggered: 777,
                  send: 888,
                },
              },
            },
          ],
        },
      };

      const expectedOptions = {
        body: {
          metrics: [
            {
              eventPayload: {
                originTime: {
                  triggered: now.toISOString(),
                  send: now.toISOString(),
                },
              },
            },
            {
              eventPayload: {
                originTime: {
                  triggered: now.toISOString(),
                  send: now.toISOString(),
                },
              },
            },
          ],
        },
      };

      check(options, expectedOptions);
      sinon.restore();
    });

    it(`does not throw when data missing`, () => {
      const options = {};

      const expectedOptions = {};

      check(options, expectedOptions);
    });
  });
});
