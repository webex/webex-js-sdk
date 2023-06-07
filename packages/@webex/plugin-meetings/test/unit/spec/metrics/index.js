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
    timezone: 'America/Los_Angeles',
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockSubmitMetric = sandbox.stub();
    webex = new MockWebex({
      children: {
        metrics: Metrics,
      },
    });

    webex.version = '1.2.3';
    webex.credentials.getOrgId = sinon.fake.returns('7890');
    webex.credentials.config = {
      _values: {
        clientId: 'mock-client-id',
      },
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
        geoHintInfo,
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
        geoHintInfo,
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

  describe('parseWebexApiError', () => {
    it('returns the correct error data for meeting lookup info error', () => {
      const err = {
        body: {
          code: 58400,
        },
        statusCode: 400,
      };
      const res = metrics.parseWebexApiError(err, false);

      assert.deepEqual(res, {
        shownToUser: false,
        category: 'signaling',
        errorDescription: 'MeetingInfoLookupError',
        errorCode: 4100,
        fatal: true,
        name: 'other',
        serviceErrorCode: 58400,
        errorData:  { error: { code: 58400 } },
        httpCode: 400
      });
    });

    it('returns the correct error data for access rights error error', () => {
      const err = {
        body: {
          code: 403041,
        },
        statusCode: 400,
      };
      const res = metrics.parseWebexApiError(err, false);

      assert.deepEqual(res, {
        shownToUser: false,
        "category": "expected",
        "errorCode": 4005,
        errorDescription: 'Moderator_Pin_Or_Guest_PIN_Required',
        fatal: false,
        name: 'other',
        serviceErrorCode: 403041,
        errorData: { error: { code: 403041 } },
        httpCode: 400
      });
    });

    it('returns default 4100 mapping for unknown error', () => {
      const err = {
        body: {
          code: 123456,
        },
      };
      const res = metrics.parseWebexApiError(err, false);

      assert.deepEqual(res, {
        shownToUser: false,
        category: 'signaling',
        errorDescription: 'MeetingInfoLookupError',
        errorCode: 4100,
        fatal: true,
        name: 'other',
        serviceErrorCode: 123456,
        errorData:  { error: { code: 123456 } },
      });
    });
  });

  describe('#generateErrorPayload', () => {
    it('generates the correct payload for a valid error code', () => {
      const errorCode = 4008;
      const shownToUser = true;
      const name = 'errorName';
      const errBody = 'some error body';
      const err = {
        body: errBody,
        statusCode: 404,
      };

      const payload = metrics.generateErrorPayload(
        errorCode,
        shownToUser,
        name,
        err
      );

      assert.deepEqual(payload, {
        shownToUser,
        category: 'expected',
        errorDescription: 'NewLocusError',
        errorCode,
        fatal: true,
        name,
        errorData: {error: errBody},
        serviceErrorCode: undefined,
        httpCode: 404,
      });
    });
  });
});
