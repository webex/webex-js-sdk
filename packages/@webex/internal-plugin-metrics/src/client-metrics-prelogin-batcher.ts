import PreLoginMetricsBatcher from './prelogin-metrics-batcher';

const ClientMetricsPreloginBatcher = PreLoginMetricsBatcher.extend({
  namespace: 'Metrics',

  /**
   * Prepare item
   * @param {any} item
   * @returns {Promise<any>}
   */
  prepareItem(item) {
    // Add more defaults to payload when the clientmetrics endpoint evolves to support richer payloads
    return Promise.resolve(item);
  },

  /**
   * Prepare request, add time sensitive date etc.
   * @param {any[]} queue
   * @returns {Promise<any[]>}
   */
  prepareRequest(queue) {
    return Promise.resolve(queue);
  },
});

export default ClientMetricsPreloginBatcher;
