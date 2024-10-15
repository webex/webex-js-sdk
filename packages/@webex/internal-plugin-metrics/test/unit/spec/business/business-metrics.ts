import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {BrowserDetection} from '@webex/common';
import {BusinessMetrics, config, getOSNameInternal} from '@webex/internal-plugin-metrics';
import uuid from 'uuid';

//@ts-ignore
global.window = {location: {hostname: 'whatever'}, navigator: {language: 'language'}};
process.env.NODE_ENV = 'test';

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

describe('internal-plugin-metrics', () => {
  describe('BusinessMetrics', () => {
    let webex;
    let now;
    let businessMetrics: BusinessMetrics;

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
      businessMetrics = new BusinessMetrics({}, {parent: webex});
      sinon.stub(uuid, 'v4').returns('my-fake-id');
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('#sendEvent', () => {
      it('should send correctly shaped business event (check name building and internal tagged event building) and default correctly', () => {
        // For some reasons `jest` isn't available when testing form build server - so can't use `jest.fn()` here...
        const requestCalls = [];
        const request = function(arg) { requestCalls.push(arg) }

        businessMetrics.clientMetricsBatcher.request = request;
        
        assert.equal(requestCalls.length, 0)
        businessMetrics.submitBusinessEvent({ name: "foobar", payload: {bar:"gee"} })
        assert.equal(requestCalls.length, 1)
        assert.deepEqual(requestCalls[0], {
          eventPayload: {
            appType: 'Web Client',
            context: {
              app: {version: 'webex-version'},
              device: {id: 'deviceId'},
              locale: 'language',
              os: {
                name: getOSNameInternal(),
                version: getOSVersion(),
              },
            },
            key: 'foobar',
            browserDetails: {
              browser: getBrowserName(),
              browserHeight: window.innerHeight,
              browserVersion: getBrowserVersion(),
              browserWidth: window.innerWidth,
              domain: window.location.hostname,
              inIframe: false,
              locale: window.navigator.language,
              os: getOSNameInternal(),
            },
            client_timestamp: requestCalls[0].eventPayload.client_timestamp, // This is to bypass time check, which is checked below.
            value: {
              bar: "gee"
            }
          },
          type: ['business'],
        });
        assert.isNumber(requestCalls[0].eventPayload.client_timestamp)
      })

      describe('when table is provided', () => {
        it('should send correctly shaped business event with table: wbx_app_callend_metrics and ignore the key name', () => {
          // For some reasons `jest` isn't available when testing form build server - so can't use `jest.fn()` here...
          const requestCalls = [];
          const request = function(arg) { requestCalls.push(arg) }

          businessMetrics.clientMetricsBatcher.request = request;
          
          assert.equal(requestCalls.length, 0)
          businessMetrics.submitBusinessEvent({ name: "foobar", payload: {bar:"gee"}, table: 'wbxapp_callend_metrics' })
          assert.equal(requestCalls.length, 1)
          assert.deepEqual(requestCalls[0], {
            eventPayload: {
              key: 'callEnd',
              client_timestamp: requestCalls[0].eventPayload.client_timestamp, // This is to bypass time check, which is checked below.
              appType: 'Web Client',
              value: {
                bar: 'gee'
              }
            },
            type: ['business'],
          });
          assert.isNumber(requestCalls[0].eventPayload.client_timestamp)
        });

        it('should send correctly shaped business event with table: business_metrics', () => {
          // For some reasons `jest` isn't available when testing form build server - so can't use `jest.fn()` here...
          const requestCalls = [];
          const request = function(arg) { requestCalls.push(arg) }

          businessMetrics.clientMetricsBatcher.request = request;
          
          assert.equal(requestCalls.length, 0)
          businessMetrics.submitBusinessEvent({ name: "foobar", payload: {bar:"gee"}, table: 'business_metrics' })
          assert.equal(requestCalls.length, 1)
          assert.deepEqual(requestCalls[0], {
            eventPayload: {
              key: 'foobar',
              appType: 'Web Client',
              client_timestamp: requestCalls[0].eventPayload.client_timestamp, // This is to bypass time check, which is checked below.
              value: {
                bar: "gee",
                browser: getBrowserName(),
                browserHeight: window.innerHeight,
                browserVersion: getBrowserVersion(),
                browserWidth: window.innerWidth,
                domain: window.location.hostname,
                inIframe: false,
                locale: window.navigator.language,
                os: getOSNameInternal(),
                app: {version: 'webex-version'},
                device: {id: 'deviceId'},
                locale: 'language',
              }
            },
            type: ['business'],
          });
          assert.isNumber(requestCalls[0].eventPayload.client_timestamp)
        });
      });
    })
  });
});
