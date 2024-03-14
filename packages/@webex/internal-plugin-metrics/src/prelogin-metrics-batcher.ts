/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import {uniqueId} from 'lodash';
import Batcher from './batcher';
import {prepareDiagnosticMetricItem} from './call-diagnostic/call-diagnostic-metrics.util';
import {generateCommonErrorMetadata} from './utils';

const PRE_LOGIN_METRICS_IDENTIFIER = 'Pre Login Metrics -->';

const PreLoginMetricsBatcher = Batcher.extend({
  namespace: 'Metrics',
  preLoginId: undefined,

  /**
   * Save the pre-login ID.
   * @param preLoginId The pre-login ID to be saved.
   */
  savePreLoginId(preLoginId: string) {
    this.preLoginId = preLoginId;
  },

  /**
   * Prepare item
   * @param item
   * @returns
   */
  prepareItem(item) {
    return Promise.resolve(prepareDiagnosticMetricItem(this.webex, item));
  },

  /**
   * Prepare request, add time sensitive date etc.
   * @param queue
   * @returns
   */
  prepareRequest(queue) {
    // Add sent timestamp
    queue.forEach((item) => {
      item.eventPayload.originTime = item.eventPayload.originTime || {};
      item.eventPayload.originTime.sent = new Date().toISOString();
    });

    return Promise.resolve(queue);
  },

  /**
   *
   * @param payload
   * @returns
   */
  submitHttpRequest(payload: any) {
    const batchId = uniqueId('prelogin-ca-batch-');
    if (this.preLoginId === undefined) {
      this.webex.logger.error(
        PRE_LOGIN_METRICS_IDENTIFIER,
        `PreLoginMetricsBatcher: @submitHttpRequest#${batchId}. PreLoginId is not set.`
      );

      return Promise.reject(new Error('PreLoginId is not set.'));
    }

    return this.webex
      .request({
        method: 'POST',
        service: 'metrics',
        resource: 'clientmetrics-prelogin',
        headers: {
          authorization: false,
          'x-prelogin-userid': this.preLoginId,
        },
        body: {
          metrics: payload,
        },
        waitForServiceTimeout: this.webex.config.metrics.waitForServiceTimeout,
      })
      .then((res) => {
        this.webex.logger.log(
          PRE_LOGIN_METRICS_IDENTIFIER,
          `PreLoginMetricsBatcher: @submitHttpRequest#${batchId}. Request successful.`
        );

        return res;
      })
      .catch((err) => {
        this.webex.logger.error(
          PRE_LOGIN_METRICS_IDENTIFIER,
          `PreLoginMetricsBatcher: @submitHttpRequest#${batchId}. Request failed:`,
          `error: ${generateCommonErrorMetadata(err)}`
        );

        return Promise.reject(err);
      });
  },
});

export default PreLoginMetricsBatcher;
