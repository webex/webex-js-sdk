/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';

import CallDiagnosticMetrics, {
  SubmitClientEventOptions,
} from './call-diagnostic/call-diagnostic-metrics';
import {
  RecursivePartial,
  ClientEvent,
  FeatureEvent,
  BehavioralEvent,
  OperationalEvent,
  MediaQualityEvent,
  InternalEvent,
} from './metrics.types';

/**
 * Metrics plugin to centralize all types of metrics.
 * @class
 */
class Metrics extends WebexPlugin {
  // eslint-disable-next-line no-use-before-define
  static instance: Metrics;

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

    if (!Metrics.instance) {
      Metrics.instance = this;
    }

    this.callDiagnosticMetrics = new CallDiagnosticMetrics();

    // eslint-disable-next-line no-constructor-return
    return Metrics.instance;
  }

  /**
   * Initialize Call Diagnostic class
   * @param meetingCollection
   * @param webex
   */
  initialSetupCallDiagnosticMetrics(meetingCollection: any, webex: object) {
    this.callDiagnosticMetrics.initialSetup(meetingCollection, webex);
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
    options: any;
  }) {
    throw new Error('Not implemented.');
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
    options: any;
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
    throw new Error('Not implemented.');
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
  }) {
    this.callDiagnosticMetrics.submitClientEvent({name, payload, options});
  }
}

// Singleton
const instance = new Metrics();
export default instance;
