/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import Metrics, {config} from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {NewMetrics} from '@webex/internal-plugin-metrics';

const flushPromises = () => new Promise(setImmediate);

describe('plugin-metrics', () => {
  describe('CallDiagnosticEventsBatcher', () => {
    let webex;

    beforeEach(() => {
      //@ts-ignore
      webex = new MockWebex({
        children: {
          metrics: Metrics,
        },
      });

      webex.request = (options) => Promise.resolve({body: {items: []}, options});
      sinon.spy(webex, 'request');

      NewMetrics.initialSetupCallDiagnosticMetrics({}, webex);

      webex.config.metrics = config.metrics;
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('#request()', () => {
      describe('when the request completes successfully', async () => {
        it('clears the queue', async () => {
          await NewMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.interstitial-window.launched'}}
          );
          await flushPromises();

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.lengthOf(webex.internal.metrics.callDiagnosticEventsBatcher.queue, 0);
        });

        it('doesnt include any joinTimes for other events', async () => {
          await NewMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.alert.displayed'}}
          );
          await flushPromises();

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.alert.displayed',
          });
          assert.lengthOf(webex.internal.metrics.callDiagnosticEventsBatcher.queue, 0);
        });

        it('appends the correct join times to the request for client.interstitial-window.launched', async () => {
          NewMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon.stub().returns(10);
          await NewMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.interstitial-window.launched'}}
          );
          await flushPromises();

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.interstitial-window.launched',
            joinTimes: {
              clickToInterstitial: 10,
              meetingInfoReqResp: 10,
            },
          });
          assert.lengthOf(webex.internal.metrics.callDiagnosticEventsBatcher.queue, 0);
        });

        it('appends the correct join times to the request for client.call.initiated', async () => {
          NewMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon.stub().returns(10);
          await NewMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.call.initiated'}}
          );
          await flushPromises();

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.call.initiated',
            joinTimes: {
              meetingInfoReqResp: 10,
              showInterstitialTime: 10,
            },
          });
          assert.lengthOf(webex.internal.metrics.callDiagnosticEventsBatcher.queue, 0);
        });

        it('appends the correct join times to the request for client.locus.join.response', async () => {
          NewMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon.stub().returns(10);
          NewMetrics.callDiagnosticLatencies.getJoinRespSentReceived = sinon.stub().returns(20);
          NewMetrics.callDiagnosticLatencies.getPageJMT = sinon.stub().returns(30);
          await NewMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.locus.join.response'}}
          );
          await flushPromises();

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.locus.join.response',
            joinTimes: {
              callInitJoinReq: 10,
              clickToInterstitial: 10,
              interstitialToJoinOK: 10,
              joinReqResp: 10,
              joinReqSentReceived: 20,
              meetingInfoReqResp: 10,
              pageJmt: 30,
              totalJmt: 20,
            },
          });
          assert.lengthOf(webex.internal.metrics.callDiagnosticEventsBatcher.queue, 0);
        });

        it('appends the correct join times to the request for client.ice.end', async () => {
          NewMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon.stub().returns(10);
          await NewMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.ice.end'}}
          );
          await flushPromises();

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
          assert.lengthOf(webex.internal.metrics.callDiagnosticEventsBatcher.queue, 0);
        });

        it('appends the correct join times to the request for client.media.rx.start', async () => {
          NewMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon.stub().returns(10);
          await NewMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.media.rx.start'}}
          );
          await flushPromises();

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.media.rx.start',
            joinTimes: {
              localSDPGenRemoteSDPRecv: 10,
            },
          });
          assert.lengthOf(webex.internal.metrics.callDiagnosticEventsBatcher.queue, 0);
        });

        it('appends the correct join times to the request for client.media-engine.ready', async () => {
          NewMetrics.callDiagnosticLatencies.getDiffBetweenTimestamps = sinon.stub().returns(10);
          await NewMetrics.callDiagnosticMetrics.submitToCallDiagnostics(
            //@ts-ignore
            {event: {name: 'client.media-engine.ready'}}
          );
          await flushPromises();

          //@ts-ignore
          assert.calledOnce(webex.request);
          assert.deepEqual(webex.request.getCalls()[0].args[0].body.metrics[0].eventPayload.event, {
            name: 'client.media-engine.ready',
            joinTimes: {
              totalMediaJMT: 40,
            },
          });
          assert.lengthOf(webex.internal.metrics.callDiagnosticEventsBatcher.queue, 0);
        });
      });
    });
  });
});
