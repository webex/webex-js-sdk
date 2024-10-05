/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Metrics from '@webex/internal-plugin-metrics';
import PreLoginMetricsBatcher from '@webex/internal-plugin-metrics';
import ClientMetricsPreloginBatcher from '@webex/internal-plugin-metrics';


describe('internal-plugin-metrics', () => {
  describe('ClientMetricsPreloginBatcher', () => {
    let webex;

    beforeEach(() => {
      //@ts-ignore
      webex = new MockWebex({
        children: {
            metrics: Metrics,
        },
      });

      webex.request = (options) =>
        Promise.resolve({body: {items: []}, waitForServiceTimeout: 15, options});

      sinon.spy(webex, 'request');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should be an instance of PreLoginMetricsBatcher', () => {
      const clientMetricsPreloginBatcher = new ClientMetricsPreloginBatcher();
      assert.instanceOf(clientMetricsPreloginBatcher, PreLoginMetricsBatcher);
    });


    it('checks prepareItem', async () => {
        const testItem = {id: 1};
        const resultPromise = await webex.internal.metrics.clientMetricsPreloginBatcher.prepareItem(testItem);
        assert.strictEqual(resultPromise, testItem);
    });

    it('checks prepareRequest', async () => {
        const testQueue = [];

        const resultPromise = await webex.internal.metrics.clientMetricsPreloginBatcher.prepareRequest(testQueue);
        assert.strictEqual(resultPromise, testQueue);
    });
  });
});