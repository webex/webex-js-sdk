import {uniqueId} from 'lodash';
import Batcher from '../batcher';
import {prepareDiagnosticMetricItem} from './call-diagnostic-metrics.util';
import {CALL_DIAGNOSTIC_LOG_IDENTIFIER} from './config';
import {generateCommonErrorMetadata} from '../utils';

const CallDiagnosticEventsBatcher = Batcher.extend({
  namespace: 'Metrics',

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
  submitHttpRequest(payload) {
    const batchId = uniqueId('ca-batch-');

    return this.webex
      .request({
        method: 'POST',
        service: 'metrics',
        resource: 'clientmetrics',
        body: {
          metrics: payload,
        },
        waitForServiceTimeout: this.webex.config.metrics.waitForServiceTimeout,
      })
      .then((res) => {
        this.webex.logger.log(
          CALL_DIAGNOSTIC_LOG_IDENTIFIER,
          `CallDiagnosticEventsBatcher: @submitHttpRequest#${batchId}. Request successful.`
        );

        this.handleHttpResponseStatus(res?.statusCode, payload);

        return res;
      })
      .catch((err) => {
        this.webex.logger.error(
          CALL_DIAGNOSTIC_LOG_IDENTIFIER,
          `CallDiagnosticEventsBatcher: @submitHttpRequest#${batchId}. Request failed:`,
          `error: ${generateCommonErrorMetadata(err)}`
        );

        this.handleHttpResponseStatus(err?.statusCode, payload);

        return Promise.reject(err);
      });
  },

  /**
   * React to the HTTP status code returned by the metrics endpoint.
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

export default CallDiagnosticEventsBatcher;
