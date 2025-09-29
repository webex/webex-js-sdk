import {uniqueId} from 'lodash';
import {Batcher} from '@webex/webex-core';
import {prepareDiagnosticMetricItem} from './call-diagnostic/call-diagnostic-metrics.util';
import {generateCommonErrorMetadata} from './utils';

const PRE_LOGIN_METRICS_IDENTIFIER = 'Pre Login Metrics -->';

/**
 * PreLoginMetricsBatcher class for handling pre-login metrics request batching
 * @class
 * @extends Batcher
 */
class PreLoginMetricsBatcher extends Batcher {
  namespace = 'Metrics';
  preLoginId: string | undefined = undefined;
  webex: any;
  // eslint-disable-next-line no-useless-constructor
  constructor(attrs, options) {
    super(attrs, options);
  }

  /**
   * Save the pre-login ID.
   * @param {string} preLoginId The pre-login ID to be saved.
   * @returns {void}
   */
  savePreLoginId(preLoginId: string): void {
    this.preLoginId = preLoginId;
  }

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
    const batchId = uniqueId('prelogin-batch-');
    if (this.preLoginId === undefined) {
      this.webex.logger.error(
        PRE_LOGIN_METRICS_IDENTIFIER,
        `PreLoginMetricsBatcher: @request#${batchId}. PreLoginId is not set.`
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
      .then((res: any) => {
        this.webex.logger.log(
          PRE_LOGIN_METRICS_IDENTIFIER,
          `PreLoginMetricsBatcher: @request#${batchId}. Request successful.`
        );

        return res;
      })
      .catch((err: any) => {
        this.webex.logger.error(
          PRE_LOGIN_METRICS_IDENTIFIER,
          `PreLoginMetricsBatcher: @request#${batchId}. Request failed:`,
          `error: ${generateCommonErrorMetadata(err)}`
        );

        return Promise.reject(err);
      });
  }
}

export default PreLoginMetricsBatcher;
