/* eslint-disable default-param-last */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';
import {BrowserDetection} from '@webex/common';
import {OS_NAME, OSMap, CLIENT_NAME} from './config';

import Batcher from './batcher';
import ClientMetricsBatcher from './client-metrics-batcher';
import ClientMetricsPreloginBatcher from './client-metrics-prelogin-batcher';

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

    payload.tags = {
      ...props.tags,
      browser: getBrowserName(),
      os: getOSNameInternal(),
      appVersion: providedClientVersion,

      // Node does not like this so we need to check if it exists or not
      // eslint-disable-next-line no-undef
      domain:
        typeof window !== 'undefined' ? window.location.hostname || 'non-browser' : 'non-browser', // Check what else we could measure
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
    return Promise.resolve();
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
