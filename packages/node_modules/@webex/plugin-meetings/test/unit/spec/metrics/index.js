/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import sinon from 'sinon';
import Metrics from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import {browserOnly} from '@webex/test-helper-mocha';
import {assert} from '@webex/test-helper-chai';

import metrics from '@webex/plugin-meetings/src/metrics';


/**
 * Meeting can only run in a browser, so we can only send metrics for
 * browser usage.
 */
browserOnly(describe)('Meeting metrics', () => {
  let webex, mockSubmitMetric, sandbox;

  const geoHintInfo = {
    clientAddress: '2001:0db8:0000:08d3:0000:0000:0070:0000',
    clientRegion: 'US-WEST',
    countryCode: 'US',
    regionCode: 'US-WEST',
    timezone: 'America/Los_Angeles'
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockSubmitMetric = sandbox.stub();
    webex = new MockWebex({
      children: {
        metrics: Metrics
      }
    });

    webex.version = '1.2.3';
    webex.credentials.getOrgId = sinon.fake.returns('7890');
    webex.credentials.config = {
      _values: {
        clientId: 'mock-client-id'
      }
    };
    webex.config.metrics.type = ['behavioral'];
    webex.internal.metrics.submitClientMetrics = mockSubmitMetric;
    metrics.initialSetup({}, webex);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('initPayload / initMediaPayload', () => {
    it('should create payload with masked IPv4', () => {
      geoHintInfo.clientAddress = '128.0.0.1';
      webex.meetings = {
        geoHintInfo
      };
      metrics.initialSetup({}, webex);
      const payload = metrics.initPayload('myMetric', {}, {clientType: 'TEAMS_CLIENT'});

      assert(payload.origin.clientInfo.localNetworkPrefix === '128.0.0.0');
      assert(payload.event.name === 'myMetric');

      const payload2 = metrics.initMediaPayload('myMetric', {}, {clientType: 'TEAMS_CLIENT'});

      assert(payload2.origin.clientInfo.localNetworkPrefix === '128.0.0.0');
    });

    it('should create payload with masked IPv6', () => {
      geoHintInfo.clientAddress = '2001:0db8:0000:08d3:0000:0000:0070:0000';
      webex.meetings = {
        geoHintInfo
      };
      metrics.initialSetup({}, webex);
      const payload = metrics.initPayload('myIPv6Metric', {}, {clientType: 'TEAMS_CLIENT'});

      assert(payload.origin.clientInfo.localNetworkPrefix === '2001:db8:0:8d3::');
      assert(payload.event.name === 'myIPv6Metric');

      const payload2 = metrics.initMediaPayload('myIPv6Metric', {}, {clientType: 'TEAMS_CLIENT'});

      assert(payload2.origin.clientInfo.localNetworkPrefix === '2001:db8:0:8d3::');
    });
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

      assert.calledWithMatch(
        mockSubmitMetric,
        'myMetric',
        {
          type: ['behavioral'],
          fields: {
            value: 567
          },
          tags: {
            test: true
          }
        }
      );
    });
  });
});
