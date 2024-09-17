/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';

import CallDiagnosticMetrics from './call-diagnostic/call-diagnostic-metrics';
import BehavioralMetrics from './behavioral/behavioral-metrics';
import OperationalMetrics from './operational/operational-metrics';
import BusinessMetrics from './business/business-metrics';
import {
  RecursivePartial,
  MetricEventProduct,
  MetricEventAgent,
  MetricEventVerb,
  ClientEvent,
  FeatureEvent,
  EventPayload,
  OperationalEvent,
  MediaQualityEvent,
  InternalEvent,
  SubmitClientEventOptions,
} from './metrics.types';
import CallDiagnosticLatencies from './call-diagnostic/call-diagnostic-metrics-latencies';
import {setMetricTimings} from './call-diagnostic/call-diagnostic-metrics.util';
import {generateCommonErrorMetadata} from './utils';

/**
 * Metrics plugin to centralize all types of metrics.
 * @class
 */
class Metrics extends WebexPlugin {
  // eslint-disable-next-line no-use-before-define
  static instance: Metrics;

  // Call Diagnostic latencies
  callDiagnosticLatencies: CallDiagnosticLatencies;
  // Helper classes to handle the different types of metrics
  callDiagnosticMetrics: CallDiagnosticMetrics;
  behavioralMetrics: BehavioralMetrics;
  operationalMetrics: OperationalMetrics;
  businessMetrics: BusinessMetrics;
  isReady = false;

  /**
   * Constructor
   * @param args
   * @constructor
   * @private
   * @returns
   */
  constructor(...args) {
    super(...args);

    // @ts-ignore
    this.callDiagnosticLatencies = new CallDiagnosticLatencies({}, {parent: this.webex});
    this.onReady();
  }

  /**
   * On Ready
   */
  private onReady() {
    // @ts-ignore
    this.webex.once('ready', () => {
      // @ts-ignore
      this.callDiagnosticMetrics = new CallDiagnosticMetrics({}, {parent: this.webex});
      this.isReady = true;
    });
  }

  /**
   * Used for internal purposes only
   * @param args
   */
  submitInternalEvent({
    name,
    payload,
    options,
  }: {
    name: InternalEvent['name'];
    payload?: RecursivePartial<InternalEvent['payload']>;
    options?: any;
  }) {
    if (name === 'internal.reset.join.latencies') {
      this.callDiagnosticLatencies.clearTimestamps();
    } else {
      this.callDiagnosticLatencies.saveTimestamp({key: name});
    }
  }

  /**
   * @returns true once we have the deviceId we need to submit behavioral events to Amplitude
   */
  isReadyToSubmitBehavioralEvents() {
    return this.behavioralMetrics?.isReadyToSubmitEvents() ?? false;
  }

  /**
   * @returns true once we have the deviceId we need to submit operational events
   */
  isReadyToSubmitOperationalEvents() {
    return this.operationalMetrics?.isReadyToSubmitEvents() ?? false;
  }

  /**
   * @returns true once we have the deviceId we need to submit buisness events
   */
  isReadyToSubmitBusinessEvents() {
    return this.businessMetrics?.isReadyToSubmitEvents() ?? false;
  }

  /**
   * Behavioral event
   * @param args
   */
  submitBehavioralEvent({
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
    if (!this.isReady) {
      // @ts-ignore
      this.webex.logger.log(
        `NewMetrics: @submitBehavioralEvent. Attempted to submit before webex.ready: ${product}.${agent}.${target}.${verb}`
      );

      return Promise.resolve();
    }

    if (!this.behavioralMetrics) {
      // @ts-ignore
      this.behavioralMetrics = new BehavioralMetrics({}, {parent: this.webex});
    }

    return this.behavioralMetrics.submitBehavioralEvent({product, agent, target, verb, payload});
  }

  /**
   * Operational event
   * @param args
   */
  submitOperationalEvent({name, payload}: {name: string; payload?: EventPayload}) {
    if (!this.isReady) {
      // @ts-ignore
      this.webex.logger.log(
        `NewMetrics: @submitOperationalEvent. Attempted to submit before webex.ready: ${name}`
      );

      return Promise.resolve();
    }

    if (!this.operationalMetrics) {
      // @ts-ignore
      this.operationalMetrics = new OperationalMetrics({}, {parent: this.webex});
    }

    return this.operationalMetrics.submitOperationalEvent({name, payload});
  }

  /**
   * Buisness event
   * @param args
   */
  submitBusinessEvent({name, payload}: {name: string; payload: EventPayload}) {
    if (!this.isReady) {
      // @ts-ignore
      this.webex.logger.log(
        `NewMetrics: @submitBusinessEvent. Attempted to submit before webex.ready: ${name}`
      );

      return Promise.resolve();
    }

    if (!this.businessMetrics) {
      // @ts-ignore
      this.businessMetrics = new BusinessMetrics({}, {parent: this.webex});
    }

    return this.businessMetrics.submitBusinessEvent({name, payload});
  }

  /**
   * Call Analyzer: Media Quality Event
   * @param args
   */
  submitMQE({
    name,
    payload,
    options,
  }: {
    name: MediaQualityEvent['name'];
    payload: RecursivePartial<MediaQualityEvent['payload']> & {
      intervals: MediaQualityEvent['payload']['intervals'];
    };
    options: any;
  }) {
    this.callDiagnosticLatencies.saveTimestamp({key: name});
    this.callDiagnosticMetrics.submitMQE({name, payload, options});
  }

  /**
   * Call Analyzer: Feature Usage Event
   * @param args
   */
  submitFeatureEvent({
    name,
    payload,
    options,
  }: {
    name: FeatureEvent['name'];
    payload?: RecursivePartial<FeatureEvent['payload']>;
    options: any;
  }) {
    throw new Error('Not implemented.');
  }

  /**
   * Call Analyzer: Client Event
   * @public
   * @param args
   */
  public submitClientEvent({
    name,
    payload,
    options,
  }: {
    name: ClientEvent['name'];
    payload?: RecursivePartial<ClientEvent['payload']>;
    options?: SubmitClientEventOptions;
  }): Promise<any> {
    if (!this.callDiagnosticLatencies || !this.callDiagnosticMetrics) {
      // @ts-ignore
      this.webex.logger.log(
        `NewMetrics: @submitClientEvent. Attempted to submit before webex.ready. Event name: ${name}`
      );

      return Promise.resolve();
    }
    this.callDiagnosticLatencies.saveTimestamp({
      key: name,
      options: {meetingId: options?.meetingId},
    });

    return this.callDiagnosticMetrics.submitClientEvent({name, payload, options});
  }

  /**
   * Issue request to alias a user's pre-login ID with their CI UUID
   * @param {string} preLoginId
   * @returns {Object} HttpResponse object
   */
  public clientMetricsAliasUser(preLoginId: string) {
    // @ts-ignore
    return this.webex
      .request({
        method: 'POST',
        api: 'metrics',
        resource: 'clientmetrics',
        headers: {
          'x-prelogin-userid': preLoginId,
        },
        body: {},
        qs: {
          alias: true,
        },
      })
      .then((res) => {
        // @ts-ignore
        this.webex.logger.log(`NewMetrics: @clientMetricsAliasUser. Request successful.`);

        return res;
      })
      .catch((err) => {
        // @ts-ignore
        this.logger.error(
          `NewMetrics: @clientMetricsAliasUser. Request failed:`,
          `err: ${generateCommonErrorMetadata(err)}`
        );

        return Promise.reject(err);
      });
  }

  /**
   * Returns a promise that will resolve to fetch options for submitting a metric.
   *
   * This is to support quickly submitting metrics when the browser/tab is closing.
   * Calling submitClientEvent will not work because there some async steps that will
   * not complete before the browser is closed.  Instead, we pre-gather all the
   * information/options needed for the request(s), and then simply and quickly
   * fire the fetch(es) when beforeUnload is triggered.
   *
   * We must use fetch instead of request because fetch has a keepalive option that
   * allows the request it to outlive the page.
   *
   * Note: the timings values will be wrong, but setMetricTimingsAndFetch() will
   * properly adjust them before submitting.
   *
   * @public
   * @param {Object} arg
   * @param {String} arg.name - event name
   * @param {Object} arg.payload - event payload
   * @param {Object} arg.options - other options
   * @returns {Promise} promise that resolves to options to be used with fetch
   */
  public async buildClientEventFetchRequestOptions({
    name,
    payload,
    options,
  }: {
    name: ClientEvent['name'];
    payload?: RecursivePartial<ClientEvent['payload']>;
    options?: SubmitClientEventOptions;
  }): Promise<any> {
    return this.callDiagnosticMetrics.buildClientEventFetchRequestOptions({
      name,
      payload,
      options,
    });
  }

  /**
   * Submits a metric from pre-built request options via the fetch API. Updates
   * the "$timings" and "originTime" values to Date.now() since the existing times
   * were set when the options were built (not submitted).

   * @param {any} options - the pre-built request options for submitting a metric
   * @returns {Promise} promise that resolves to the response object
   */
  public setMetricTimingsAndFetch(options: any): Promise<any> {
    // @ts-ignore
    return this.webex.setTimingsAndFetch(setMetricTimings(options));
  }

  /**
   * Returns true if the specified serviceErrorCode maps to an expected error.
   * @param {number} serviceErrorCode the service error code
   * @returns {boolean}
   */
  public isServiceErrorExpected(serviceErrorCode: number): boolean {
    return this.callDiagnosticMetrics.isServiceErrorExpected(serviceErrorCode);
  }
}

export default Metrics;
