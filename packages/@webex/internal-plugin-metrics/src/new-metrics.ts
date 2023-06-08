/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';

import CallDiagnosticMetrics, {
  SubmitClientEventOptions,
} from './call-diagnostic/call-diagnostic-metrics';
import BehavioralMetrics from './behavioral/behavioral-metrics';
import {
  RecursivePartial,
  ClientEvent,
  FeatureEvent,
  BehavioralEvent,
  OperationalEvent,
} from './types';
import CallAnalyzerLatencies from './call-diagnostic/call-diagnostic-metrics-latencies';

/**
 * Metrics plugin to centralize all types of metrics.
 */
class Metrics extends WebexPlugin {
  // eslint-disable-next-line no-use-before-define
  static instance: Metrics;

  // latencies required for CA
  callAnalyzerLatencies: CallAnalyzerLatencies;

  // Helper classes to handle the different types of metrics
  callDiagnosticMetrics: CallDiagnosticMetrics;
  behavioralMetrics: BehavioralMetrics;

  /**
   *
   * @param args
   * @returns
   */
  constructor(...args) {
    super(...args);

    if (!Metrics.instance) {
      Metrics.instance = this;
    }

    this.callAnalyzerLatencies = new CallAnalyzerLatencies();

    this.callDiagnosticMetrics = new CallDiagnosticMetrics();
    this.behavioralMetrics = new BehavioralMetrics();

    // eslint-disable-next-line no-constructor-return
    return Metrics.instance;
  }

  /**
   * Initialize Call diagnostic class
   * @param meetingCollection
   * @param webex
   */
  initialSetupCallDiagnosticMetrics(meetingCollection: any, webex: object) {
    this.callDiagnosticMetrics.initialSetup(meetingCollection, webex);
  }

  /**
   * Initialize behavioral class
   */
  initialSetupBehavioralMetrics() {
    // TODO: not implemented
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
    name: BehavioralEvent['name'];
    payload?: RecursivePartial<BehavioralEvent['payload']>;
    options: any;
  }) {
    this.callAnalyzerLatencies.saveLatency(name);
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
    options: any;
  }) {
    this.callAnalyzerLatencies.saveLatency(name);
    this.behavioralMetrics.submitBehavioralEvent();
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
    options: any;
  }) {
    this.callAnalyzerLatencies.saveLatency(name);
    // TODO: not implemented
  }

  /**
   * Media Quality Event
   * @param args
   */
  submitMQE({
    name,
    payload,
    options,
  }: {
    name: OperationalEvent['name'];
    payload?: RecursivePartial<OperationalEvent['payload']>;
    options: any;
  }) {
    this.callAnalyzerLatencies.saveLatency(name);
    // TODO: not implemented
  }

  /**
   * Feature Usage Event
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
    this.callAnalyzerLatencies.saveLatency(name);
    this.callDiagnosticMetrics.submitFeatureEvent({name, payload, options});
  }

  /**
   * Client Event (used for CA)
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
  }) {
    this.callAnalyzerLatencies.saveLatency(name);
    this.callDiagnosticMetrics.submitClientEvent({name, payload, options});
  }
}

// Singleton
const instance = new Metrics();
export default instance;
