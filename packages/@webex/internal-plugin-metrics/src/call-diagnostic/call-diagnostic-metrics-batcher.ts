/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import {uniqueId} from 'lodash';
import Batcher from '../batcher';
import {prepareDiagnosticMetricItem} from './call-diagnostic-metrics.util';
import {CALL_DIAGNOSTIC_LOG_IDENTIFIER} from './config';
import {generateCommonErrorMetadata} from '../utils';

const CallDiagnosticEventsBatcher = Batcher.extend({
  namespace: 'Metrics',

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
  submitHttpRequest(payload) {
    const batchId = uniqueId('call-diagnostic-metrics-batch-');
    this.webex.logger.log(
      CALL_DIAGNOSTIC_LOG_IDENTIFIER,
      `CallDiagnosticEventsBatcher: @submitHttpRequest#${batchId}. Sending the request:`,
      'payload:',
      payload
    );

    return this.webex
      .request({
        method: 'POST',
        service: 'metrics',
        resource: 'clientmetrics',
        body: {
          metrics: payload,
        },
      })
      .then((res) => {
        this.webex.logger.log(
          CALL_DIAGNOSTIC_LOG_IDENTIFIER,
          `CallDiagnosticEventsBatcher: @submitHttpRequest#${batchId}. Request successful:`,
          `response:`,
          res
        );

        return res;
      })
      .catch((err) => {
        this.webex.logger.error(
          CALL_DIAGNOSTIC_LOG_IDENTIFIER,
          `CallDiagnosticEventsBatcher: @submitHttpRequest#${batchId}. Request failed:`,
          `error: ${generateCommonErrorMetadata(err)}`
        );

        return Promise.reject(err);
      });
  },
});

export default CallDiagnosticEventsBatcher;
