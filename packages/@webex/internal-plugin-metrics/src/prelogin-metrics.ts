import GenericMetrics from './generic-metrics';
import {EventPayload, Table} from './metrics.types';
import PreLoginMetricsBatcher from './prelogin-metrics-batcher';

/**
 * Builds a formatted event object for metrics submission.
 * @param {string} name - Metric name
 * @param {string} preLoginId - Pre-login user identifier
 * @param {EventPayload} payload - Metric payload data
 * @param {EventPayload} metadata - Additional metadata to include in the event
 * @returns {object} Formatted metrics event object with type, eventPayload, and timestamp
 */
function buildEvent(
  name: string,
  preLoginId: string,
  payload: EventPayload,
  metadata: EventPayload
) {
  const payloadWithPreLoginId = {...payload, preLoginId};

  return {
    type: ['business'],
    eventPayload: {
      key: name,
      client_timestamp: new Date().toISOString(),
      preLoginId,
      ...metadata,
      value: payloadWithPreLoginId,
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
   * Submit a business metric to our metrics endpoint.
   * Routes to the correct table with the correct schema payload by table.
   * @see https://confluence-eng-gpk2.cisco.com/conf/display/WAP/Business+metrics++-%3E+ROMA
   * @param {Object} options - The options object
   * @param {string} options.name - Name of the metric
   * @param {string} options.preLoginId - ID to identify pre-login user
   * @param {EventPayload} options.payload - User payload of the metric
   * @param {EventPayload} [options.metadata] - Optional metadata to include outside of eventPayload.value
   * @returns {Promise<void>} Promise that resolves when the metric is submitted
   */
  public submitPreLoginEvent({
    name,
    preLoginId,
    payload,
    metadata,
  }: {
    name: string;
    preLoginId: string;
    payload: EventPayload;
    metadata?: EventPayload;
  }): Promise<void> {
    if (!metadata) {
      metadata = {};
    }
    if (!metadata.appType) {
      metadata.appType = 'Web Client';
    }

    const finalEvent = buildEvent(name, preLoginId, payload, metadata);

    this.preLoginMetricsBatcher.savePreLoginId(preLoginId);

    return this.preLoginMetricsBatcher.request(finalEvent);
  }
}
