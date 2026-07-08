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

const flushPromises = () => new Promise(setImmediate);

describe('internal-plugin-metrics', () => {
  describe('PreLoginMetricsBatcher', () => {
    let webex;
    let clock;
    let now;
    const deviceManagerStub = {getPairedDevice: sinon.stub()};
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
      webex.devicemanager = deviceManagerStub;

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

        assert.deepEqual(webexRequestArgs.headers, {
          authorization: false,
          'x-prelogin-userid': preLoginId,
        });
        assert.equal(webexRequestArgs.method, 'POST');
        assert.equal(webexRequestArgs.resource, 'clientmetrics-prelogin');
        assert.equal(webexRequestArgs.service, 'metrics');
        assert.equal(webexRequestArgs.waitForServiceTimeout, 30);

        assert.deepEqual(webexRequestArgs.body.metrics[0].eventPayload, {
          event: {
            joinTimes: {
              meetingInfoReqResp: undefined,
              clickToInterstitial: undefined,
              refreshCaptchaServiceReqResp: undefined,
              downloadIntelligenceModelsReqResp: undefined,
              clickToInterstitialWithUserDelay: undefined,
            },
            name: 'client.interstitial-window.launched',
          },
          origin: {
            buildType: 'test',
            networkType: 'unknown',
            upgradeChannel: 'test',
          },
          originTime: {
            sent: dateAfterBatcherWait.toISOString(),
          },
        });
        assert.deepEqual(webexRequestArgs.body.metrics[0].type, ['diagnostic-event']);
        assert.equal(webexRequestArgs.body.metrics[0].markTelemetryOptOutOnResponse, true);
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
          origin: {buildType: 'test', networkType: 'unknown', upgradeChannel: 'test'},
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
            upgradeChannel: 'test',
          },
        });
        assert.deepEqual(prepareDiagnosticMetricItemCalls[0].args[1].type, ['diagnostic-event']);
      });
      it('adds the paired device to the metric payload if paired', async () => {
        webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.prepareRequest = (
          q
        ) => Promise.resolve(q);
        webex.devicemanager.getPairedDevice = sinon.stub().returns({
          deviceInfo: {
            id: 'my_device_id',
          },
          url: 'my_url',
          mode: 'personal',
          devices: [{productName: 'my_product_name'}],
        });
        webex.devicemanager.getPairedMethod = sinon.stub().returns("Manual");

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
              event: {name: 'client.interstitial-window.launched'},
            },
            preLoginId
          );

        await flushPromises();

        clock.tick(config.metrics.batcherWait);

        await promise;

        const calls = prepareItemSpy.getCalls()[0];

        assert.deepEqual(calls.args[0].eventPayload, {
            event: {
              joinTimes: {
                meetingInfoReqResp: undefined,
                clickToInterstitial: undefined,
                clickToInterstitialWithUserDelay: undefined,
                refreshCaptchaServiceReqResp: undefined,
                downloadIntelligenceModelsReqResp: undefined,
              },
              name: 'client.interstitial-window.launched',
              pairedDevice: {
                deviceId: 'my_device_id',
                deviceURL: 'my_url',
                devicePairingType: 'Manual',
                productName: 'my_product_name',
                isPersonalDevice: true,
              },
              pairingState: 'paired',
            },
            origin: {
              buildType: 'test',
              networkType: 'unknown',
              upgradeChannel: 'test',
            },
        });

        assert.deepEqual(calls.args[0].type, ['diagnostic-event']);
        assert.calledOnce(webex.devicemanager.getPairedDevice);
       
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

    describe('#submitHttpRequest', () => {
      it('calls webex.request with the correct parameters and then it calls handleHttpResponseStatus on success', async () => {
        const payload = [
          {
            eventPayload: {event: 'my.event'},
            type: ['diagnostic-event'],
          },
        ];

        webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.savePreLoginId(
          preLoginId
        );
        webex.request = sinon.stub().resolves({statusCode: 200});

        const handleHttpResponseStatusSpy = sinon.spy(
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher,
          'handleHttpResponseStatus'
        );

        const promise =
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.submitHttpRequest(
            payload
          );

        assert.deepEqual(handleHttpResponseStatusSpy.getCalls().length, 0);

        await flushPromises();

        clock.tick(config.metrics.batcherWait);

        await promise;

        const webexRequestArgs = webex.request.args[0][0];

        assert.match(webexRequestArgs, {
          //@ts-ignore
          body: {
            metrics: payload,
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

        assert.deepEqual(handleHttpResponseStatusSpy.getCalls().length, 1);

        assert.deepEqual(handleHttpResponseStatusSpy.args[0][0], 200);
        assert.deepEqual(handleHttpResponseStatusSpy.args[0][1], payload);
      });

      it('it calls handleHttpResponseStatus on failure', async () => {
        const payload = [
          {
            eventPayload: {event: 'my.event'},
            type: ['diagnostic-event'],
          },
        ];

        webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.savePreLoginId(
          preLoginId
        );
        webex.request = sinon.stub().rejects({statusCode: 503});

        const handleHttpResponseStatusSpy = sinon.spy(
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher,
          'handleHttpResponseStatus'
        );

        const promise =
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.submitHttpRequest(
            payload
          );

        assert.deepEqual(handleHttpResponseStatusSpy.getCalls().length, 0);

        await flushPromises();

        clock.tick(config.metrics.batcherWait);

        let error;

        try {
          await promise;
        } catch (err) {
          error = err;
        }

        assert.deepEqual(error.statusCode, 503);

        assert.deepEqual(handleHttpResponseStatusSpy.getCalls().length, 1);

        assert.deepEqual(handleHttpResponseStatusSpy.args[0][0], 503);
        assert.deepEqual(handleHttpResponseStatusSpy.args[0][1], payload);
      });
    })

    describe('#handleHttpResponseStatus', () => {
      let setIsTelemetryOptOutAutomaticStub;

      beforeEach(() => {
        setIsTelemetryOptOutAutomaticStub = sinon.stub(
          webex.internal.newMetrics.callDiagnosticMetrics,
          'setIsTelemetryOptOutAutomatic'
        );
      });

      [201, 400, 503, undefined].forEach((statusCode) => {
        it(`does not call setIsTelemetryOptOutAutomatic when shouldMark is true and statusCode is ${statusCode}`, () => {
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.handleHttpResponseStatus(
            statusCode,
            [{markTelemetryOptOutOnResponse: true}]
          );

          assert.notCalled(setIsTelemetryOptOutAutomaticStub);
        });
      });

      it('calls setIsTelemetryOptOutAutomatic(true) when statusCode is 200 and markTelemetryOptOutOnResponse is true', () => {
        webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.handleHttpResponseStatus(
          200,
          [{markTelemetryOptOutOnResponse: true}]
        );

        assert.calledOnce(setIsTelemetryOptOutAutomaticStub);
        assert.calledWithExactly(setIsTelemetryOptOutAutomaticStub, true);
      });

      [200, 201, 400, 503, undefined].forEach((statusCode) => {
        it(`does not call setIsTelemetryOptOutAutomatic when shouldMark is false (statusCode: ${statusCode})`, () => {
          webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.handleHttpResponseStatus(
            statusCode,
            [{markTelemetryOptOutOnResponse: false}]
          );

          assert.notCalled(setIsTelemetryOptOutAutomaticStub);
        });
      });

      it('does not call setIsTelemetryOptOutAutomatic when payload is empty', () => {
        webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.handleHttpResponseStatus(
          200,
          []
        );

        assert.notCalled(setIsTelemetryOptOutAutomaticStub);
      });

      it('does not call setIsTelemetryOptOutAutomatic when payload is not an array', () => {
        webex.internal.newMetrics.callDiagnosticMetrics.preLoginMetricsBatcher.handleHttpResponseStatus(
          200,
          null
        );

        assert.notCalled(setIsTelemetryOptOutAutomaticStub);
      });
    });
  });
});
