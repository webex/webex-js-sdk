/* eslint-disable default-param-last */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';
import {BrowserDetection} from '@webex/common';
import {OS_NAME, OSMap, CLIENT_NAME} from './config';

import Batcher from './batcher';
import ClientMetricsBatcher from './client-metrics-batcher';
import CallDiagnosticEventsBatcher from './call-diagnostic-events-batcher';

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
    callDiagnosticEventsBatcher: CallDiagnosticEventsBatcher,
  },

  namespace: 'Metrics',

  submit(key, value) {
    return this.batcher.request({key, ...value});
  },

  /**
   * This corresponds to #sendSemiStructured() in the deprecated metrics handler
   * @param {string} eventName
   * @param {Object} props
   * @param {string} preLoginId
   * @returns {Object} HttpResponse object
   */
  submitClientMetrics(eventName, props = {}, preLoginId) {
    if (!eventName) {
      throw Error('Missing behavioral metric name. Please provide one');
    }
    const payload = {metricName: eventName};

    payload.tags = {
      ...props.tags,
      browser: getBrowserName(),
      os: getOSNameInternal(),

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

    if (preLoginId) {
      const _payload = {
        metrics: [payload],
      };

      // Do not batch these because pre-login events occur during onboarding, so we will be partially blind
      // to users' progress through the reg flow if we wait to persist pre-login metrics for people who drop off because
      // their metrics will not post from a queue flush in time
      return this.postPreLoginMetric(_payload, preLoginId);
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

  postPreLoginMetric(payload, preLoginId) {
    return this.webex.credentials.getClientToken().then((token) =>
      this.request({
        method: 'POST',
        api: 'metrics',
        resource: 'clientmetrics-prelogin',
        headers: {
          authorization: token.toString(),
          'x-prelogin-userid': preLoginId,
        },
        body: payload,
      })
    );
  },

  submitCallDiagnosticEvents(payload) {
    const event = {
      type: 'diagnostic-event',
      eventPayload: payload,
    };

    return this.callDiagnosticEventsBatcher.request(event);
  },
});

export default Metrics;
