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
    let now;

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
      describe('when the request completes successfully', () => {
        it('clears the queue', async () => {
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.interstitial-window.launched'}}
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

        it('doesnt include any joinTimes for other events', async () => {
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.alert.displayed'}}
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.alert.displayed',
          });
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });

        it('appends the correct join times to the request for client.interstitial-window.launched', async () => {
          webex.internal.newMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon
            .stub()
            .returns(10);
          webex.internal.newMetrics.callDiagnosticLatencies.getClickToInterstitial = sinon
            .stub()
            .returns(10);
          webex.internal.newMetrics.callDiagnosticLatencies.getRefreshCaptchaReqResp = sinon
            .stub()
            .returns(10);
          webex.internal.newMetrics.callDiagnosticLatencies.getDownloadIntelligenceModelsReqResp =
            sinon.stub().returns(42);

          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.interstitial-window.launched'}}
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.interstitial-window.launched',
            joinTimes: {
              clickToInterstitial: 10,
              meetingInfoReqResp: 10,
              refreshCaptchaServiceReqResp: 10,
              downloadIntelligenceModelsReqResp: 42,
            },
          });
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });

        it('appends the correct join times to the request for client.call.initiated', async () => {
          webex.internal.newMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon
            .stub()
            .returns(10);
          webex.internal.newMetrics.callDiagnosticLatencies.getU2CTime = sinon
            .stub()
            .returns(20);
          webex.internal.newMetrics.callDiagnosticLatencies.getReachabilityClustersReqResp = sinon
            .stub()
            .returns(10);
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.call.initiated'}}
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;
          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.call.initiated',
            joinTimes: {
              meetingInfoReqResp: 10,
              registerWDMDeviceJMT: 10,
              showInterstitialTime: 10,
              getU2CTime: 20,
              getReachabilityClustersReqResp: 10
            },
          });
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });

        it('appends the correct join times to the request for client.locus.join.response', async () => {
          webex.internal.newMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon
            .stub()
            .returns(10);
          webex.internal.newMetrics.callDiagnosticLatencies.getPageJMT = sinon.stub().returns(30);
          webex.internal.newMetrics.callDiagnosticLatencies.getClientJMT = sinon.stub().returns(5);
          webex.internal.newMetrics.callDiagnosticLatencies.getClickToInterstitial = sinon
            .stub()
            .returns(10);
          webex.internal.newMetrics.callDiagnosticLatencies.getCallInitJoinReq = sinon
            .stub()
            .returns(10);
          webex.internal.newMetrics.callDiagnosticLatencies.getDownloadTimeJMT = sinon
            .stub()
            .returns(100);
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.locus.join.response'}}
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.locus.join.response',
            joinTimes: {
              callInitJoinReq: 10,
              clickToInterstitial: 10,
              interstitialToJoinOK: 10,
              joinReqResp: 10,
              meetingInfoReqResp: 10,
              pageJmt: 30,
              totalJmt: 20,
              clientJmt: 5,
              downloadTime: 100,
            },
          });
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });

        it('appends the correct join times to the request for client.ice.end', async () => {
          webex.internal.newMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon
            .stub()
            .returns(10);
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.ice.end'}}
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.ice.end',
            joinTimes: {
              ICESetupTime: 10,
              audioICESetupTime: 10,
              shareICESetupTime: 10,
              videoICESetupTime: 10,
            },
          });
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });

        it('appends the correct join times to the request for client.media.rx.start', async () => {
          webex.internal.newMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon
            .stub()
            .returns(10);
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.media.rx.start'}}
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.media.rx.start',
            joinTimes: {
              localSDPGenRemoteSDPRecv: 10,
            },
          });
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });

        it('appends the correct join times to the request for client.media-engine.ready', async () => {
          webex.internal.newMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon
            .stub()
            .returns(10);
          webex.internal.newMetrics.callDiagnosticLatencies.getInterstitialToMediaOKJMT = sinon
            .stub()
            .returns(10);
          webex.internal.newMetrics.callDiagnosticLatencies.getClickToInterstitial = sinon
            .stub()
            .returns(10);
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.media-engine.ready'}}
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.media-engine.ready',
            joinTimes: {
              totalMediaJMT: 30,
              interstitialToMediaOKJMT: 10,
              callInitMediaEngineReady: 10,
              stayLobbyTime: 10,
            },
          });
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });

        it('appends the correct audio and video setup delays to the request for client.mediaquality.event', async () => {
          webex.internal.newMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon
            .stub()
            .returns(10);
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.mediaquality.event'}}
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.mediaquality.event',
            audioSetupDelay: {
              joinRespRxStart: 10,
              joinRespTxStart: 10,
            },
            videoSetupDelay: {
              joinRespRxStart: 10,
              joinRespTxStart: 10,
            },
          });
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });

        it('doesnt include audioSetup and videoSetup delays for other events', async () => {
          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.alert.displayed'}}
          );
          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          await promise;

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(
            webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event.audioSetupDelay,
            undefined
          );
          assert.deepEqual(
            webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event.videoSetupDelay,
            undefined
          );
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });
      });

      describe('when the request fails', () => {
        it('does not clear the queue', async () => {
          // avoid setting .sent timestamp
          webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.prepareRequest =
            (q) => Promise.resolve(q);

          const err = new Error('error');
          webex.request = sinon.stub().returns(Promise.reject(err));

          webex.logger.error = sinon.stub();
          webex.logger.log = sinon.stub();
          sinon.stub(Utils, 'generateCommonErrorMetadata').returns('formattedError');

          const promise = webex.internal.newMetrics.callDiagnosticMetrics.submitToCallDiagnostics({
            event: 'my.event',
          });

          await flushPromises();
          clock.tick(config.metrics.batcherWait);

          let error;

          // catch the expected error and store it
          await promise.catch((e) => {
            error = e;
          });

          // This is horrific, but stubbing lodash is proving difficult
          const expectedBatchId = parseInt(uniqueId()) - 1;

          // check that promise was rejected with the original error of the webex.request
          assert.deepEqual(err, error);

          assert.calledOnceWithExactly(
            webex.logger.error,
            'call-diagnostic-events -> ',
            `CallDiagnosticEventsBatcher: @submitHttpRequest#ca-batch-${expectedBatchId}. Request failed:`,
            `error: formattedError`
          );
          assert.lengthOf(
            webex.internal.newMetrics.callDiagnosticMetrics.callDiagnosticEventsBatcher.queue,
            0
          );
        });
      });
    });

    describe('prepareItem', () => {
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
  });
});
