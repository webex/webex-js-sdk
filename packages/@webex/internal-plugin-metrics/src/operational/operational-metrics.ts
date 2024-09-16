import GenericMetrics from '../generic-metrics';
import {OPERATIONAL_LOG_IDENTIFIER} from './config';
import {EventPayload} from '../metrics.types';

/**
 * @description Util class to handle Operational Metrics
 * @export
 * @class OperationalMetrics
 */
export default class OperationalMetrics extends GenericMetrics {
  /**
   * Submit an operational metric to our metrics endpoint.
   * @param {string} name of the metric
   * @param {EventPayload} user payload of the metric
   * @returns {Promise<any>}
   */
  public submitOperationalEvent({name, payload}: {name: string; payload: EventPayload}) {
    const event = this.createTaggedEventObject({
      type: ['operational'],
      name,
      payload,
    });
    this.submitEvent({kind: OPERATIONAL_LOG_IDENTIFIER, name, event});
  }
}
