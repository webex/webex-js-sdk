import GenericMetrics from './generic-metrics';
import {EventPayload} from './metrics.types';

/**
 * @description Util class to handle Buisness Metrics
 * @export
 * @class BusinessMetrics
 */
export default class BusinessMetrics extends GenericMetrics {
  /**
   * Submit a buisness metric to our metrics endpoint.
   * @param {string} name of the metric
   * @param {EventPayload} user payload of the metric
   * @returns {Promise<any>}
   */
  public submitBusinessEvent({name, payload}: {name: string; payload: EventPayload}) {
    const event = {
      type: ['business'],
      eventPayload: {
        metricName: name,
        timestamp: Date.now(),
        context: this.getContext(),
        browserDetails: this.getBrowserDetails(),
        value: payload,
      },
    };

    this.submitEvent({kind: 'buisness-events -> ', name, event});
  }
}
