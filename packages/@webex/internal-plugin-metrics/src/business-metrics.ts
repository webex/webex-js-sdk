import GenericMetrics from './generic-metrics';
import {EventPayload, Table} from './metrics.types';

/**
 * @description Util class to handle Buisness Metrics
 * @export
 * @class BusinessMetrics
 */
export default class BusinessMetrics extends GenericMetrics {
  /**
   * unfortunately, the pinot team does not allow changes to the schema of wbxapp_callend_metrics
   * so we have to shim this layer specifically for this
   * @param {EventPayload} payload payload of the metric
   * @returns {Promise<any>}
   */
  private submitCallEndEvent({payload}: {payload: EventPayload}) {
    const event = {
      type: ['business'],
      eventPayload: {
        key: 'callEnd',
        client_timestamp: Date.now(),
        ...payload,
      },
    };

    return this.submitEvent({
      kind: 'buisness-events:wbxapp_callend_metrics -> ',
      name: 'wbxapp_callend_metrics',
      event,
    });
  }

  /**
   * Submit a buisness metric to our metrics endpoint, going to the default business_ucf table
   * all event payload keys are converted into a hex string value
   * unfortunately, the pinot team does not allow changes to the schema of business_metrics
   * so we have to shim this layer specifically for this
   * @param {string} name of the metric
   * @param {EventPayload} payload payload of the metric
   * @returns {Promise<any>}
   */
  private submitBusinessMetricsEvent({name, payload}: {name: string; payload: EventPayload}) {
    const event = {
      type: ['business'],
      eventPayload: {
        key: name,
        client_timestamp: Date.now(),
        value: payload,
      },
    };

    return this.submitEvent({kind: 'buisness-events:business_metrics -> ', name, event});
  }

  /**
   * Submit a buisness metric to our metrics endpoint, going to the default business_ucf table
   * all event payload keys are converted into a hex string value
   * @param {string} name of the metric
   * @param {EventPayload} user payload of the metric
   * @returns {Promise<any>}
   */
  private submitDefaultEvent({name, payload}: {name: string; payload: EventPayload}) {
    const event = {
      type: ['business'],
      eventPayload: {
        key: name,
        client_timestamp: Date.now(),
        context: this.getContext(),
        browserDetails: this.getBrowserDetails(),
        value: payload,
      },
    };

    return this.submitEvent({kind: 'buisness-events:default -> ', name, event});
  }

  /**
   * Submit a buisness metric to our metrics endpoint.
   * routes to the correct table with the correct schema payload by table
   * @param {string} name of the metric, ignored if going to wbxapp_callend_metrics
   * @param {EventPayload} payload user payload of the metric
   * @param {Table} table optional - to submit the metric to and adapt the sent schema
   * @returns {Promise<any>}
   */
  public submitBusinessEvent({
    name,
    payload,
    table,
  }: {
    name: string;
    payload: EventPayload;
    table?: Table;
  }): Promise<void> {
    if (!table) {
      table = 'default';
    }
    switch (table) {
      case 'wbxapp_callend_metrics':
        return this.submitCallEndEvent({payload});
      case 'business_metrics':
        return this.submitBusinessMetricsEvent({name, payload});
      case 'business_ucf':
        return this.submitDefaultEvent({name, payload});
      case 'default':
      default:
        return this.submitDefaultEvent({name, payload});
    }
  }
}
