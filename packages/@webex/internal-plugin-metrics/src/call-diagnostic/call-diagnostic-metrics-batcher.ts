import {uniqueId} from 'lodash';
import Batcher from '../batcher';
import {prepareDiagnosticMetricItem} from './call-diagnostic-metrics.util';
import {CALL_DIAGNOSTIC_LOG_IDENTIFIER} from './config';
import {generateCommonErrorMetadata} from '../utils';

/**
 * CallDiagnosticEventsBatcher class for handling call diagnostic metrics request batching
 * @class
 * @extends Batcher
 */
class CallDiagnosticEventsBatcher extends Batcher {
  namespace = 'Metrics';
  webex: any;

  /**
   * Prepare item
   * @param {any} item - The item to prepare
   * @returns {Promise<any>} Promise resolving to the prepared item
   */
  prepareItem(item: any): Promise<any> {
    return Promise.resolve(prepareDiagnosticMetricItem(this.webex, item));
  }

  /**
   * Prepare request, add time sensitive date etc.
   * @param {any[]} queue - Array of items to prepare
   * @returns {Promise<any[]>} Promise resolving to the prepared request
   */
  prepareRequest(queue: any[]): Promise<any[]> {
    // Add sent timestamp
    queue.forEach((item) => {
      item.eventPayload.originTime = item.eventPayload.originTime || {};
      item.eventPayload.originTime.sent = new Date().toISOString();
    });

    return Promise.resolve(queue);
  }

  /**
   * Submit the HTTP request
   * @param {any} payload - The payload to submit
   * @returns {Promise<any>} Promise resolving to the HTTP response
   */
  request(payload: any): Promise<any> {
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
      .then((res: any) => {
        this.webex.logger.log(
          CALL_DIAGNOSTIC_LOG_IDENTIFIER,
          `CallDiagnosticEventsBatcher: @submitHttpRequest#${batchId}. Request successful.`
        );

        return res;
      })
      .catch((err: any) => {
        this.webex.logger.error(
          CALL_DIAGNOSTIC_LOG_IDENTIFIER,
          `CallDiagnosticEventsBatcher: @submitHttpRequest#${batchId}. Request failed:`,
          `error: ${generateCommonErrorMetadata(err)}`
        );

        return Promise.reject(err);
      });
  }
}

export default CallDiagnosticEventsBatcher;
