// TypeScript signatures own the types; JSDoc contains descriptions only.
/* eslint valid-jsdoc: ["error", {"requireParamType": false, "requireReturnType": false}] */

import {safeSetInterval} from '@webex/common-timers';

export const NETWORK_REQUEST_SUMMARY_METRIC = 'JS_SDK_NETWORK_REQUEST_SUMMARY';
export const NETWORK_TELEMETRY_INTERVAL_MS = 10 * 60 * 1_000;

// Only segments that follow the SDK's static route naming convention are kept.
// Numeric, mixed-case, encoded, and otherwise dynamic-looking values are redacted.
// Lowercase alphabetic identifiers remain ambiguous because requests do not provide route templates.
// Examples: `rooms/12345/messages` becomes `rooms/:id/messages`, and
// `v1/rooms/65f81b6e-19dc-4a99-9175-59e9b34a5d42` becomes `v1/rooms/:id`.
// `reports/a%2Fb/download` becomes `reports/:id/download`; `rooms`, `meeting-info`, and `v1` stay unchanged.
const SAFE_ROUTE_SEGMENT = /^(?:[a-z]+(?:-[a-z]+)*|v[1-9]\d?)$/;
const MAX_TRACKING_IDS = 10;
const UNKNOWN = 'unknown';

type Headers = Record<string, unknown>;

type MetricsSummary = {
  totalSendRequest: number;
  totalFailedRequest: number;
  totalRecvdResponse: number;
  totalFailedResponse: number;
};

type RequestMetric = {
  host: string;
  endPoint: string;
  countSendRequest: number;
  countFailedRequest: number;
  countRecvdResponse: number;
  countFailedResponse: number;
  averageNetworkDurationMs: number;
  maxNetworkDurationP90Ms: number;
  maxNetworkDurationP99Ms: number;
};

type RequestIdentity = Pick<RequestMetric, 'host' | 'endPoint'>;

export type NetworkErrorMetric = {
  host: string;
  endPoint: string;
  statusCode: number;
  errorCode: string;
  method: string;
  errorType: string;
  errorMessage: string;
  trackingIds: string[];
  countError: number;
};

export type NetworkTelemetry = {
  metricsSummary: MetricsSummary;
  metrics: RequestMetric[];
  errorMetrics: NetworkErrorMetric[];
  errorMetricsSummary: Record<string, {count: number}>;
};

type RequestMetricState = Omit<
  RequestMetric,
  'averageNetworkDurationMs' | 'maxNetworkDurationP90Ms' | 'maxNetworkDurationP99Ms'
> & {
  totalNetworkDurationMs: number;
  networkDurationsMs: number[];
};

type NetworkTelemetryState = Omit<NetworkTelemetry, 'metrics'> & {
  metrics: RequestMetricState[];
};

type ErrorDetails = {
  code?: number | string;
  errorCode?: number | string;
  message?: string;
  name?: string;
};

// Request events come from JavaScript in webex-core and have no shared TypeScript
// contract. This local type intentionally contains only fields used by telemetry.
type RequestOptions = {
  api?: string;
  headers?: Headers;
  method?: string;
  resource?: string;
  service?: string;
  timeout?: number;
  uri?: string;
  url?: string;
  // The network timing interceptor adds internal fields with a `$` prefix.
  $timings?: {
    networkEnd?: number;
    networkStart?: number;
  };
};

type RequestFailure = ErrorDetails & {
  body?: ErrorDetails | string;
  status?: number;
  statusCode?: number;
};

type NetworkMetricProperties = {
  type: 'operational';
  tags: Record<string, string>;
  fields: MetricsSummary;
  eventPayload: NetworkTelemetry;
};

type NetworkTelemetryCollectorOptions = {
  onSubmissionFailure: () => void;
  submitMetric: (name: string, properties: NetworkMetricProperties) => unknown;
};

type NetworkTelemetryCollector = {
  recordRequest: (options?: RequestOptions) => void;
  recordResponse: (options?: RequestOptions) => void;
  recordFailure: (options?: RequestOptions, reason?: RequestFailure) => void;
  stop: () => void;
};

/**
 * Converts a non-empty string or number to a string.
 * @param value Value to convert.
 * @returns The converted string, or undefined for unsupported values.
 */
function toString(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return String(value);
  }

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Returns the normalized SDK service name.
 * @param options Request options containing the service or API name.
 * @returns The normalized service name.
 */
function getService(options: RequestOptions): string {
  const service = options.service || options.api;

  return typeof service === 'string' ? service.trim().toLowerCase() : '';
}

/**
 * Replaces values that may be resource identifiers with a stable placeholder.
 * @param segment Endpoint path segment.
 * @returns The original static segment or the identifier placeholder.
 */
function normalizeRouteSegment(segment: string): string {
  return SAFE_ROUTE_SEGMENT.test(segment) ? segment : ':id';
}

/**
 * Removes query data and redacts dynamic-looking endpoint segments.
 * @param resource SDK resource path.
 * @returns The normalized endpoint.
 */
export function getOperation(resource?: string): string {
  if (typeof resource !== 'string' || resource.length === 0) {
    return UNKNOWN;
  }

  const path = resource.split(/[?#]/, 1)[0];
  const segments = path.split('/').filter(Boolean).map(normalizeRouteSegment);

  return segments.length > 0 ? segments.join('/') : 'root';
}

/**
 * Extracts only the direct URL parts allowed in telemetry. URL credentials,
 * query parameters, and fragments are not returned, while the pathname is
 * converted to a sanitized endpoint.
 * @param options Request options containing a direct URL.
 * @returns The sanitized request identity, or undefined without a valid URL.
 */
function getDirectRequestIdentity(options: RequestOptions): RequestIdentity | undefined {
  const value = options.uri || options.url;

  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const requestUrl = new URL(value);

    return {
      host: requestUrl.host.toLowerCase() || UNKNOWN,
      endPoint: getOperation(requestUrl.pathname),
    };
  } catch {
    return undefined;
  }
}

/**
 * Uses the logical service as the host because request:start may run before the
 * service interceptor resolves a physical URL. Direct-URL requests use URL.host.
 * @param options Request options used to resolve the identity.
 * @returns The request host and endpoint.
 */
function getRequestIdentity(options: RequestOptions): RequestIdentity {
  const directRequestIdentity = getDirectRequestIdentity(options);
  const service = getService(options);

  return {
    host: service || directRequestIdentity?.host || UNKNOWN,
    endPoint: options.resource
      ? getOperation(options.resource)
      : directRequestIdentity?.endPoint || UNKNOWN,
  };
}

/**
 * Returns the measured network duration when both timing points are valid.
 * @param options Request options containing network timing metadata.
 * @returns The duration in milliseconds, or undefined when timing is unavailable.
 */
function getNetworkDuration(options: RequestOptions): number | undefined {
  const start = options.$timings?.networkStart;
  const end = options.$timings?.networkEnd;

  return typeof start === 'number' &&
    Number.isFinite(start) &&
    typeof end === 'number' &&
    Number.isFinite(end) &&
    end >= start
    ? end - start
    : undefined;
}

/**
 * Adds a completed request's network duration to its endpoint aggregate.
 * @param metric Endpoint aggregate to update.
 * @param options Request options containing network timing metadata.
 * @returns Nothing.
 */
function recordNetworkDuration(metric: RequestMetricState, options: RequestOptions): void {
  const duration = getNetworkDuration(options);

  if (duration === undefined) {
    return;
  }

  metric.totalNetworkDurationMs += duration;
  metric.networkDurationsMs.push(duration);
}

/**
 * Returns a normalized uppercase HTTP method.
 * @param method HTTP method from the request options.
 * @returns The normalized method.
 */
function getMethod(method?: string): string {
  return typeof method === 'string' && method.length > 0 ? method.toUpperCase() : 'UNKNOWN';
}

/**
 * Status zero represents a failure for which no valid HTTP response was received.
 * @param reason Request failure.
 * @returns A valid HTTP status code, or zero when no response was received.
 */
function getStatusCode(reason: RequestFailure): number {
  const statusCode = reason.statusCode ?? reason.status;

  return typeof statusCode === 'number' &&
    Number.isInteger(statusCode) &&
    statusCode >= 100 &&
    statusCode <= 599
    ? statusCode
    : 0;
}

/**
 * Returns an error nested in a Webex HTTP error body.
 * @param reason Request failure.
 * @returns The wrapped error, when present.
 */
function getWrappedError(reason: RequestFailure): ErrorDetails | undefined {
  return reason.body && typeof reason.body === 'object' ? reason.body : undefined;
}

/**
 * Checks the timeout forms emitted by browser and Node transports.
 * @param value Possible timeout signal.
 * @returns Whether the value represents a timeout.
 */
function isTimeoutSignal(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const signal = value.toLowerCase();

  return signal.includes('timeout') || signal === 'etimedout' || signal === 'esockettimedout';
}

/**
 * Detects direct errors, transport errors wrapped in body, and requests whose
 * measured network duration reached the configured timeout.
 * @param reason Request failure.
 * @param options Request options containing timeout metadata.
 * @returns Whether the request timed out.
 */
function isTimeoutFailure(reason: RequestFailure, options: RequestOptions): boolean {
  const wrappedError = getWrappedError(reason);

  if (
    isTimeoutSignal(reason.name) ||
    isTimeoutSignal(reason.code) ||
    isTimeoutSignal(reason.message) ||
    isTimeoutSignal(reason.body) ||
    isTimeoutSignal(wrappedError?.name) ||
    isTimeoutSignal(wrappedError?.code) ||
    isTimeoutSignal(wrappedError?.message)
  ) {
    return true;
  }

  const start = options.$timings?.networkStart;
  const end = options.$timings?.networkEnd;

  return (
    typeof options.timeout === 'number' &&
    options.timeout > 0 &&
    typeof start === 'number' &&
    typeof end === 'number' &&
    end >= start &&
    end - start >= options.timeout
  );
}

/**
 * Converts errors into a bounded set of categories for aggregation.
 * @param reason Request failure.
 * @param options Request options.
 * @param statusCode Normalized status code.
 * @returns The aggregate error category.
 */
function getErrorType(reason: RequestFailure, options: RequestOptions, statusCode: number): string {
  const name = typeof reason.name === 'string' ? reason.name.toLowerCase() : '';

  if (name === 'aborterror') {
    return 'aborted';
  }

  if (statusCode === 408 || statusCode === 504 || isTimeoutFailure(reason, options)) {
    return 'timeout';
  }

  if (statusCode === 429) {
    return 'rate_limited';
  }

  if (statusCode >= 500) {
    return 'server_error';
  }

  if (statusCode >= 400) {
    return 'client_error';
  }

  return statusCode === 0 || name?.includes('network') ? 'network_error' : 'request_error';
}

/**
 * Returns the most specific available error code.
 * @param reason Request failure.
 * @returns The error code or the unknown fallback.
 */
function getErrorCode(reason: RequestFailure): string {
  const wrappedError = getWrappedError(reason);

  return (
    toString(wrappedError?.errorCode) ||
    toString(wrappedError?.code) ||
    toString(reason.errorCode) ||
    toString(reason.code) ||
    UNKNOWN
  );
}

/**
 * Returns the most specific available error message.
 * @param reason Request failure.
 * @returns The error message or the unknown fallback.
 */
function getErrorMessage(reason: RequestFailure): string {
  const wrappedError = getWrappedError(reason);

  return (
    toString(wrappedError?.message) || toString(reason.body) || toString(reason.message) || UNKNOWN
  );
}

/**
 * Excludes the transports used to submit telemetry, preventing self-reporting.
 * @param options Request options.
 * @returns Whether the request should be tracked.
 */
export function shouldTrackNetworkRequest(options: RequestOptions = {}): boolean {
  const service = getService(options);

  return service !== 'metrics' && service !== 'unifiedtelemetry';
}

/**
 * Creates the error entry produced by one failed request.
 * @param options Request options.
 * @param reason Request failure.
 * @returns The normalized error metric.
 */
export function createNetworkErrorMetric(
  options: RequestOptions = {},
  reason: RequestFailure = {}
): NetworkErrorMetric {
  const identity = getRequestIdentity(options);
  const statusCode = getStatusCode(reason);
  // WebexTrackingIdInterceptor stores the request ID under this lowercase key.
  const trackingId = toString(options.headers?.trackingid);

  return {
    ...identity,
    statusCode,
    errorCode: getErrorCode(reason),
    method: getMethod(options.method),
    errorType: getErrorType(reason, options, statusCode),
    errorMessage: getErrorMessage(reason),
    trackingIds: trackingId ? [trackingId] : [],
    countError: 1,
  };
}

/**
 * Creates an empty ten-minute telemetry window.
 * @returns An empty telemetry aggregate.
 */
function createEmptyNetworkTelemetry(): NetworkTelemetryState {
  return {
    metricsSummary: {
      totalSendRequest: 0,
      totalFailedRequest: 0,
      totalRecvdResponse: 0,
      totalFailedResponse: 0,
    },
    metrics: [],
    errorMetrics: [],
    errorMetricsSummary: {},
  };
}

/**
 * Finds or creates the request counters for one host and endpoint.
 * @param telemetry Current telemetry aggregate.
 * @param options Request options.
 * @returns The matching endpoint counters.
 */
function getRequestMetric(
  telemetry: NetworkTelemetryState,
  options: RequestOptions
): RequestMetricState {
  const identity = getRequestIdentity(options);

  for (const metric of telemetry.metrics) {
    if (metric.host === identity.host && metric.endPoint === identity.endPoint) {
      return metric;
    }
  }

  const metric = {
    ...identity,
    countSendRequest: 0,
    countFailedRequest: 0,
    countRecvdResponse: 0,
    countFailedResponse: 0,
    totalNetworkDurationMs: 0,
    networkDurationsMs: [],
  };

  telemetry.metrics.push(metric);

  return metric;
}

/**
 * Error entries aggregate only when every identifying field matches.
 * @param first First error metric.
 * @param second Second error metric.
 * @returns Whether both errors belong to the same aggregate.
 */
function isSameError(first: NetworkErrorMetric, second: NetworkErrorMetric): boolean {
  return (
    first.host === second.host &&
    first.endPoint === second.endPoint &&
    first.statusCode === second.statusCode &&
    first.errorCode === second.errorCode &&
    first.method === second.method &&
    first.errorType === second.errorType &&
    first.errorMessage === second.errorMessage
  );
}

/**
 * Adds a failure to its error aggregate and retains at most ten unique IDs.
 * @param telemetry Current telemetry aggregate.
 * @param errorMetric Error metric to record.
 * @returns Nothing.
 */
function recordError(telemetry: NetworkTelemetryState, errorMetric: NetworkErrorMetric): void {
  for (const existingMetric of telemetry.errorMetrics) {
    if (isSameError(existingMetric, errorMetric)) {
      existingMetric.countError += 1;

      const trackingId = errorMetric.trackingIds[0];

      if (
        trackingId &&
        existingMetric.trackingIds.length < MAX_TRACKING_IDS &&
        !existingMetric.trackingIds.includes(trackingId)
      ) {
        existingMetric.trackingIds.push(trackingId);
      }

      return;
    }
  }

  telemetry.errorMetrics.push(errorMetric);
}

/**
 * Returns a nearest-rank percentile from the measured durations.
 * @param durations Measured network durations in milliseconds.
 * @param percentile Percentile to calculate, between zero and one.
 * @returns The percentile duration, or zero when no durations were measured.
 */
function getDurationPercentile(durations: number[], percentile: number): number {
  if (durations.length === 0) {
    return 0;
  }

  const sortedDurations = [...durations].sort((first, second) => first - second);
  const rank = Math.max(1, Math.ceil(sortedDurations.length * percentile));

  return sortedDurations[rank - 1];
}

/**
 * Converts internal duration samples into the public endpoint metric shape.
 * @param metric Internal endpoint aggregate.
 * @returns Endpoint aggregate with average and p90 duration statistics.
 */
function serializeRequestMetric(metric: RequestMetricState): RequestMetric {
  const measuredRequestCount = metric.networkDurationsMs.length;

  return {
    host: metric.host,
    endPoint: metric.endPoint,
    countSendRequest: metric.countSendRequest,
    countFailedRequest: metric.countFailedRequest,
    countRecvdResponse: metric.countRecvdResponse,
    countFailedResponse: metric.countFailedResponse,
    averageNetworkDurationMs:
      measuredRequestCount > 0 ? metric.totalNetworkDurationMs / measuredRequestCount : 0,
    maxNetworkDurationP90Ms: getDurationPercentile(metric.networkDurationsMs, 0.9),
    maxNetworkDurationP99Ms: getDurationPercentile(metric.networkDurationsMs, 0.99),
  };
}

/**
 * Converts the internal telemetry state into the submitted payload shape.
 * @param telemetry Internal telemetry aggregate.
 * @returns Telemetry payload with no internal duration samples.
 */
function serializeNetworkTelemetry(telemetry: NetworkTelemetryState): NetworkTelemetry {
  return {
    metricsSummary: telemetry.metricsSummary,
    metrics: telemetry.metrics.map(serializeRequestMetric),
    errorMetrics: telemetry.errorMetrics,
    errorMetricsSummary: telemetry.errorMetricsSummary,
  };
}

/**
 * Checks whether the current window contains anything worth flushing.
 * @param telemetry Current telemetry aggregate.
 * @returns Whether the aggregate contains request data.
 */
function hasNetworkTelemetry(telemetry: NetworkTelemetryState): boolean {
  return telemetry.metrics.length > 0 || telemetry.errorMetrics.length > 0;
}

/**
 * Creates a network telemetry collector and starts its ten-minute timer.
 * @param options Submission callbacks.
 * @returns The network telemetry collector.
 */
export function createNetworkTelemetryCollector({
  onSubmissionFailure,
  submitMetric,
}: NetworkTelemetryCollectorOptions): NetworkTelemetryCollector {
  let telemetry = createEmptyNetworkTelemetry();

  /**
   * Records a request being sent.
   * @param options Request options.
   * @returns Nothing.
   */
  function recordRequest(options: RequestOptions = {}): void {
    if (!shouldTrackNetworkRequest(options)) {
      return;
    }

    telemetry.metricsSummary.totalSendRequest += 1;
    getRequestMetric(telemetry, options).countSendRequest += 1;
  }

  /**
   * Records a successful response.
   * @param options Request options.
   * @returns Nothing.
   */
  function recordResponse(options: RequestOptions = {}): void {
    if (!shouldTrackNetworkRequest(options)) {
      return;
    }

    telemetry.metricsSummary.totalRecvdResponse += 1;
    const requestMetric = getRequestMetric(telemetry, options);
    requestMetric.countRecvdResponse += 1;
    recordNetworkDuration(requestMetric, options);
  }

  /**
   * A real HTTP status is a failed response. Status zero means the request
   * failed before the SDK received a valid HTTP response.
   * @param options Request options.
   * @param reason Request failure.
   * @returns Nothing.
   */
  function recordFailure(options: RequestOptions = {}, reason: RequestFailure = {}): void {
    if (!shouldTrackNetworkRequest(options)) {
      return;
    }

    const errorMetric = createNetworkErrorMetric(options, reason);
    const requestMetric = getRequestMetric(telemetry, options);
    recordNetworkDuration(requestMetric, options);

    if (errorMetric.statusCode === 0) {
      telemetry.metricsSummary.totalFailedRequest += 1;
      requestMetric.countFailedRequest += 1;
    } else {
      telemetry.metricsSummary.totalRecvdResponse += 1;
      telemetry.metricsSummary.totalFailedResponse += 1;
      requestMetric.countRecvdResponse += 1;
      requestMetric.countFailedResponse += 1;
    }

    recordError(telemetry, errorMetric);

    const statusCode = String(errorMetric.statusCode);
    const statusSummary = telemetry.errorMetricsSummary[statusCode];

    if (statusSummary) {
      statusSummary.count += 1;
    } else {
      telemetry.errorMetricsSummary[statusCode] = {count: 1};
    }
  }

  /**
   * Submits the completed window and starts collecting the next one.
   * @returns Nothing.
   */
  function submitSummary(): void {
    const completedTelemetry = telemetry;
    const payload = serializeNetworkTelemetry(completedTelemetry);

    // Reset before submission so requests emitted by the telemetry transport,
    // or while it is pending, cannot mutate the completed window.
    telemetry = createEmptyNetworkTelemetry();

    try {
      Promise.resolve(
        submitMetric(NETWORK_REQUEST_SUMMARY_METRIC, {
          type: 'operational',
          tags: {},
          fields: completedTelemetry.metricsSummary,
          eventPayload: payload,
        })
      ).catch(onSubmissionFailure);
    } catch {
      // submitMetric may throw before returning a promise.
      onSubmissionFailure();
    }
  }

  const telemetryInterval = safeSetInterval(submitSummary, NETWORK_TELEMETRY_INTERVAL_MS);

  /**
   * Stops periodic submission and releases data from the current window.
   * @returns Nothing.
   */
  function stop(): void {
    clearInterval(telemetryInterval);

    if (hasNetworkTelemetry(telemetry)) {
      submitSummary();
    }
  }

  return {recordRequest, recordResponse, recordFailure, stop};
}
