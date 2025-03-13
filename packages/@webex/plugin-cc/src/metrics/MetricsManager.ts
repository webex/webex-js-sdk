import {EventPayload} from '@webex/internal-plugin-metrics/src/metrics.types';

import {WebexSDK} from '../types';
import {BehavioralEventTaxonomy, getEventTaxonomy} from './behavioral-events';
import LoggerProxy from '../logger-proxy';

type MemoryInfo = {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
};

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
  private readonly runningEvents: Map<string, number> = new Map<string, number>();
  private pendingBehavioralEvents: BehavioralEvent[] = [];
  private pendingOperationalEvents: GenericEvent[] = [];
  private pendingBusinessEvents: GenericEvent[] = [];
  private readyToSubmitEvents = false;
  private submittingEvents = false; // Add a lock for submitting events

  // eslint-disable-next-line no-use-before-define
  private static instance: MetricsManager;

  private constructor({webex}: {webex: WebexSDK}) {
    this.webex = webex;

    if (this.webex.ready) {
      this.setReadyToSubmitEvents();
    }
    this.webex.once('ready', () => {
      this.setReadyToSubmitEvents();
    });
  }

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
      this.pendingBehavioralEvents = [];
      eventsToSubmit.forEach((event) => {
        this.webex?.internal?.newMetrics?.submitBehavioralEvent({
          product: event.taxonomy.product,
          agent: event.taxonomy.agent,
          target: event.taxonomy.target,
          verb: event.taxonomy.verb,
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
      this.pendingOperationalEvents = [];
      eventsToSubmit.forEach((event) => {
        this.webex?.internal?.newMetrics?.submitOperationalEvent({
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
      this.pendingBusinessEvents = [];
      eventsToSubmit.forEach((event) => {
        this.webex?.internal?.newMetrics?.submitBusinessEvent({
          name: event.name,
          payload: event.payload,
        });
      });
    }
  }

  private addDurationIfTimed(name: string, options?: EventPayload): EventPayload {
    const durationKey = 'duration_ms';
    const startTime = this.runningEvents.get(name);
    this.runningEvents.delete(name);
    if (startTime && options) {
      options[durationKey] = Date.now() - startTime;

      return options;
    }
    if (startTime) {
      const payload: EventPayload = {};
      payload[durationKey] = Date.now() - startTime;

      return payload;
    }
    if (options) {
      return options;
    }

    return {};
  }

  private static preparePayload(options: EventPayload): EventPayload {
    const payload: EventPayload = {};

    for (const [key, value] of Object.entries(options)) {
      payload[key.replace(/ /g, '_')] = value; // Replace spaces with underscores
    }

    if (typeof window === 'undefined') {
      return payload;
    }

    const payloadWithCommonMetadata = {...payload};
    payloadWithCommonMetadata.tabHidden = document.hidden;
    if (window.performance && 'memory' in window.performance) {
      const memory = window.performance.memory as MemoryInfo;
      payloadWithCommonMetadata.mem_js_heap_size_limit = memory.jsHeapSizeLimit;
      payloadWithCommonMetadata.mem_total_js_heap_size = memory.totalJSHeapSize;
      payloadWithCommonMetadata.mem_used_js_heap_size = memory.usedJSHeapSize;
    }

    return payloadWithCommonMetadata;
  }

  private isMetricsDisabled(): boolean {
    // TODO: Need to return true if in development mode to avoid sending metrics to the server
    return false;
  }

  public trackBehavioralEvent(name: string, options?: EventPayload) {
    if (this.isMetricsDisabled()) {
      return;
    }

    const taxonomy = getEventTaxonomy(name);
    if (taxonomy === undefined) {
      LoggerProxy.error(`[MetricsManager] Behavioral event is not in the taxonomy: ${name}`);

      return;
    }
    const payload = MetricsManager.preparePayload(this.addDurationIfTimed(name, options));

    this.pendingBehavioralEvents.push({taxonomy, payload});
    this.submitPendingBehavioralEvents();
  }

  public trackOperationalEvent(name: string, options?: EventPayload) {
    if (this.isMetricsDisabled()) {
      return;
    }

    const payload = this.addDurationIfTimed(name, options);
    this.pendingOperationalEvents.push({name, payload: MetricsManager.preparePayload(payload)});
    this.submitPendingOperationalEvents();
  }

  public trackBusinessEvent(name: string, options?: EventPayload) {
    if (this.isMetricsDisabled()) {
      return;
    }

    const payload = this.addDurationIfTimed(name, options);
    this.pendingBusinessEvents.push({name, payload: MetricsManager.preparePayload(payload)});
    this.submitPendingBusinessEvents();
  }

  public trackEvent(
    name: string,
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

    this.runningEvents.set(_name, Date.now());
  }

  // Make the class a singleton
  public static getInstance(options: {webex: WebexSDK}): MetricsManager {
    if (!options || !options.webex) {
      LoggerProxy.error('WebexSDK instance is required to create a MetricsManager instance');
      throw new Error('WebexSDK instance is required to create a MetricsManager instance');
    }
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager(options);
    }

    return MetricsManager.instance;
  }
}
