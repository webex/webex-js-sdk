import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {BrowserDetection} from '@webex/common';
import {OperationalMetrics, config, getOSNameInternal} from '@webex/internal-plugin-metrics';
import uuid from 'uuid';

//@ts-ignore
global.window = {location: {hostname: 'whatever'}, navigator: {language: 'language'}};
process.env.NODE_ENV = 'test';

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

describe('internal-plugin-metrics', () => {
  describe('OperationalMetrics', () => {
    let webex;
    let now;
    let operationalMetrics: OperationalMetrics;

    const tags = {key: 'val'};

    beforeEach(() => {
      now = new Date();

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
            url: 'https://wdm-intb.ciscospark.com/wdm/api/v1/devices/deviceId',
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

      sinon.createSandbox();
      sinon.useFakeTimers(now.getTime());
      operationalMetrics = new OperationalMetrics({}, {parent: webex});
      sinon.stub(uuid, 'v4').returns('my-fake-id');
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('#sendEvent', () => {
      it('should send correctly shaped operational event (check name building and internal tagged event building)', () => {
        // For some reasons `jest` isn't available when testing form build server - so can't use `jest.fn()` here...
        const requestCalls = [];
        const request = function(arg) { requestCalls.push(arg) }

        operationalMetrics.clientMetricsBatcher.request = request;
        
        assert.equal(requestCalls.length, 0)
        operationalMetrics.submitOperationalEvent({ name: "foobar", payload: {bar:"gee"} })
        assert.equal(requestCalls.length, 1)
        assert.deepEqual(requestCalls[0], {
          context: {
            app: {version: 'webex-version'},
            device: {id: 'deviceId'},
            locale: 'language',
            os: {
              name: getOSNameInternal(),
              version: getOSVersion(),
            },
          },
          metricName: 'foobar',
          tags: {
            browser: getBrowserName(),
            browserHeight: window.innerHeight,
            browserVersion: getBrowserVersion(),
            browserWidth: window.innerWidth,
            domain: window.location.hostname,
            inIframe: false,
            locale: window.navigator.language,
            os: getOSNameInternal(),
            bar: "gee"
          },
          timestamp: requestCalls[0].timestamp, // This is to bypass time check, which is correctly tested in behavioral-metrics tests.
          type: ['operational'],
        });
      })
    })

    describe('#isReadyToSubmitEvents', () => {
      it('should return true when we have a deviceId, false when deviceId is empty or undefined', async () => {
        assert.equal(true, operationalMetrics.isReadyToSubmitEvents());

        webex.internal.device.url = "";
        assert.equal(false, operationalMetrics.isReadyToSubmitEvents());

        delete webex.internal.device.url;
        assert.equal(false, operationalMetrics.isReadyToSubmitEvents());
      });
    });
  });
});
