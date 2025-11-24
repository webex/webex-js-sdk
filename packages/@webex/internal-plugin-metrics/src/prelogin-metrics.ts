import GenericMetrics from './generic-metrics';
import {BusinessEvent, EventPayload} from './metrics.types';
import PreLoginMetricsBatcher from './prelogin-metrics-batcher';

/**
 * @description Util class to handle PreLogin Metrics
 * @export
 * @class PreLoginMetrics
 */
export default class PreLoginMetrics extends GenericMetrics {
  private preLoginMetricsBatcher: typeof PreLoginMetricsBatcher;

  /**
   * Constructor
   * @param {PreLoginMetricsBatcher} preLoginMetricsBatcher - Pre-login metrics batcher
   * @param {any} attrs - Attributes
   * @param {any} options - Options
   * @constructor
   */
  constructor(
    preLoginMetricsBatcher: typeof PreLoginMetricsBatcher,
    attrs: any = {},
    options: {parent?: any} = {}
  ) {
    super(attrs, options);
    this.preLoginMetricsBatcher = preLoginMetricsBatcher;
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

    const finalEvent = this.buildEvent(name, preLoginId, payload, metadata);

    this.preLoginMetricsBatcher.savePreLoginId(preLoginId);

    return this.preLoginMetricsBatcher.request(finalEvent);
  }

  /**
   * Builds a formatted event object for metrics submission.
   * @param {string} metricName - Metric name
   * @param {string} preLoginId - Pre-login user identifier
   * @param {EventPayload} payload - Metric payload data
   * @param {EventPayload} metadata - Additional metadata to include in the event
   * @returns {object} Formatted metrics event object with type, eventPayload, and timestamp
   */
  private buildEvent(
    metricName: string,
    preLoginId: string,
    payload: EventPayload,
    metadata: EventPayload
  ): BusinessEvent {
    return {
      type: ['business'],
      eventPayload: {
        metricName,
        browserDetails: this.getBrowserDetails(),
        context: this.getContext(),
        timestamp: new Date().getTime(),
        value: {
          preLoginId,
          ...metadata,
          ...payload,
        },
      },
    };
  }
}
