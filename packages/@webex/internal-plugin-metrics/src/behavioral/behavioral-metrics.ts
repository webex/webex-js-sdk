import {merge} from 'lodash';
import {BrowserDetection} from '@webex/common';
import {StatelessWebexPlugin} from '@webex/webex-core';
import {getOSNameInternal} from '../metrics';
import {BEHAVIORAL_LOG_IDENTIFIER} from './config';
import {
  MetricEventProduct,
  MetricEventAgent,
  MetricEventVerb,
  BehavioralEventContext,
  BehavioralEvent,
  BehavioralEventPayload,
} from '../metrics.types';
import ClientMetricsBatcher from '../client-metrics-batcher';

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

/**
 * @description Util class to handle Behavioral Metrics
 * @export
 * @class BehavioralMetrics
 */
export default class BehavioralMetrics extends StatelessWebexPlugin {
  // @ts-ignore
  private clientMetricsBatcher: ClientMetricsBatcher;
  private logger: any; // to avoid adding @ts-ignore everywhere
  private device: any;
  private version: string;

  /**
   * Constructor
   * @param {any[]} args
   */
  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.logger = this.webex.logger;
    // @ts-ignore
    this.device = this.webex.internal.device;
    // @ts-ignore
    this.version = this.webex.version;
    // @ts-ignore
    this.clientMetricsBatcher = new ClientMetricsBatcher({}, {parent: this.webex});
  }

  /**
   * Returns the deviceId from our registration with WDM.
   * @returns {string} deviceId or empty string
   */
  private getDeviceId(): string {
    const {url} = this.device;
    if (url && url.length !== 0) {
      const n = url.lastIndexOf('/');
      if (n !== -1) {
        return url.substring(n + 1);
      }
    }

    return '';
  }

  /**
   * Returns the context object to be submitted with all behavioral metrics.
   * @returns {BehavioralEventContext}
   */
  private getContext(): BehavioralEventContext {
    const context: BehavioralEventContext = {
      app: {
        version: this.version,
      },
      device: {
        id: this.getDeviceId(),
      },
      locale: window.navigator.language,
      os: {
        name: getOSNameInternal(),
        version: getOSVersion(),
      },
    };

    return context;
  }

  /**
   * Returns the default tags to be included with all behavioral metrics.
   * @returns {BehavioralEventPayload}
   */
  private getDefaultTags(): BehavioralEventPayload {
    const tags = {
      browser: getBrowserName(),
      browserHeight: window.innerHeight,
      browserVersion: getBrowserVersion(),
      browserWidth: window.innerWidth,
      domain: window.location.hostname,
      inIframe: window.self !== window.top,
      locale: window.navigator.language,
      os: getOSNameInternal(),
    };

    return tags;
  }

  /**
   * Creates the object to send to our metrics endpoint for a behavioral event
   * @param {MetricEventProduct} product
   * @param {MetricEventAgent} agent
   * @param {string} target
   * @param {MetricEventVerb} verb
   * @returns {BehavioralEventPayload}
   */
  private createEventObject({
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
    payload?: BehavioralEventPayload;
  }): BehavioralEvent {
    const metricName = `${product}.${agent}.${target}.${verb}`;
    let allTags: BehavioralEventPayload = payload;
    allTags = merge(allTags, this.getDefaultTags());

    const event: BehavioralEvent = {
      context: this.getContext(),
      metricName,
      tags: allTags,
      timestamp: Date.now(),
      type: ['behavioral'],
    };

    return event;
  }

  /**
   * Returns true once we're ready to submit behavioral metrics, after startup.
   * @returns {boolean} true when deviceId is defined and non-empty
   */
  public isReadyToSubmitBehavioralEvents(): boolean {
    const deviceId = this.getDeviceId();

    return deviceId && deviceId.length !== 0;
  }

  /**
   * Submit a behavioral metric to our metrics endpoint.
   * @param {MetricEventProduct} product the product from which the metric is being submitted, e.g. 'webex' web client, 'wxcc_desktop'
   * @param {MetricEventAgent} agent the source of the action for this metric
   * @param {string} target the 'thing' that this metric includes information about
   * @param {MetricEventVerb} verb the action that this metric includes information about
   * @param {BehavioralEventPayload} payload information specific to this event. This should be flat, i.e. it should not include nested objects.
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
    payload?: BehavioralEventPayload;
  }) {
    this.logger.log(
      BEHAVIORAL_LOG_IDENTIFIER,
      `BehavioralMetrics: @submitBehavioralEvent. Submit Behavioral event: ${product}.${agent}.${target}.${verb}`
    );
    const behavioralEvent = this.createEventObject({product, agent, target, verb, payload});

    return this.clientMetricsBatcher.request(behavioralEvent);
  }
}
