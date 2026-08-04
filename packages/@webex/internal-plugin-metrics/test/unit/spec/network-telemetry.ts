import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

import config from '../../../src/config';
import Metrics from '../../../src/metrics';
import {
  createNetworkErrorMetric,
  getOperation,
  NETWORK_REQUEST_SUMMARY_METRIC,
  NETWORK_TELEMETRY_INTERVAL_MS,
  shouldTrackNetworkRequest,
} from '../../../src/network-telemetry';

describe('network telemetry', function () {
  let clock: sinon.SinonFakeTimers;

  function makeWebex(networkTelemetryEnabled = true) {
    const warn = sinon.stub();
    const webex = new MockWebex({
      children: {
        metrics: Metrics,
      },
      logger: {warn},
      config: {
        metrics: {
          networkTelemetry: {enabled: networkTelemetryEnabled},
        },
      },
    });

    webex.config.metrics = {
      ...config.metrics,
      networkTelemetry: {
        ...config.metrics.networkTelemetry,
        enabled: networkTelemetryEnabled,
      },
    };

    return {warn, webex};
  }

  function makeTrackingId(_value: unknown, index: number) {
    return `tracking-${index}`;
  }

  beforeEach(function () {
    clock = sinon.useFakeTimers();
  });

  afterEach(function () {
    clock.restore();
    sinon.restore();
  });

  it('submits the requested ten-minute aggregate shape', function () {
    const {webex} = makeWebex();
    const submitClientMetrics = sinon
      .stub(webex.internal.metrics, 'submitClientMetrics')
      .resolves();
    const successfulOptions = {
      headers: {trackingid: 'tracking-success'},
      method: 'get',
      resource: 'rooms',
      service: 'Hydra',
    };
    const failedResponseOptions = {
      headers: {trackingid: 'tracking-response'},
      method: 'post',
      resource: 'rooms/Y2lzY29zcGFyazovL3VzL1JPT00/messages?personId=secret',
      service: 'Hydra',
    };
    const failedRequestOptions = {
      headers: {trackingid: 'tracking-request'},
      method: 'get',
      resource: 'people/12345',
      service: 'Identity',
    };

    webex.emit('request:start', successfulOptions);
    webex.emit('request:success', successfulOptions, {statusCode: 200});
    webex.emit('request:start', failedResponseOptions);
    webex.emit('request:failure', failedResponseOptions, {
      body: {errorCode: 'SERVICE_UNAVAILABLE', message: 'Service unavailable'},
      name: 'ServiceUnavailable',
      statusCode: 503,
    });
    webex.emit('request:start', failedRequestOptions);
    webex.emit('request:failure', failedRequestOptions, {
      body: {code: 'ETIMEDOUT', message: 'Socket timed out'},
      name: 'NetworkOrCORSError',
      statusCode: 0,
    });

    webex.emit('request:start', {service: 'metrics', resource: 'clientmetrics'});
    webex.emit('request:success', {service: 'metrics', resource: 'clientmetrics'});
    webex.emit('request:failure', {service: 'unifiedTelemetry'}, {statusCode: 503});

    clock.tick(NETWORK_TELEMETRY_INTERVAL_MS - 1);
    assert.notCalled(submitClientMetrics);

    clock.tick(1);

    assert.calledOnceWithExactly(submitClientMetrics, NETWORK_REQUEST_SUMMARY_METRIC, {
      type: 'operational',
      tags: {},
      fields: {
        totalSendRequest: 3,
        totalFailedRequest: 1,
        totalRecvdResponse: 2,
        totalFailedResponse: 1,
      },
      eventPayload: {
        metricsSummary: {
          totalSendRequest: 3,
          totalFailedRequest: 1,
          totalRecvdResponse: 2,
          totalFailedResponse: 1,
        },
        metrics: [
          {
            host: 'hydra',
            endPoint: 'rooms',
            countSendRequest: 1,
            countFailedRequest: 0,
            countRecvdResponse: 1,
            countFailedResponse: 0,
            averageNetworkDurationMs: 0,
            maxNetworkDurationP90Ms: 0,
            maxNetworkDurationP99Ms: 0,
          },
          {
            host: 'hydra',
            endPoint: 'rooms/:id/messages',
            countSendRequest: 1,
            countFailedRequest: 0,
            countRecvdResponse: 1,
            countFailedResponse: 1,
            averageNetworkDurationMs: 0,
            maxNetworkDurationP90Ms: 0,
            maxNetworkDurationP99Ms: 0,
          },
          {
            host: 'identity',
            endPoint: 'people/:id',
            countSendRequest: 1,
            countFailedRequest: 1,
            countRecvdResponse: 0,
            countFailedResponse: 0,
            averageNetworkDurationMs: 0,
            maxNetworkDurationP90Ms: 0,
            maxNetworkDurationP99Ms: 0,
          },
        ],
        errorMetrics: [
          {
            host: 'hydra',
            endPoint: 'rooms/:id/messages',
            statusCode: 503,
            errorCode: 'SERVICE_UNAVAILABLE',
            method: 'POST',
            errorType: 'server_error',
            errorMessage: 'Service unavailable',
            trackingIds: ['tracking-response'],
            countError: 1,
          },
          {
            host: 'identity',
            endPoint: 'people/:id',
            statusCode: 0,
            errorCode: 'ETIMEDOUT',
            method: 'GET',
            errorType: 'timeout',
            errorMessage: 'Socket timed out',
            trackingIds: ['tracking-request'],
            countError: 1,
          },
        ],
        errorMetricsSummary: {
          0: {count: 1},
          503: {count: 1},
        },
      },
    });
  });

  it('aggregates identical errors and caps unique tracking IDs at ten', function () {
    const {webex} = makeWebex();
    const submitClientMetrics = sinon
      .stub(webex.internal.metrics, 'submitClientMetrics')
      .resolves();

    Array.from({length: 12}, makeTrackingId).forEach(function emitFailure(trackingid) {
      webex.emit(
        'request:failure',
        {
          headers: {trackingid},
          method: 'get',
          resource: 'rooms',
          service: 'hydra',
        },
        {
          body: {errorCode: 'NOT_FOUND', message: 'Room not found'},
          name: 'NotFound',
          statusCode: 404,
        }
      );
    });

    clock.tick(NETWORK_TELEMETRY_INTERVAL_MS);

    const telemetry = submitClientMetrics.firstCall.args[1].eventPayload;

    assert.deepEqual(telemetry.metricsSummary, {
      totalSendRequest: 0,
      totalFailedRequest: 0,
      totalRecvdResponse: 12,
      totalFailedResponse: 12,
    });
    assert.deepEqual(telemetry.metrics, [
      {
        host: 'hydra',
        endPoint: 'rooms',
        countSendRequest: 0,
        countFailedRequest: 0,
        countRecvdResponse: 12,
        countFailedResponse: 12,
        averageNetworkDurationMs: 0,
        maxNetworkDurationP90Ms: 0,
        maxNetworkDurationP99Ms: 0,
      },
    ]);
    assert.equal(telemetry.errorMetrics[0].countError, 12);
    assert.deepEqual(
      telemetry.errorMetrics[0].trackingIds,
      Array.from({length: 10}, makeTrackingId)
    );
    assert.deepEqual(telemetry.errorMetricsSummary, {404: {count: 12}});
  });

  it('resets all aggregate sections for the next ten-minute window', function () {
    const {webex} = makeWebex();
    const submitClientMetrics = sinon
      .stub(webex.internal.metrics, 'submitClientMetrics')
      .resolves();

    webex.emit('request:start', {service: 'hydra', resource: 'rooms'});
    clock.tick(NETWORK_TELEMETRY_INTERVAL_MS);
    clock.tick(NETWORK_TELEMETRY_INTERVAL_MS);

    assert.calledTwice(submitClientMetrics);
    assert.deepEqual(submitClientMetrics.secondCall.args, [
      NETWORK_REQUEST_SUMMARY_METRIC,
      {
        type: 'operational',
        tags: {},
        fields: {
          totalSendRequest: 0,
          totalFailedRequest: 0,
          totalRecvdResponse: 0,
          totalFailedResponse: 0,
        },
        eventPayload: {
          metricsSummary: {
            totalSendRequest: 0,
            totalFailedRequest: 0,
            totalRecvdResponse: 0,
            totalFailedResponse: 0,
          },
          metrics: [],
          errorMetrics: [],
          errorMetricsSummary: {},
        },
      },
    ]);
  });

  it('flushes the current summary and stops collecting during cleanup', function () {
    const {webex} = makeWebex();
    const submitClientMetrics = sinon
      .stub(webex.internal.metrics, 'submitClientMetrics')
      .resolves();

    webex.emit('request:start', {service: 'hydra', resource: 'rooms'});
    webex.internal.metrics.stopNetworkTelemetry();
    webex.emit('request:start', {service: 'identity', resource: 'people'});
    clock.tick(NETWORK_TELEMETRY_INTERVAL_MS * 2);

    assert.calledOnce(submitClientMetrics);
    assert.deepEqual(submitClientMetrics.firstCall.args[1].eventPayload.metrics, [
      {
        host: 'hydra',
        endPoint: 'rooms',
        countSendRequest: 1,
        countFailedRequest: 0,
        countRecvdResponse: 0,
        countFailedResponse: 0,
        averageNetworkDurationMs: 0,
        maxNetworkDurationP90Ms: 0,
        maxNetworkDurationP99Ms: 0,
      },
    ]);
  });

  it('does not initialize network telemetry unless it is enabled', function () {
    const {webex} = makeWebex(false);
    const submitClientMetrics = sinon.stub(webex.internal.metrics, 'submitClientMetrics');

    webex.emit('request:start', {service: 'hydra', resource: 'rooms'});
    clock.tick(NETWORK_TELEMETRY_INTERVAL_MS);

    assert.isFalse(config.metrics.networkTelemetry.enabled);
    assert.notCalled(submitClientMetrics);
  });

  it('reports average, p90, and p99 network duration for completed requests', function () {
    const {webex} = makeWebex();
    const submitClientMetrics = sinon
      .stub(webex.internal.metrics, 'submitClientMetrics')
      .resolves();
    Array.from({length: 10}, function emitRequest(_, index) {
      const options = {
        service: 'hydra',
        resource: 'rooms',
        $timings: {networkStart: 0, networkEnd: (index + 1) * 100},
      };

      webex.emit('request:start', options);
      webex.emit('request:success', options, {statusCode: 200});
    });
    clock.tick(NETWORK_TELEMETRY_INTERVAL_MS);

    assert.deepEqual(submitClientMetrics.firstCall.args[1].eventPayload.metrics, [
      {
        host: 'hydra',
        endPoint: 'rooms',
        countSendRequest: 10,
        countFailedRequest: 0,
        countRecvdResponse: 10,
        countFailedResponse: 0,
        averageNetworkDurationMs: 550,
        maxNetworkDurationP90Ms: 900,
        maxNetworkDurationP99Ms: 1000,
      },
    ]);
  });

  it('contains asynchronous summary submission failures', async function () {
    const {warn, webex} = makeWebex();

    sinon
      .stub(webex.internal.metrics, 'submitClientMetrics')
      .rejects(new Error('metrics unavailable'));

    clock.tick(NETWORK_TELEMETRY_INTERVAL_MS);
    await Promise.resolve();

    assert.calledOnceWithExactly(
      warn,
      'metrics: failed to submit network request summary telemetry'
    );
  });

  [
    {
      name: 'the metrics service',
      options: {service: 'metrics'},
    },
    {
      name: 'the legacy metrics API option',
      options: {api: 'metrics'},
    },
    {
      name: 'the unified telemetry service',
      options: {service: 'unifiedTelemetry'},
    },
  ].forEach(function addExclusionTest({name, options}) {
    it(`does not track ${name}`, function () {
      assert.isFalse(shouldTrackNetworkRequest(options));
    });
  });

  [
    {
      description: 'AbortError as aborted',
      reason: {name: 'AbortError'},
      errorType: 'aborted',
    },
    {
      description: 'HTTP 408 as timeout',
      reason: {name: 'RequestTimeout', statusCode: 408},
      errorType: 'timeout',
    },
    {
      description: 'a wrapped ETIMEDOUT transport error as timeout',
      reason: {
        name: 'NetworkOrCORSError',
        statusCode: 0,
        body: {code: 'ETIMEDOUT'},
      },
      errorType: 'timeout',
    },
    {
      description: 'elapsed request timeout metadata as timeout',
      options: {
        service: 'hydra',
        timeout: 300,
        $timings: {networkStart: 100, networkEnd: 400},
      },
      reason: {name: 'NetworkOrCORSError', statusCode: 0},
      errorType: 'timeout',
    },
    {
      description: 'HTTP 429 as rate_limited',
      reason: {statusCode: 429},
      errorType: 'rate_limited',
    },
    {
      description: 'HTTP 404 as client_error',
      reason: {statusCode: 404},
      errorType: 'client_error',
    },
    {
      description: 'HTTP 502 as server_error',
      reason: {statusCode: 502},
      errorType: 'server_error',
    },
    {
      description: 'a status-zero transport failure as network_error',
      reason: {name: 'NetworkOrCORSError', statusCode: 0},
      errorType: 'network_error',
    },
  ].forEach(function addErrorTypeTest({
    description,
    options = {service: 'hydra'},
    reason,
    errorType,
  }) {
    it(`classifies ${description}`, function () {
      const errorMetric = createNetworkErrorMetric(options, reason);

      assert.equal(errorMetric.errorType, errorType);
    });
  });

  it('uses a sanitized URI host and endpoint for direct-URI requests', function () {
    const errorMetric = createNetworkErrorMetric(
      {
        method: 'CUSTOM',
        uri: 'https://user:password@customer.example.test/v1/rooms/65f81b6e-19dc-4a99-9175-59e9b34a5d42?secret=true#private',
      },
      {}
    );

    assert.equal(errorMetric.host, 'customer.example.test');
    assert.equal(errorMetric.endPoint, 'v1/rooms/:id');
    assert.equal(errorMetric.method, 'CUSTOM');
  });

  it('uses a string response body as the error message', function () {
    const errorMetric = createNetworkErrorMetric(
      {service: 'hydra'},
      {body: 'The service is unavailable'}
    );

    assert.equal(errorMetric.errorMessage, 'The service is unavailable');
  });

  it('redacts identifiers and query parameters from resource endpoints', function () {
    assert.equal(
      getOperation('v1/rooms/65f81b6e-19dc-4a99-9175-59e9b34a5d42/messages?personId=secret'),
      'v1/rooms/:id/messages'
    );
    assert.equal(getOperation('search/orgid/12345/entities'), 'search/orgid/:id/entities');
    assert.equal(getOperation('reports/a%2Fb/download'), 'reports/:id/download');
  });
});
