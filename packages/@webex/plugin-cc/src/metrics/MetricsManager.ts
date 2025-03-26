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
  private readonly runningEvents: Record<string, number> = {};
  private pendingBehavioralEvents: BehavioralEvent[] = [];
  private pendingOperationalEvents: GenericEvent[] = [];
  private pendingBusinessEvents: GenericEvent[] = [];
  private readyToSubmitEvents = false;
  private submittingEvents = false; // Add a lock for submitting events

  // eslint-disable-next-line no-use-before-define
  private static instance: MetricsManager;
  private metricsDisabled = false;

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
        });
      });
    }
  }

  private addDurationIfTimed(name: string, options?: EventPayload): EventPayload {
    const durationKey = 'duration_ms';
    if (name in this.runningEvents) {
      const startTime = this.runningEvents[name];
      delete this.runningEvents[name];
      if (startTime && options) {
        options[durationKey] = Date.now() - startTime;

        return options;
      }
      if (startTime) {
        const payload: EventPayload = {};
        payload[durationKey] = Date.now() - startTime;

        return payload;
      }
    }
    if (options) {
      return options;
    }

    return {};
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

  public timeEvent(_name: string) {
    if (this.isMetricsDisabled()) {
      return;
    }

    this.runningEvents[_name] = Date.now();
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
}
