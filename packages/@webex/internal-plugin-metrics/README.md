# @webex/internal-plugin-metrics

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the Metrics service

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Unhandled exception telemetry](#unhandled-exception-telemetry)
- [Network request telemetry](#network-request-telemetry)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-metrics
```

## Usage

```js
import '@webex/internal-plugin-metrics';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
webex.internal.metrics.WHATEVER;
```

## Unhandled exception telemetry

Unhandled exception telemetry is currently supported only in browser environments. It starts after
the Webex SDK emits `ready`. It does not install a standalone collector, capture errors before SDK
initialization, persist events, or retry failed telemetry submissions.

The reporter captures uncaught errors, unhandled promise rejections, and resource load failures.
Matching failures captured in the same one-second in-memory window are submitted once with an
`occurrenceCount`. Non-HTTP(S) URLs are redacted; URL credentials, query parameters, and fragments
are stripped; and error names, messages, and stacks are truncated before submission.

Telemetry is disabled by default. Enable it with
`metrics.unhandledExceptionTelemetry.enabled: true`. Applications may provide a synchronous
`getMetadata` callback in the same configuration object. It must return an object whose fields can
include application context such as `orgId` and `dataCenter`. Metadata must not contain personally
identifiable information or credentials.

````js
import Webex from 'webex';

const webex = Webex.init({
  config: {
    metrics: {
      unhandledExceptionTelemetry: {
        enabled: true,
        getMetadata: () => ({
          orgId: 'your-organization-id',
          dataCenter: 'your-data-center',
        }),
      },
    },
  },
});
## Network request telemetry

Network request telemetry is disabled by default. Enable it with
`metrics.networkTelemetry.enabled: true`. When enabled, the metrics plugin summarizes requests
made through the Webex SDK request pipeline. It listens to the SDK-wide `request:start`,
`request:success`, and `request:failure` events, so individual plugins do not need to wrap or
replace `webex.request()`.

The listeners are installed once for each Webex instance when `webex.internal.metrics` is
constructed and the feature is enabled. The metrics package must be imported before constructing
the Webex instance. Standard Webex SDK bundles already import and register the metrics plugin.

### Scope

The collector counts request and response outcomes that pass through `webex.request()` and its interceptors. For failures, it also records aggregated error details covering:

- HTTP responses rejected by the SDK, such as `4xx` and `5xx` responses.
- Network or CORS failures where no HTTP response is available.
- Aborted and timed-out SDK requests when the error exposes that information.
- Request preparation failures that emit `request:failure`.

It does not monitor arbitrary application `fetch()`, `XMLHttpRequest`, WebSocket, or other traffic outside the SDK request pipeline. It also does not use `PerformanceObserver` or browser-wide request interception.

### Event flow

```text
webex.request()
  -> SDK request interceptors
  -> request:start(options)
  -> request:success(options, response) or request:failure(options, reason)
  -> metrics request outcome listeners
  -> aggregate host, endpoint, response, and error counts
  -> every ten minutes, submit JS_SDK_NETWORK_REQUEST_SUMMARY
````

The listeners and ten-minute accumulator are registered during metrics plugin initialization:

```js
initialize(...args) {
  WebexPlugin.prototype.initialize.call(this, ...args);
  if (this.webex.config.metrics.networkTelemetry.enabled !== true) {
    return;
  }
  this.networkTelemetry = createNetworkTelemetryCollector(/* submission callbacks */);
  this.listenTo(this.webex, 'request:start', this.recordNetworkRequestStart);
  this.listenTo(this.webex, 'request:success', this.recordNetworkRequestSuccess);
  this.listenTo(this.webex, 'request:failure', this.recordNetworkRequestFailure);
}
```

When the metrics plugin is stopped, any non-empty partial window is submitted once before the
collector is disposed. Empty windows are not submitted during shutdown.

### Metric schema

One operational client metric named `JS_SDK_NETWORK_REQUEST_SUMMARY` is submitted every ten minutes. Its `eventPayload` has this shape:

```ts
type NetworkTelemetry = {
  metricsSummary: {
    totalSendRequest: number;
    totalFailedRequest: number;
    totalRecvdResponse: number;
    totalFailedResponse: number;
  };
  metrics: Array<{
    host: string;
    endPoint: string;
    countSendRequest: number;
    countFailedRequest: number;
    countRecvdResponse: number;
    countFailedResponse: number;
    averageNetworkDurationMs: number;
    maxNetworkDurationP90Ms: number;
    maxNetworkDurationP99Ms: number;
  }>;
  errorMetrics: Array<{
    host: string;
    endPoint: string;
    statusCode: number;
    errorCode: string;
    method: string;
    errorType: string;
    errorMessage: string;
    trackingIds: string[];
    countError: number;
  }>;
  errorMetricsSummary: Record<string, {count: number}>;
};
```

The SDK adds application metadata to the outer client metric when it wraps this `eventPayload`:

| Property             | Source                                                                      |
| -------------------- | --------------------------------------------------------------------------- |
| `tags.app_name`      | `webex.config.appName`, or `unknown`                                        |
| `tags.app_version`   | `webex.config.appVersion`, or `unknown`                                     |
| `tags.app_url`       | Browser origin without path/query data, hostname fallback, or `non-browser` |
| `fields.sdk_version` | `webex.version`                                                             |

Counter mapping:

| Event or outcome                                    | Summary and endpoint counters                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `request:start`                                     | `totalSendRequest`, `countSendRequest`                                      |
| `request:success`                                   | `totalRecvdResponse`, `countRecvdResponse`                                  |
| `request:failure` without an HTTP response          | `totalFailedRequest`, `countFailedRequest`                                  |
| `request:failure` with an HTTP status (`4xx`/`5xx`) | Received-response counters plus `totalFailedResponse`/`countFailedResponse` |

The `metrics` array is grouped by `host` and `endPoint`. For service-based SDK requests, `host` is the normalized logical service name. Direct-URI requests use the URI host. `endPoint` is a sanitized resource or URI path. `averageNetworkDurationMs` is the average measured network duration for completed requests in the group, while `maxNetworkDurationP90Ms` and `maxNetworkDurationP99Ms` are the maximum durations at the nearest-rank 90th and 99th percentiles. All values are in milliseconds.

The `errorMetrics` array groups identical failures by host, endpoint, status code, error code, method, error type, and error message. `countError` records the number of occurrences, while `trackingIds` retains at most ten unique identifiers. `errorMetricsSummary` counts errors by status code; status `0` means no HTTP response was available.

Example:

```js
{
  metricName: 'JS_SDK_NETWORK_REQUEST_SUMMARY',
  type: 'operational',
  fields: {
    totalSendRequest: 14,
    totalFailedRequest: 1,
    totalRecvdResponse: 13,
    totalFailedResponse: 1
  },
  eventPayload: {
    metricsSummary: {
      totalSendRequest: 14,
      totalFailedRequest: 1,
      totalRecvdResponse: 13,
      totalFailedResponse: 1
    },
    metrics: [{
      host: 'hydra',
      endPoint: 'rooms/:id/messages',
      countSendRequest: 2,
      countFailedRequest: 0,
      countRecvdResponse: 2,
      countFailedResponse: 1,
      averageNetworkDurationMs: 410,
      maxNetworkDurationP90Ms: 510,
      maxNetworkDurationP99Ms: 640
    }],
    errorMetrics: [{
      host: 'hydra',
      endPoint: 'rooms/:id/messages',
      statusCode: 503,
      errorCode: 'SERVICE_UNAVAILABLE',
      method: 'POST',
      errorType: 'server_error',
      errorMessage: 'Service unavailable',
      trackingIds: ['example-tracking-id'],
      countError: 1
    }],
    errorMetricsSummary: {
      503: {count: 1}
    }
  }
}
```

### Failure classification

Classification is evaluated in the following order:

| Condition                                                                                                 | `errorType`     |
| --------------------------------------------------------------------------------------------------------- | --------------- |
| Error name is `AbortError`                                                                                | `aborted`       |
| Status is `408` or `504`, timeout appears in the error details, or the configured request timeout elapsed | `timeout`       |
| Status is `429`                                                                                           | `rate_limited`  |
| Status is `5xx`                                                                                           | `server_error`  |
| Status is `4xx`                                                                                           | `client_error`  |
| No response status is available, or the error name contains `network`                                     | `network_error` |
| Any other SDK request failure                                                                             | `request_error` |

### Telemetry request exclusion

Requests to the `metrics` and `unifiedTelemetry` services are excluded from both success and failure collection. The exclusion also covers the legacy `api: 'metrics'` request option. This prevents a telemetry upload from affecting its own summary.

The exclusion is centralized in the collector; telemetry request call sites do not require special flags.

### Endpoint normalization and cardinality

The `endPoint` value is derived from `options.resource`, or from the URI path for a direct-URI request:

- Query parameters and fragments are removed.
- Numeric, percent-encoded, uppercase, and otherwise non-route-looking segments are replaced with `:id`.

For example:

```text
rooms/Y2lzY29zcGFyazovL3VzL1JPT00/messages?personId=secret
```

becomes:

```text
rooms/:id/messages
```

Endpoint normalization is heuristic. A short lowercase alphabetic identifier can resemble a static route segment. Do not place sensitive values directly in a resource path; use normal SDK resource identifiers and avoid embedding credentials or personal data in route names. Error messages are included because they are part of the requested error aggregate schema; callers should not put credentials or personal data in thrown error messages.

### Submission behavior

Each ten-minute summary uses the existing `submitClientMetrics()` batching and transport path. The accumulator resets at the reporting boundary before asynchronous submission, so requests received while a summary is being sent belong to the next window. A telemetry submission failure is caught and logged.

### Tests

Run the focused unit tests with Node.js 22.14:

```bash
nvm use 22.14
yarn workspace @webex/internal-plugin-metrics test:unit --targets network-telemetry.ts
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
