/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';

import CallDiagnosticMetrics, {SubmitClientEventOptions} from './call-diagnostic-metrics';
import BehavioralMetrics from './behavioral-metrics';
import {
  RecursivePartial,
  ClientEvent,
  FeatureEvent,
  BehavioralEvent,
  OperationalEvent,
} from './types';
import CallAnalyzerLatencies from './call-diagnostic-metrics-latencies';

/**
 *
 */
class Metrics extends WebexPlugin {
  // eslint-disable-next-line no-use-before-define
  static instance: Metrics;
  callAnalyzerLatencies: CallAnalyzerLatencies;

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
   *
   * @param meetingCollection
   * @param webex
   */
  initialSetupCallDiagnosticMetrics(meetingCollection: any, webex: object) {
    this.callDiagnosticMetrics.meetingCollection = meetingCollection;
    this.callDiagnosticMetrics.webex = webex;
  }

  /**
   *
   */
  initialSetupBehavioralMetrics() {
    // TODO: not implemented
  }

  /**
   *
   * @param param0
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
   *
   * @param name
   * @param payload
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
   *
   * @param name
   * @param payload
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
   *
   * @param name
   * @param payload
   */
  submitMQEEvent({
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
   *
   * @param name
   * @param payload
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
   *
   * @param payload
   * @returns
   */
  submitClientEvent({
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
