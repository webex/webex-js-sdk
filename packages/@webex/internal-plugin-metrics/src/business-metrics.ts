import GenericMetrics from './generic-metrics';
import {EventPayload, Table} from './metrics.types';

/**
 * @description Util class to handle Business Metrics
 * @export
 * @class BusinessMetrics
 */
export default class BusinessMetrics extends GenericMetrics {
  /**
   * Build the metric event to submit.
   * @param {string} name of the metric
   * @param {EventPayload} payload user payload of the metric
   * @param {EventPayload} metadata to include outside of eventPayload.value
   * @returns {MetricEvent} The constructed metric event
   */
  private buildEvent({name, payload, metadata}: {name: string; payload: object; metadata: object}) {
    return {
      type: ['business'],
      eventPayload: {
        key: name,
        client_timestamp: new Date().toISOString(),
        ...metadata,
        value: payload,
      },
    };
  }

  /**
   * Submit a business metric to our metrics endpoint.
   * routes to the correct table with the correct schema payload by table
   * https://confluence-eng-gpk2.cisco.com/conf/display/WAP/Business+metrics++-%3E+ROMA
   * @param {string} name of the metric, ignored if going to wbxapp_callend_metrics
   * @param {EventPayload} payload user payload of the metric
   * @param {Table} table optional - to submit the metric to and adapt the sent schema
   * @param {EventPayload} metadata optional - to include outside of eventPayload.value
   * @returns {Promise<any>}
   */
  public submitBusinessEvent({
    name,
    payload,
    table,
    metadata,
  }: {
    name: string;
    payload: EventPayload;
    table?: Table;
    metadata?: EventPayload;
  }): Promise<void> {
    if (!table) {
      table = 'default';
    }
    if (!metadata) {
      metadata = {};
    }
    if (!metadata.appType) {
      metadata.appType = 'Web Client';
    }
    switch (table) {
      case 'wbxapp_callend_metrics': {
        // https://confluence-eng-gpk2.cisco.com/conf/display/WAP/Table+wbxapp_callend_metrics
        const callEndEvent = this.buildEvent({name: 'callEnd', payload, metadata});

        return this.submitEvent({
          kind: 'business-events:wbxapp_callend_metrics -> ',
          name: 'wbxapp_callend_metrics',
          event: callEndEvent,
        });
      }

      case 'business_metrics': {
        // all event payload keys are converted into a hex string value
        // unfortunately, the pinot team does not allow changes to the schema of business_metrics
        // so we have to shim this layer specifically for this
        // https://confluence-eng-gpk2.cisco.com/conf/display/WAP/Table%3A+business_metrics
        const businessEvent = this.buildEvent({
          name,
          payload: {
            ...this.getContext(),
            ...this.getBrowserDetails(),
            ...payload,
          },
          metadata,
        });

        return this.submitEvent({
          kind: 'business-events:business_metrics -> ',
          name,
          event: businessEvent,
        });
      }

      case 'business_ucf':
      case 'default':
      default: {
        // all event payload keys are converted into a hex string value
        // https://confluence-eng-gpk2.cisco.com/conf/display/WAP/Business+metrics++-%3E+ROMA
        const defaultEvent = this.buildEvent({
          name,
          payload,
          metadata: {
            context: this.getContext(),
            browserDetails: this.getBrowserDetails(),
            ...metadata,
          },
        });

        return this.submitEvent({kind: 'business-events:default -> ', name, event: defaultEvent});
      }
    }
  }
}
