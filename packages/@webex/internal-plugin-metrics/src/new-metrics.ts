/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';

import CallDiagnosticMetrics from './call-diagnostic/call-diagnostic-metrics';
import {
  RecursivePartial,
  ClientEvent,
  FeatureEvent,
  BehavioralEvent,
  OperationalEvent,
  MediaQualityEvent,
  InternalEvent,
  SubmitClientEventOptions,
} from './metrics.types';
import CallDiagnosticLatencies from './call-diagnostic/call-diagnostic-metrics-latencies';

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

  /**
   * Constructor
   * @param args
   * @constructor
   * @private
   * @returns
   */
  constructor(...args) {
    super(...args);

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
      // @ts-ignore
      this.callDiagnosticLatencies = new CallDiagnosticLatencies({}, {parent: this.webex});
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
   * Behavioral event
   * @param args
   */
  submitBehavioralEvent({
    name,
    payload,
    options,
  }: {
    name: BehavioralEvent['name'];
    payload?: RecursivePartial<BehavioralEvent['payload']>;
    options?: any;
  }) {
    this.callDiagnosticLatencies.saveTimestamp({key: name});
    throw new Error('Not implemented.');
  }

  /**
   * Operational event
   * @param args
   */
  submitOperationalEvent({
    name,
    payload,
    options,
  }: {
    name: OperationalEvent['name'];
    payload?: RecursivePartial<OperationalEvent['payload']>;
    options?: any;
  }) {
    throw new Error('Not implemented.');
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
    options: SubmitClientEventOptions;
  }): Promise<any> {
    this.callDiagnosticLatencies.saveTimestamp({
      key: name,
      options: {meetingId: options?.meetingId},
    });

    return this.callDiagnosticMetrics.submitClientEvent({name, payload, options});
  }
}

export default Metrics;
