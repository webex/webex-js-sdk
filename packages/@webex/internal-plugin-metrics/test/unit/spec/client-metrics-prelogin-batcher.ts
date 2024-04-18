/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {config, Utils} from '@webex/internal-plugin-metrics';
import {Token, Credentials} from '@webex/webex-core';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import FakeTimers from '@sinonjs/fake-timers';
import Metrics from '@webex/internal-plugin-metrics';

const flushPromises = () => new Promise(setImmediate);

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


    it('checks prepareItem', async () => {
        const testItem = {id: 1};
        const p = await webex.internal.metrics.clientMetricsPreloginBatcher.prepareItem(testItem);
        assert.strictEqual(p, testItem);
    });

    it('checks prepareRequest', async () => {
        const testQueue = [];

        const p = await webex.internal.metrics.clientMetricsPreloginBatcher.prepareRequest(testQueue);
        assert.strictEqual(p, testQueue);
    });
  });
});