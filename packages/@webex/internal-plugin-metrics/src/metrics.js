/* eslint-disable default-param-last */
/* eslint-disable valid-jsdoc */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';
import {BrowserDetection} from '@webex/common';
import {OS_NAME, OSMap, CLIENT_NAME} from './config';

import Batcher from './batcher';
import ClientMetricsBatcher from './client-metrics-batcher';
import ClientMetricsPreloginBatcher from './client-metrics-prelogin-batcher';
import {createNetworkTelemetryCollector} from './network-telemetry';

const {getOSName, getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

export function getOSNameInternal() {
  return OSMap[getOSName()] ?? OS_NAME.OTHERS;
}

function getSparkUserAgent(webex) {
  const {appName, appVersion, appPlatform} = webex?.config ?? {};

  let sparkUserAgent = CLIENT_NAME;

  if (appName) {
    sparkUserAgent += ` ${appName}/${appVersion ?? '0.0'}`;
  }

  if (appPlatform) {
    sparkUserAgent += ` ${appPlatform}`;
  }

  return sparkUserAgent;
}

const Metrics = WebexPlugin.extend({
  children: {
    batcher: Batcher,
    clientMetricsBatcher: ClientMetricsBatcher,
    clientMetricsPreloginBatcher: ClientMetricsPreloginBatcher,
  },

  namespace: 'Metrics',

  /**
   * Registers SDK request outcome monitoring.
   * @param args
   * @returns
   */
  initialize(...args) {
    WebexPlugin.prototype.initialize.call(this, ...args);

    // Metrics may also be constructed as a standalone plugin. Request events are
    // available only when it is attached to a Webex instance.
    if (!this.parent && !this.collection) {
      return;
    }

    if (this.webex?.config?.metrics?.networkTelemetry?.enabled !== true) {
      return;
    }

    this.networkTelemetry = createNetworkTelemetryCollector({
      submitMetric: this.submitNetworkTelemetryMetric.bind(this),
      onSubmissionFailure: this.handleNetworkTelemetrySubmissionFailure.bind(this),
    });
    this.listenTo(this.webex, 'request:start', this.recordNetworkRequestStart);
    this.listenTo(this.webex, 'request:success', this.recordNetworkRequestSuccess);
    this.listenTo(this.webex, 'request:failure', this.recordNetworkRequestFailure);
  },

  /**
   * Records an SDK request being sent in the current reporting window.
   * @param options
   * @returns
   */
  recordNetworkRequestStart(options) {
    this.networkTelemetry.recordRequest(options);
  },

  /**
   * Records a successful SDK request for the current reporting window.
   * @param options
   * @returns
   */
  recordNetworkRequestSuccess(options) {
    this.networkTelemetry.recordResponse(options);
  },

  /**
   * Records a failed SDK request for the current reporting window.
   * @param options
   * @param reason
   * @returns
   */
  recordNetworkRequestFailure(options, reason) {
    this.networkTelemetry.recordFailure(options, reason);
  },

  /**
   * Submits a completed network telemetry window through client metrics.
   * @param name
   * @param properties
   * @returns
   */
  submitNetworkTelemetryMetric(name, properties) {
    return this.submitClientMetrics(name, properties);
  },

  /**
   * Logs a network telemetry submission failure without affecting SDK requests.
   * @returns
   */
  handleNetworkTelemetrySubmissionFailure() {
    this.webex.logger?.warn('metrics: failed to submit network request summary telemetry');
  },

  /**
   * Stops network telemetry collection and submission.
   * @returns
   */
  stopNetworkTelemetry() {
    if (!this.networkTelemetry) {
      return;
    }

    this.stopListening(this.webex, 'request:start', this.recordNetworkRequestStart);
    this.stopListening(this.webex, 'request:success', this.recordNetworkRequestSuccess);
    this.stopListening(this.webex, 'request:failure', this.recordNetworkRequestFailure);
    this.networkTelemetry.stop();
  },

  submit(key, value) {
    return this.batcher.request({key, ...value});
  },

  /**
   * Returns the payload for submitting client metrics.
   * @param {string} eventName
   * @param {any} props
   * @returns {any} - the payload
   */
  getClientMetricsPayload(eventName, props) {
    if (!eventName) {
      throw Error('Missing behavioral metric name. Please provide one');
    }
    const payload = {metricName: eventName};
    // @ts-ignore
    const providedClientVersion = this.webex.meetings?.config?.metrics?.clientVersion;
    const {appName, appVersion} = this.webex.config;
    // Browser location is unavailable when the SDK runs in Node.js.
    // eslint-disable-next-line no-undef
    const browserLocation = typeof window !== 'undefined' ? window.location : undefined;

    payload.tags = {
      ...props.tags,
      app_name: appName ?? 'unknown',
      app_url: browserLocation?.origin || browserLocation?.hostname || 'non-browser',
      app_version: appVersion ?? 'unknown',
      browser: getBrowserName(),
      os: getOSNameInternal(),
      appVersion: providedClientVersion,
      domain: browserLocation?.hostname || 'non-browser',
    };

    payload.fields = {
      ...props.fields,
      browser_version: getBrowserVersion(),
      os_version: getOSVersion(),
      sdk_version: this.webex.version,
      platform: 'Web',
      spark_user_agent: getSparkUserAgent(this.webex),
      client_id: this.webex.credentials.config.client_id,
    };

    payload.type = props.type || this.webex.config.metrics.type;

    payload.context = {
      ...props.context,
      app: {
        version: this.webex.version,
      },
      locale: 'en-US',
      os: {
        name: getOSNameInternal(),
        version: getOSVersion(),
      },
    };

    if (props.eventPayload) {
      payload.eventPayload = props.eventPayload;
    }

    // Mocking the time in tests when running in node
    // is impossible so unable to use Date.now()
    payload.timestamp = new Date().valueOf();

    return payload;
  },

  /**
   * This corresponds to #sendSemiStructured() in the deprecated metrics handler
   * @param {string} eventName
   * @param {Object} props
   * @param {string} preLoginId
   * @returns {Object} HttpResponse object
   */
  submitClientMetrics(eventName, props = {}, preLoginId) {
    const payload = this.getClientMetricsPayload(eventName, props);

    if (preLoginId) {
      this.clientMetricsPreloginBatcher.savePreLoginId(preLoginId);

      return this.clientMetricsPreloginBatcher.request(payload);
    }

    return this.clientMetricsBatcher.request(payload);
  },

  /**
   * Issue request to alias a user's pre-login ID with their CI UUID
   * @param {string} preLoginId
   * @returns {Object} HttpResponse object
   */
  aliasUser(preLoginId) {
    return this.request({
      method: 'POST',
      api: 'metrics',
      resource: 'clientmetrics',
      headers: {
        'x-prelogin-userid': preLoginId,
      },
      body: {},
      qs: {
        alias: true,
      },
    });
  },
});

export default Metrics;
