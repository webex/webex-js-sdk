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
   * @param {string} preLoginId The pre-login ID to be saved.
   * @returns {void}
   */
  savePreLoginId(preLoginId) {
    this.preLoginId = preLoginId;
  },

  /**
   * Prepare item
   * @param {any} item
   * @returns {Promise<any>}
   */
  prepareItem(item) {
    return Promise.resolve(prepareDiagnosticMetricItem(this.webex, item));
  },

  /**
   * Prepare request, add time sensitive date etc.
   * @param {any[]} queue
   * @returns {Promise<any[]>}
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
   * @param {any} payload
   * @returns {Promise<any>}
   */
  submitHttpRequest(payload: any) {
    const batchId = uniqueId('prelogin-batch-');
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

        this.handleHttpResponseStatus(res?.statusCode, payload);

        return res;
      })
      .catch((err) => {
        this.webex.logger.error(
          PRE_LOGIN_METRICS_IDENTIFIER,
          `PreLoginMetricsBatcher: @submitHttpRequest#${batchId}. Request failed:`,
          `error: ${generateCommonErrorMetadata(err)}`
        );

        this.handleHttpResponseStatus(err?.statusCode, payload);

        return Promise.reject(err);
      });
  },

  /**
   * React to the HTTP status code returned by the prelogin metrics endpoint.
   * Only items submitted with `markTelemetryOptOutOnResponse: true` opt into
   * this behavior.
   * @param {number | undefined} statusCode
   * @param {any[]} payload Items flushed in this HTTP batch.
   * @returns {void}
   */
  handleHttpResponseStatus(statusCode: number | undefined, payload: any[]) {
    const shouldMark =
      Array.isArray(payload) &&
      payload.some((item) => item?.markTelemetryOptOutOnResponse === true);

    if (!shouldMark) {
      return;
    }

    if (statusCode === 200) {
      this.webex.internal.newMetrics?.callDiagnosticMetrics?.setIsTelemetryOptOutAutomatic(true);
    }
  },
});

export default PreLoginMetricsBatcher;
