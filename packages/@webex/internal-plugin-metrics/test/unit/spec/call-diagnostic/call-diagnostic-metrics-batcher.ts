/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import { assert } from '@webex/test-helper-chai';
import { config, Utils } from '@webex/internal-plugin-metrics';
import { CallDiagnosticUtils } from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import FakeTimers from '@sinonjs/fake-timers';
import { NewMetrics } from '@webex/internal-plugin-metrics';

const flushPromises = () => new Promise(setImmediate);

function promiseTick(count) {
  let promise = Promise.resolve();

  while (count > 1) {
    promise = promise.then(() => promiseTick(1));
    count -= 1;
  }

  return promise;
}

describe('plugin-metrics', () => {
  describe('CallDiagnosticEventsBatcher', () => {
    let webex;
    let clock;

    beforeEach(() => {
      clock = FakeTimers.install({ now: Date.now() });

      //@ts-ignore
      webex = new MockWebex({
        children: {
          newMetrics: NewMetrics,
        },
      });

      webex.request = function (options) {
        return Promise.resolve({
          statusCode: 204,
          body: {},
          waitForServiceTimeout: 15,
          options
        })
      }

      sinon.spy(webex, 'request');

      webex.emit('ready');

      webex.config.metrics = config.metrics;
    });

    afterEach(() => {
      clock.uninstall();
    });

    describe('#request()', () => {
      describe('when the request completes successfully', () => {
        it('clears the queue', async () => {
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            { event: { name: 'client.interstitial-window.launched' } }
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });

        it('calls prepareDiagnosticMetricItem correctly', async () => {
          // avoid setting .sent timestamp
          webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.prepareRequest =
            (q) => Promise.resolve(q);

          const prepareItemSpy = sinon.spy(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher,
            'prepareItem'
          );
          const prepareDiagnosticMetricItemSpy = sinon.spy(
            CallDiagnosticUtils,
            'prepareDiagnosticMetricItem'
          );

          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics({
            event: 'my.event',
          });

          await flushPromises();

          clock.tick(config.metrics.batcherWait);

          await promise;

          const calls = prepareItemSpy.getCalls()[0];

          // item also gets assigned a delay property but the key is a Symbol and haven't been able to test that..
          assert.deepEqual(calls.args[0].eventPayload, {
            event: 'my.event',
            origin: { buildType: 'test', networkType: 'unknown' },
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
    });

    describe('when the request fails', () => {
      it('does not clear the queue', async () => {
        // sinon appears to have gap in its api where stub.onCall(n) doesn't
        // accept a function, so the following is more verbose than one might
        // desire
        webex.request = function () {
          // noop
        };

        sinon.stub(webex, 'request').callsFake(() => {
          return Promise.reject("error")
        });

        // avoid setting .sent timestamp
        webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.prepareRequest =
          (q) => Promise.resolve(q);

        webex.logger.error = sinon.stub();
        webex.logger.log = sinon.stub();
        sinon.stub(Utils, 'generateCommonErrorMetadata').returns('formattedError');


        const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics({
          event: 'my.event',
        });

        return promiseTick(100)
          .then(() => assert.lengthOf(webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue, 1))
          .then(() => clock.tick(config.metrics.batcherWait))
          .then(() => promise)
          .catch(() => {
            const calls = webex.logger.error.getCalls();

            assert.deepEqual(calls[0].args[0], 'call-diagnostic-events -> ');
            // This is horrific, but stubbing lodash is proving difficult
            assert.match(
              calls[0].args[1],
              /CallDiagnosticEventsBatcher: @submitHttpRequest#ca-batch-\d{0,}\. Request failed:/
            );
            assert.deepEqual(calls[0].args[2], `error: formattedError`);

            assert.lengthOf(
              webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
              0
            );
          })
      });
    });
  });
});
