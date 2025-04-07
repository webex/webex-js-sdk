import {
  EventPayload,
  MetricEventAgent,
  MetricEventProduct,
  MetricEventVerb,
} from '@webex/internal-plugin-metrics/src/metrics.types';

import {WebexSDK} from '../types';
import {BehavioralEventTaxonomy, getEventTaxonomy} from './behavioral-events';
import LoggerProxy from '../logger-proxy';
import {METRIC_EVENT_NAMES} from './constants';
import {Failure} from '../services/core/GlobalTypes';
import {EMPTY_STRING, PRODUCT_NAME} from '../constants';

type BehavioralEvent = {
  taxonomy: BehavioralEventTaxonomy;
  payload: EventPayload;
};

type GenericEvent = {
  name: string;
  payload: EventPayload;
};

export type MetricsType = 'behavioral' | 'operational' | 'business';

export default class MetricsManager {
  private webex: WebexSDK;
  private readonly runningEvents: Record<string, {startTime: number; keys: Set<string>}> = {};
  private pendingBehavioralEvents: BehavioralEvent[] = [];
  private pendingOperationalEvents: GenericEvent[] = [];
  private pendingBusinessEvents: GenericEvent[] = [];
  private readyToSubmitEvents = false;
  private submittingEvents = false; // Add a lock for submitting events

  // eslint-disable-next-line no-use-before-define
  private static instance: MetricsManager;
  private metricsDisabled = false; // TODO: SPARK-637285

  // eslint-disable-next-line no-useless-constructor
  private constructor() {}

  private setReadyToSubmitEvents() {
    this.readyToSubmitEvents = true;
    this.submitPendingEvents();
  }

  private async submitPendingEvents() {
    if (this.submittingEvents) {
      return;
    }
    this.submittingEvents = true;
    try {
      await this.submitPendingBehavioralEvents();
      await this.submitPendingOperationalEvents();
      await this.submitPendingBusinessEvents();
    } finally {
      this.submittingEvents = false;
    }
  }

  private async submitPendingBehavioralEvents() {
    if (this.pendingBehavioralEvents.length === 0) {
      return;
    }
    if (this.readyToSubmitEvents) {
      const eventsToSubmit = [...this.pendingBehavioralEvents];
      this.pendingBehavioralEvents.length = 0;
      eventsToSubmit.forEach((event) => {
        this.webex.internal.newMetrics.submitBehavioralEvent({
          product: event.taxonomy.product as MetricEventProduct,
          agent: event.taxonomy.agent as MetricEventAgent,
          target: event.taxonomy.target,
          verb: event.taxonomy.verb as MetricEventVerb,
          payload: event.payload,
        });
      });
    }
  }

  private async submitPendingOperationalEvents() {
    if (this.pendingOperationalEvents.length === 0) {
      return;
    }
    if (this.readyToSubmitEvents) {
      const eventsToSubmit = [...this.pendingOperationalEvents];
      this.pendingOperationalEvents.length = 0;
      eventsToSubmit.forEach((event) => {
        this.webex.internal.newMetrics.submitOperationalEvent({
          name: event.name,
          payload: event.payload,
        });
      });
    }
  }

  private async submitPendingBusinessEvents() {
    if (this.pendingBusinessEvents.length === 0) {
      return;
    }
    if (this.readyToSubmitEvents) {
      const eventsToSubmit = [...this.pendingBusinessEvents];
      this.pendingBusinessEvents.length = 0;
      eventsToSubmit.forEach((event) => {
        this.webex.internal.newMetrics.submitBusinessEvent({
          name: event.name,
          payload: event.payload,
          metadata: {
            appType: PRODUCT_NAME,
          },
        });
      });
    }
  }

  private addDurationIfTimed(eventName: string, options?: EventPayload): EventPayload {
    const durationKey = 'duration_ms';
    for (const [genericKey, timing] of Object.entries(this.runningEvents)) {
      if (timing.keys.has(eventName)) {
        const startTime = timing.startTime;
        // Remove all keys for this operation.
        delete this.runningEvents[genericKey];
        options = options || {};
        options[durationKey] = Date.now() - startTime;

        return options;
      }
    }

    return options || {};
  }

  static spacesToUnderscore(str: string): string {
    return str.replace(/ /g, '_');
  }

  private static preparePayload(options: EventPayload): EventPayload {
    const payload: EventPayload = {};

    for (const [key, value] of Object.entries(options)) {
      payload[MetricsManager.spacesToUnderscore(key)] = value; // Replace spaces with underscores
    }

    if (typeof window === 'undefined') {
      return payload;
    }

    const payloadWithCommonMetadata = {...payload};
    payloadWithCommonMetadata.tabHidden = document.hidden;

    return payloadWithCommonMetadata;
  }

  private isMetricsDisabled(): boolean {
    // TODO: SPARK-637285 Need to return true if in development mode to avoid sending metrics to the server
    return this.metricsDisabled;
  }

  public setMetricsDisabled(disabled: boolean) {
    this.metricsDisabled = disabled;
    if (disabled) {
      this.clearPendingEvents();
    }
  }

  private clearPendingEvents() {
    this.pendingBehavioralEvents.length = 0;
    this.pendingOperationalEvents.length = 0;
    this.pendingBusinessEvents.length = 0;
  }

  public trackBehavioralEvent(name: METRIC_EVENT_NAMES, options?: EventPayload) {
    if (this.isMetricsDisabled()) {
      return;
    }

    const taxonomy = getEventTaxonomy(name);

    const payload = MetricsManager.preparePayload(this.addDurationIfTimed(name, options));

    this.pendingBehavioralEvents.push({taxonomy, payload});
    this.submitPendingBehavioralEvents();
  }

  public trackOperationalEvent(name: METRIC_EVENT_NAMES, options?: EventPayload) {
    if (this.isMetricsDisabled()) {
      return;
    }

    const payload = this.addDurationIfTimed(name, options);
    this.pendingOperationalEvents.push({
      name: MetricsManager.spacesToUnderscore(name).toUpperCase(),
      payload: MetricsManager.preparePayload(payload),
    });
    this.submitPendingOperationalEvents();
  }

  public trackBusinessEvent(name: METRIC_EVENT_NAMES, options?: EventPayload) {
    if (this.isMetricsDisabled()) {
      return;
    }

    const payload = this.addDurationIfTimed(name, options);
    this.pendingBusinessEvents.push({
      name: MetricsManager.spacesToUnderscore(name).toUpperCase(),
      payload: MetricsManager.preparePayload(payload),
    });
    this.submitPendingBusinessEvents();
  }

  public trackEvent(
    name: METRIC_EVENT_NAMES,
    payload?: EventPayload,
    metricServices: MetricsType[] = ['behavioral']
  ) {
    if (this.isMetricsDisabled()) {
      return;
    }

    for (const metricService of metricServices) {
      switch (metricService) {
        case 'behavioral':
          this.trackBehavioralEvent(name, payload);
          break;
        case 'operational':
          this.trackOperationalEvent(name, payload);
          break;
        case 'business':
          this.trackBusinessEvent(name, payload);
          break;
        default:
          LoggerProxy.error(`[MetricsManager] Invalid metric type: ${metricService}`);
      }
    }
  }

  public timeEvent(keys: string | string[]) {
    if (this.isMetricsDisabled()) {
      return;
    }
    const keyArray = Array.isArray(keys) ? keys : [keys];
    // Use the first key as the tracking key.
    if (keyArray.length === 0) {
      LoggerProxy.error('[MetricsManager] No keys provided for timeEvent');

      return;
    }
    const genericKey = keyArray[0];
    this.runningEvents[genericKey] = {startTime: Date.now(), keys: new Set(keyArray)};
  }

  private setWebex(webex: WebexSDK) {
    this.webex = webex;
    if (this.webex.ready) {
      this.setReadyToSubmitEvents();
    }
    this.webex.once('ready', () => {
      this.setReadyToSubmitEvents();
    });
  }

  // Make the class a singleton
  public static getInstance(options?: {webex: WebexSDK}): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager();
    }

    if (!MetricsManager.instance.webex && options && options.webex) {
      MetricsManager.instance.setWebex(options.webex);
    }

    return MetricsManager.instance;
  }

  public static resetInstance() {
    MetricsManager.instance = undefined;
  }

  public static getCommonTrackingFieldForAQMResponse(response: any): Record<string, any> {
    const fields = {
      agentId: response?.data?.agentId || EMPTY_STRING,
      teamId: response?.data?.teamId || EMPTY_STRING, // TODO: handle multiple teams
      siteId: response?.data?.siteId || EMPTY_STRING,
      orgId: response?.orgId || EMPTY_STRING,
      eventType: response?.type || EMPTY_STRING,
      trackingId: response?.data?.trackingId || EMPTY_STRING,
      notifTrackingId: response?.trackingId || EMPTY_STRING,
    };

    Object.keys(fields).forEach((key) => {
      if (fields[key] === '' || fields[key] === undefined || fields[key] === null) {
        delete fields[key];
      }
    });

    return fields;
  }

  public static getCommonTrackingFieldForAQMResponseFailed(
    failureResponse: Failure
  ): Record<string, any> {
    const fields = {
      agentId: failureResponse?.data?.agentId || EMPTY_STRING,
      trackingId: failureResponse?.trackingId || EMPTY_STRING,
      notifTrackingId: failureResponse?.trackingId || EMPTY_STRING,
      orgId: failureResponse?.orgId || EMPTY_STRING,
      failureType: failureResponse?.type || EMPTY_STRING,
      failureReason: failureResponse?.data?.reason || EMPTY_STRING,
      reasonCode: failureResponse?.data?.reasonCode || EMPTY_STRING,
    };

    Object.keys(fields).forEach((key) => {
      if (fields[key] === '' || fields[key] === undefined || fields[key] === null) {
        delete fields[key];
      }
    });

    return fields;
  }
}
