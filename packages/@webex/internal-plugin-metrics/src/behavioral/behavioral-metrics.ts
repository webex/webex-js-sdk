import {BEHAVIORAL_LOG_IDENTIFIER} from './config';
import {
  MetricEventProduct,
  MetricEventAgent,
  MetricEventVerb,
  EventPayload,
} from '../metrics.types';
import GenericMetrics from '../generic-metrics';

/**
 * @description Util class to handle Behavioral Metrics
 * @export
 * @class BehavioralMetrics
 */
export default class BehavioralMetrics extends GenericMetrics {
  /**
   * Submit a behavioral metric to our metrics endpoint.
   * @param {MetricEventProduct} product the product from which the metric is being submitted, e.g. 'webex' web client, 'wxcc_desktop'
   * @param {MetricEventAgent} agent the source of the action for this metric
   * @param {string} target the 'thing' that this metric includes information about
   * @param {MetricEventVerb} verb the action that this metric includes information about
   * @param {EventPayload} payload information specific to this event. This should be flat, i.e. it should not include nested objects.
   * @returns {Promise<any>}
   */
  public submitBehavioralEvent({
    product,
    agent,
    target,
    verb,
    payload,
  }: {
    product: MetricEventProduct;
    agent: MetricEventAgent;
    target: string;
    verb: MetricEventVerb;
    payload?: EventPayload;
  }) {
    const name = `${product}.${agent}.${target}.${verb}`;
    const event = this.createTaggedEventObject({
      type: ['behavioral'],
      name,
      payload,
    });
    this.submitEvent({kind: BEHAVIORAL_LOG_IDENTIFIER, name, event});
  }
}
