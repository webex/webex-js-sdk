/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {Token, Credentials} from '@webex/webex-core';
import FakeTimers from '@sinonjs/fake-timers';
import sinon from 'sinon';
import Metrics, {config} from '@webex/internal-plugin-metrics';
import {BrowserDetection} from '@webex/common';

const {getOSVersion} = BrowserDetection();

//@ts-ignore
global.window = {location: {hostname: 'whatever'}};
function promiseTick(count) {
  let promise = Promise.resolve();

  while (count > 1) {
    promise = promise.then(() => promiseTick(1));
    count -= 1;
  }

  return promise;
}

describe('plugin-metrics', () => {
  describe('Metrics', () => {
    let webex;
    let metrics;
    let clock;

    const eventName = 'test_event';
    const mockPayload = {
      fields: {
        testField: 123,
      },
      tags: {
        testTag: 'tag value',
      },
      metricName: eventName,
      test: 'this field should not be included in final payload',
      type: 'behavioral',
      eventPayload: {value: 'splunk business metric payload'},
    };
    const transformedProps = {
      fields: {
        testField: 123,
      },
      tags: {
        testTag: 'tag value',
      },
      metricName: eventName,
      type: 'behavioral',
      timestamp: Date.now(),
    };
    const preLoginId = '1b90cf5e-27a6-41aa-a208-1f6eb6b9e6b6';
    const preLoginProps = {
      metrics: [transformedProps],
    };
    const mockCallDiagnosticEvent = {
      originTime: {
        triggered: 'mock triggered timestamp',
      },
    };

    beforeEach(() => {
      clock = FakeTimers.install({now: 0});
    });

    afterEach(() => {
      clock.uninstall();
    });

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          metrics: Metrics,
        },
      });

      webex.config.metrics = config.metrics;
      metrics = webex.internal.metrics;

      webex.request = function (options) {
        return Promise.resolve({
          statusCode: 204,
          body: undefined,
          waitForServiceTimeout: 30,
          options,
        });
      };

      webex.credentials = new Credentials(undefined, {parent: webex});
      sinon.stub(webex.credentials, 'getClientToken').returns(Promise.resolve('token'));

      webex.internal = {...webex.internal};
      webex.config = {
        ...webex.config,
        appName: 'appName',
        appPlatform: 'appPlatform',
        appVersion: 'appVersion',
      };
      webex.config.metrics.type = ['operational'];
      webex.config.metrics.appType = 'sdk';
      webex.meetings = {
        config: {
          metrics: {
            clientVersion: '43.0.105'
          }
        }
      }

      sinon.spy(webex, 'request');
      sinon.spy(metrics, 'aliasUser');
    });

    describe('#submit()', () => {
      it('submits a metric', () => {
        const promise = metrics.submit('testMetric');

        return promiseTick(50)
          .then(() => clock.tick(config.metrics.batcherWait))
          .then(() => promise)
          .then(() => {
            assert.calledOnce(webex.request);
            const req = webex.request.args[0][0];
            const metric = req.body.metrics[0];

            assert.property(metric, 'key');
            assert.property(metric, 'version');
            assert.property(metric, 'appType');
            assert.property(metric, 'env');
            assert.property(metric, 'time');
            assert.property(metric, 'version');

            assert.equal(metric.key, 'testMetric');
            assert.equal(metric.version, webex.version);
            assert.equal(metric.env, 'TEST');
          });
      });
    });

    describe('#getClientMetricsPayload()', () => {
      it('returns the expected payload', () => {
        webex.credentials.supertoken = new Token(
          {
            access_token: 'a_b_orgid',
          },
          {parent: webex}
        );

        const testPayload = {
          tags: {success: true},
          fields: {perceivedDurationInMillis: 314},
          context: {},
          eventPayload: {value: 'splunk business metric payload'},
        };
        const date = clock.now;

        const result = metrics.getClientMetricsPayload('test', testPayload);

        assert.deepEqual(result, {
          context: {
            app: {
              version: undefined,
            },
            locale: 'en-US',
            os: {
              name: 'other',
              version: getOSVersion(),
            },
          },
          eventPayload: {
            value: 'splunk business metric payload',
          },
          fields: {
            browser_version: '',
            client_id: 'fake',
            os_version: getOSVersion(),
            perceivedDurationInMillis: 314,
            platform: 'Web',
            sdk_version: undefined,
            spark_user_agent: 'webex-js-sdk appName/appVersion appPlatform',
          },
          metricName: 'test',
          tags: {
            appVersion: '43.0.105',
            browser: '',
            domain: 'whatever',
            os: 'other',
            success: true,
          },
          timestamp: 0,
          type: ['operational'],
        });
      });

      it('throws when no event name is specified', () => {
        assert.throws(() => {
          metrics.getClientMetricsPayload();
        }, 'Missing behavioral metric name. Please provide one');
      });
    });

    describe('#submitClientMetrics()', () => {
      describe('before login', () => {
        it('clientMetricsPreloginBatcher pre-login metric', () => {
          const date = clock.now;
          const promise = metrics.submitClientMetrics(eventName, mockPayload, preLoginId);

          return promiseTick(50)
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => promise)
            .then(() => {
              assert.calledOnce(webex.request);
              const req = webex.request.args[0][0];
              const metric = req.body.metrics[0];

              assert.property(metric, 'metricName');
              assert.property(metric, 'tags');
              assert.property(metric, 'fields');
              assert.property(metric, 'timestamp');
              assert.property(metric, 'type');
              assert.property(metric, 'eventPayload');
              assert.notProperty(metric.tags, 'org_id');

              assert.equal(metric.timestamp, date);
              assert.equal(metric.metricName, 'test_event');
              assert.equal(metric.type, 'behavioral');
              assert.equal(metric.fields.testField, 123);
              assert.equal(metric.tags.testTag, 'tag value');
              assert.equal(metric.eventPayload.value, 'splunk business metric payload');
            });
        });
      });
      describe('after login', () => {
        it('submits a metric to clientmetrics', () => {
          webex.credentials.supertoken = new Token(
            {
              access_token: 'a_b_orgid',
            },
            {parent: webex}
          );

          const testPayload = {
            tags: {success: true},
            fields: {perceivedDurationInMillis: 314},
            context: {},
            eventPayload: {value: 'splunk business metric payload'},
          };
          const date = clock.now;

          const promise = metrics.submitClientMetrics('test', testPayload);

          return promiseTick(50)
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => promise)
            .then(() => {
              assert.calledOnce(webex.request);
              const req = webex.request.args[0][0];
              const metric = req.body.metrics[0];

              assert.property(metric, 'metricName');
              assert.property(metric, 'tags');
              assert.property(metric, 'fields');
              assert.property(metric, 'timestamp');
              assert.property(metric, 'context');
              assert.property(metric, 'eventPayload');

              assert.property(metric.tags, 'browser');
              assert.property(metric.tags, 'os');
              assert.property(metric.tags, 'domain');

              assert.property(metric.fields, 'browser_version');
              assert.property(metric.fields, 'os_version');
              assert.property(metric.fields, 'sdk_version');
              assert.property(metric.fields, 'platform');
              assert.property(metric.fields, 'spark_user_agent');
              assert.property(metric.fields, 'client_id');

              assert.property(metric.context, 'app');
              assert.property(metric.context, 'locale');
              assert.property(metric.context, 'os');

              assert.equal(metric.timestamp, date);
              assert.equal(metric.metricName, 'test');
              assert.equal(metric.tags.success, true);
              assert.equal(metric.fields.perceivedDurationInMillis, 314);
              assert.equal(metric.eventPayload.value, 'splunk business metric payload');
            });
        });

        it('throws error if no metric name is given', () => {
          assert.throws(
            () => metrics.submitClientMetrics(),
            'Missing behavioral metric name. Please provide one'
          );
        });
      });
    });

    describe('#aliasUser()', () => {
      it('returns an HttpResponse object', () =>
        metrics.aliasUser(preLoginId).then(() => {
          assert.calledOnce(webex.request);
          const req = webex.request.args[0][0];
          const params = req.qs;

          assert.match(params, {alias: true});
        }));
    });
  });
});
