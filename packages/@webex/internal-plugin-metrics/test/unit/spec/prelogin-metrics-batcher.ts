/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {config, Utils} from '@webex/internal-plugin-metrics';
import {CallDiagnosticUtils} from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import FakeTimers from '@sinonjs/fake-timers';
import {NewMetrics} from '@webex/internal-plugin-metrics';
import {uniqueId} from 'lodash';

const flushPromises = () => new Promise(setImmediate);

describe('internal-plugin-metrics', () => {
  describe('PreLoginMetricsBatcher', () => {
    let webex;
    let clock;
    let now;

    const preLoginId = 'my_prelogin_id';

    beforeEach(() => {
      now = new Date();
      clock = FakeTimers.install({now});

      //@ts-ignore
      webex = new MockWebex({
        children: {
          newMetrics: NewMetrics,
        },
      });

      webex.request = (options) =>
        Promise.resolve({body: {items: []}, waitForServiceTimeout: 15, options});

      sinon.spy(webex, 'request');
      webex.emit('ready');
      webex.config.metrics = config.metrics;
    });

    afterEach(() => {
      sinon.restore();
      clock.uninstall();
    });

    describe('#request()', () => {
      it('when the request completes successfully, clears the queue', async () => {
        const promise =
          webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnosticsPreLogin(
            //@ts-ignore
            {event: {name: 'client.interstitial-window.launched'}},
            preLoginId
          );
        await flushPromises();
        clock.tick(config.metrics.batcherWait);

        await promise;

        const webexRequestArgs = webex.request.args[0][0];

        const dateAfterBatcherWait = new Date(now.getTime() + config.metrics.batcherWait);
        //@ts-ignore
        assert.calledOnce(webex.request);

        // matching because the request includes a symbol key: value pair and sinon cannot handle to compare it..
        assert.match(webexRequestArgs, {
          body: {
            metrics: [
              {
                eventPayload: {
                  event: {
                    joinTimes: {
                      meetingInfoReqResp: undefined,
                      clickToInterstitial: undefined,
                      refreshCaptchaServiceReqResp: undefined,
                      downloadIntelligenceModelsReqResp: undefined,
                    },
                    name: 'client.interstitial-window.launched',
                  },
                  origin: {
                    buildType: 'test',
                    networkType: 'unknown',
                  },
                  originTime: {
                    sent: dateAfterBatcherWait.toISOString(),
                  },
                },
                type: ['diagnostic-event'],
              },
            ],
          },
          headers: {
            authorization: false,
            'x-prelogin-userid': preLoginId,
          },
          method: 'POST',
          resource: 'clientmetrics-prelogin',
          service: 'metrics',
          waitForServiceTimeout: 30,
        });
        assert.lengthOf(
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.queue,
          0
        );
      });

      it('when the request fails, does not clear the queue', async () => {
        webex.request = sinon.stub().rejects(new Error('my_error'));

        webex.logger.error = sinon.stub();
        webex.logger.log = sinon.stub();
        sinon.stub(Utils, 'generateCommonErrorMetadata').returns('formattedError');

        const promise =
          webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnosticsPreLogin(
            {
              event: 'my.event',
            },
            preLoginId
          );

        await flushPromises();
        clock.tick(config.metrics.batcherWait);

        let error;

        // catch the expected error and store it
        try {
          await promise;
        } catch (err) {
          error = err;
        }

        const calls = webex.logger.error.getCalls();

        assert.deepEqual(calls[0].args[0], 'Pre Login Metrics -->');
        // This is horrific, but stubbing lodash is proving difficult
        assert.match(
          calls[0].args[1],
          /PreLoginMetricsBatcher: @submitHttpRequest#prelogin-batch-\d{0,}\. Request failed:/
        );
        assert.deepEqual(calls[0].args[2], `error: formattedError`);

        assert.lengthOf(
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.queue,
          0
        );
      });

      it('fails if preLoinId is not set', async () => {
        webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.preLoginId =
          undefined;

        const promise =
          webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnosticsPreLogin(
            {
              event: 'my.event',
            },
            undefined
          );

        await flushPromises();
        clock.tick(config.metrics.batcherWait);

        let error;

        // catch the expected error and store it
        try {
          await promise;
        } catch (err) {
          error = err;
        }

        assert.equal(error.message, 'PreLoginId is not set.');
      });
    });

    describe('prepareItem', () => {
      it('calls prepareDiagnosticMetricItem correctly', async () => {
        // avoid setting .sent timestamp
        webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.prepareRequest = (q) =>
          Promise.resolve(q);

        const prepareItemSpy = sinon.spy(
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher,
          'prepareItem'
        );
        const prepareDiagnosticMetricItemSpy = sinon.spy(
          CallDiagnosticUtils,
          'prepareDiagnosticMetricItem'
        );

        const promise =
          webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnosticsPreLogin(
            {
              event: 'my.event',
            },
            preLoginId
          );

        await flushPromises();

        clock.tick(config.metrics.batcherWait);

        await promise;

        const calls = prepareItemSpy.getCalls()[0];

        // item also gets assigned a delay property but the key is a Symbol and haven't been able to test that..
        assert.deepEqual(calls.args[0].eventPayload, {
          event: 'my.event',
          origin: {buildType: 'test', networkType: 'unknown'},
        });

        assert.deepEqual(calls.args[0].type, ['diagnostic-event']);

        const prepareDiagnosticMetricItemCalls = prepareDiagnosticMetricItemSpy.getCalls();

        // second argument (item) also gets assigned a delay property but the key is a Symbol and haven't been able to test that..
        assert.deepEqual(prepareDiagnosticMetricItemCalls[0].args[0], webex);
        assert.deepEqual(prepareDiagnosticMetricItemCalls[0].args[1].eventPayload, {
          event: 'my.event',
          origin: {
            buildType: 'test',
            networkType: 'unknown',
          },
        });
        assert.deepEqual(prepareDiagnosticMetricItemCalls[0].args[1].type, ['diagnostic-event']);
      });
    });

    describe('savePreLoginId', () => {
      it('saves the preLoginId', () => {
        const preLoginId = 'my_prelogin_id';

        assert.isUndefined(
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.preLoginId
        );

        webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.savePreLoginId(
          preLoginId
        );

        assert.equal(
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.preLoginId,
          preLoginId
        );
      });
    });
  });
});
