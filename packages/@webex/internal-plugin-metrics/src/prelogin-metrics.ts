import GenericMetrics from './generic-metrics';
import {EventPayload} from './metrics.types';
import PreLoginMetricsBatcher from './prelogin-metrics-batcher';

/**
 * @param {string} name - Metric name
 * @param {EventPayload} payload - Metric payload
 * @returns {object} Metrics Payload
 */
function buildEvent(name: string, payload: EventPayload) {
  return {
    type: ['business'],
    eventPayload: {
      key: name,
      client_timestamp: new Date().toISOString(),
      // ...metadata,
      value: payload,
    },
  };
}

/**
 * @description Util class to handle PreLogin Metrics
 * @export
 * @class PreLoginMetrics
 */
export default class PreLoginMetrics extends GenericMetrics {
  // @ts-ignore
  private preLoginMetricsBatcher: PreLoginMetricsBatcher;

  /**
   * Constructor
   * @param {any[]} args - Constructor arguments
   * @constructor
   */
  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.logger = this.webex.logger;
    // @ts-ignore
    this.preLoginMetricsBatcher = new PreLoginMetricsBatcher({}, {parent: this.webex});
  }

  /**
   * @param {string} preLoginId - A string representing the pre-login user ID
   * @param {string} name - Metric name
   * @param {EventPayload} payload - Metric payload
   * @returns {Promise<any>} Metrics Payload
   */
  public submitPreLoginEvent(
    preLoginId: string,
    name: string,
    payload: EventPayload
  ): Promise<any> {
    // build metrics-a event type
    const finalEvent = buildEvent(name, payload);

    this.preLoginMetricsBatcher.savePreLoginId(preLoginId);

    return this.preLoginMetricsBatcher.request(finalEvent);
  }
}
