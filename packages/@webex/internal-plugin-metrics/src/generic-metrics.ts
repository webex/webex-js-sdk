import {StatelessWebexPlugin} from '@webex/webex-core';
import {BrowserDetection} from '@webex/common';
import {merge} from 'lodash';
import ClientMetricsBatcher from './client-metrics-batcher';
import {getOSNameInternal} from './metrics';
import {DeviceContext, TaggedEvent, EventPayload, MetricType} from './metrics.types';

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

/**
 * @description top-level abstract class to handle Metrics and common routines.
 * @export
 * @class GenericMetrics
 */
export default abstract class GenericMetrics extends StatelessWebexPlugin {
  // @ts-ignore
  private clientMetricsBatcher: ClientMetricsBatcher;
  private logger: any; // to avoid adding @ts-ignore everywhere
  private device: any;
  private version: string;
  private deviceId = '';

  /**
   * Constructor
   * @param {any[]} args
   */
  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.logger = this.webex.logger;
    // @ts-ignore
    this.clientMetricsBatcher = new ClientMetricsBatcher({}, {parent: this.webex});
    // @ts-ignore
    this.device = this.webex.internal.device;
    // @ts-ignore
    this.version = this.webex.version;
  }

  /**
   * Submit a buisness metric to our metrics endpoint.
   * @param {string} kind of metric for logging
   * @param {string} name of the metric
   * @param {object} event
   * @returns {Promise<any>}
   */
  protected submitEvent({kind, name, event}: {kind: string; name: string; event: object}) {
    this.logger.log(kind, `@submitEvent. Submit event: ${name}`);

    return this.clientMetricsBatcher.request(event);
  }

  /**
   * Returns the deviceId from our registration with WDM.
   * @returns {string} deviceId or empty string
   */
  protected getDeviceId(): string {
    if (this.deviceId === '') {
      const {url} = this.device;
      if (url && url.length !== 0) {
        const n = url.lastIndexOf('/');
        if (n !== -1) {
          this.deviceId = url.substring(n + 1);
        }
      }
    }

    return this.deviceId;
  }

  /**
   * Returns the context object to be submitted with all metrics.
   * @returns {DeviceContext}
   */
  protected getContext(): DeviceContext {
    return {
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
  }

  /**
   * Returns the browser details to be included with all metrics.
   * @returns {object}
   */
  protected getBrowserDetails(): object {
    return {
      browser: getBrowserName(),
      browserHeight: window.innerHeight,
      browserVersion: getBrowserVersion(),
      browserWidth: window.innerWidth,
      domain: window.location.hostname,
      inIframe: window.self !== window.top,
      locale: window.navigator.language,
      os: getOSNameInternal(),
    };
  }

  /**
   * Returns true once we have the deviceId we need to submit behavioral/operational/buisness events
   * @returns {boolean}
   */
  public isReadyToSubmitEvents(): boolean {
    const deviceId = this.getDeviceId();

    return deviceId && deviceId.length !== 0;
  }

  /**
   * Creates the object to send to our metrics endpoint for a tagged event (i.e. behavoral or operational)
   * @param {[MetricType]} list of event type (i.e. ['behavioral'], ['operational', 'behavioral'])
   * @param {string} metric name
   * @param {EventPayload} user payload
   * @returns {EventPayload}
   */
  protected createTaggedEventObject({
    type,
    name,
    payload,
  }: {
    type: [MetricType];
    name: string;
    payload: EventPayload;
  }): TaggedEvent {
    let allTags: EventPayload = payload;
    allTags = merge(allTags, this.getBrowserDetails());

    const event = {
      context: this.getContext(),
      metricName: name,
      tags: allTags,
      timestamp: Date.now(),
      type,
    };

    return event;
  }
}
