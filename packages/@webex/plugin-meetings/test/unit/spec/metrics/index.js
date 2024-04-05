/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import sinon from 'sinon';
import Metrics from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';

import metrics from '@webex/plugin-meetings/src/metrics';

/**
 * Meeting can only run in a browser, so we can only send metrics for
 * browser usage.
 */
describe('Meeting metrics', () => {
  let webex, mockSubmitMetric, sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockSubmitMetric = sandbox.stub();
    webex = new MockWebex({
      children: {
        metrics: Metrics,
      },
    });

    webex.config.metrics.type = ['behavioral'];
    webex.internal.metrics.submitClientMetrics = mockSubmitMetric;
    metrics.initialSetup(webex);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#sendBehavioralMetric', () => {
    it('sends client metric via Metrics plugin', () => {
      metrics.sendBehavioralMetric('myMetric');

      assert.calledOnce(mockSubmitMetric);
    });

    it('adds environment information to metric', () => {
      const fields = {value: 567};
      const metricTags = {test: true};

      metrics.sendBehavioralMetric('myMetric', fields, metricTags);

      assert.calledWithMatch(mockSubmitMetric, 'myMetric', {
        type: ['behavioral'],
        fields: {
          value: 567,
        },
        tags: {
          test: true,
        },
      });
    });
  });
});
