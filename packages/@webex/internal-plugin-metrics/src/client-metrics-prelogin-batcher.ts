import PreLoginMetricsBatcher from './prelogin-metrics-batcher';

/**
 * ClientMetricsPreloginBatcher class for handling client metrics pre-login request batching
 * @class
 * @extends PreLoginMetricsBatcher
 */
class ClientMetricsPreloginBatcher extends PreLoginMetricsBatcher {
  namespace = 'Metrics';

  /**
   * Prepare item
   * @param {any} item - The item to prepare
   * @returns {Promise<any>} Promise resolving to the prepared item
   */
  prepareItem(item: any): Promise<any> {
    // Add more defaults to payload when the clientmetrics endpoint evolves to support richer payloads
    return Promise.resolve(item);
  }

  /**
   * Prepare request, add time sensitive date etc.
   * @param {any[]} queue - Array of items to prepare
   * @returns {Promise<any[]>} Promise resolving to the prepared request
   */
  prepareRequest(queue: any[]): Promise<any[]> {
    return Promise.resolve(queue);
  }
}

export default ClientMetricsPreloginBatcher;
