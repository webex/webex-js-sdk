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
import {PRODUCT_NAME} from '../constants';

type BehavioralEvent = {
  taxonomy: BehavioralEventTaxonomy;
  payload: EventPayload;
};

type GenericEvent = {
  name: string;
  payload: EventPayload;
};

export type MetricsType = 'behavioral' | 'operational' | 'business';

const PRODUCT_NAME_UPPER = PRODUCT_NAME.toUpperCase();
/**
 * @class MetricsManager
 * @classdesc Manages the collection, batching, and submission of behavioral, operational, and business metrics for the Webex SDK.
 * Implements a singleton pattern to ensure a single instance throughout the application lifecycle.
 *
 * @remarks
 * This class is responsible for tracking, batching, and submitting various types of metric events.
 * It also provides utility methods for extracting common tracking fields from AQM responses.
 * @ignore
 */
export default class MetricsManager {
  /**
   * The Webex SDK instance used for submitting metrics.
   * @private
   */
  private webex: WebexSDK;

  /**
   * Stores currently running timed events.
   * @private
   */
  private readonly runningEvents: Record<string, {startTime: number; keys: Set<string>}> = {};

  /**
   * Queue for pending behavioral events.
   * @private
   */
  private pendingBehavioralEvents: BehavioralEvent[] = [];

  /**
   * Queue for pending operational events.
   * @private
   */
  private pendingOperationalEvents: GenericEvent[] = [];

  /**
   * Queue for pending business events.
   * @private
   */
  private pendingBusinessEvents: GenericEvent[] = [];

  /**
   * Indicates if the manager is ready to submit events.
   * @private
   */
  private readyToSubmitEvents = false;

  /**
   * Lock to prevent concurrent submissions.
   * @private
   */
  private submittingEvents = false; // Add a lock for submitting events

  /**
   * Singleton instance of MetricsManager.
   * @private
   */
  private static instance: MetricsManager;

  /**
   * Flag to disable metrics collection.
   * @private
   */
  private metricsDisabled = false; // TODO: SPARK-637285

  /**
   * Private constructor to enforce singleton pattern.
   * @private
   */
  // eslint-disable-next-line no-useless-constructor
  private constructor() {}

  /**
   * Marks the manager as ready to submit events and triggers submission.
   * @private
   */
  private setReadyToSubmitEvents() {
    this.readyToSubmitEvents = true;
    this.submitPendingEvents();
  }

  /**
   * Submits all pending events if not already submitting.
   * @private
   */
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

  /**
   * Submits all pending behavioral events if ready.
   * @private
   */
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

  /**
   * Submits all pending operational events if ready.
   * @private
   */
  private async submitPendingOperationalEvents() {
    if (this.pendingOperationalEvents.length === 0) {
      return;
    }
    if (this.readyToSubmitEvents) {
      const eventsToSubmit = [...this.pendingOperationalEvents];
      this.pendingOperationalEvents.length = 0;
      eventsToSubmit.forEach((event) => {
        this.webex.internal.newMetrics.submitOperationalEvent({
          name: `${PRODUCT_NAME_UPPER}_${event.name}`,
          payload: event.payload,
        });
      });
    }
  }

  /**
   * Submits all pending business events if ready.
   * @private
   */
  private async submitPendingBusinessEvents() {
    if (this.pendingBusinessEvents.length === 0) {
      return;
    }
    if (this.readyToSubmitEvents) {
      const eventsToSubmit = [...this.pendingBusinessEvents];
      this.pendingBusinessEvents.length = 0;
      eventsToSubmit.forEach((event) => {
        this.webex.internal.newMetrics.submitBusinessEvent({
          name: `${PRODUCT_NAME_UPPER}_${event.name}`,
          payload: event.payload,
          metadata: {
            appType: PRODUCT_NAME,
          },
        });
      });
    }
  }

  /**
   * Adds a duration property to the event payload if the event was timed.
   * @param eventName - The name of the event.
   * @param options - Optional event payload.
   * @returns The event payload with duration if applicable.
   * @private
   */
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

  /**
   * Converts spaces in a string to underscores.
   * @param str - The input string.
   * @returns The string with spaces replaced by underscores.
   * @public
   * @example
   * MetricsManager.spacesToUnderscore('my event name'); // 'my_event_name'
   */
  static spacesToUnderscore(str: string): string {
    return str.replace(/ /g, '_');
  }

  /**
   * Prepares the event payload by removing empty or undefined fields and adding common metadata.
   * @param obj - The original event payload.
   * @returns The cleaned and enriched event payload.
   * @private
   */
  private static preparePayload(obj: EventPayload): EventPayload {
    const payload: EventPayload = {};

    Object.keys(obj).forEach((key) => {
      if (
        obj[key] !== undefined &&
        obj[key] !== null &&
        obj[key] !== '' &&
        !Array.isArray(obj[key]) &&
        !(typeof obj[key] === 'object' && Object.keys(obj[key]).length === 0)
      ) {
        payload[MetricsManager.spacesToUnderscore(key)] = obj[key];
      }
    });

    if (typeof window === 'undefined') {
      return payload;
    }

    const payloadWithCommonMetadata = {...payload};
    payloadWithCommonMetadata.tabHidden = document.hidden;

    return payloadWithCommonMetadata;
  }

  /**
   * Checks if metrics collection is currently disabled.
   * @returns True if metrics are disabled, false otherwise.
   * @private
   */
  private isMetricsDisabled(): boolean {
    // TODO: SPARK-637285 Need to return true if in development mode to avoid sending metrics to the server
    return this.metricsDisabled;
  }

  /**
   * Enables or disables metrics collection. Clears pending events if disabled.
   * @param disabled - Whether to disable metrics.
   * @public
   * @example
   * MetricsManager.getInstance().setMetricsDisabled(true);
   */
  public setMetricsDisabled(disabled: boolean) {
    this.metricsDisabled = disabled;
    if (disabled) {
      this.clearPendingEvents();
    }
  }

  /**
   * Clears all pending events from the queues.
   * @private
   */
  private clearPendingEvents() {
    this.pendingBehavioralEvents.length = 0;
    this.pendingOperationalEvents.length = 0;
    this.pendingBusinessEvents.length = 0;
  }

  /**
   * Tracks a behavioral event and submits it if possible.
   * @param name - The metric event name.
   * @param options - Optional event payload.
   * @public
   * @example
   * MetricsManager.getInstance().trackBehavioralEvent('AGENT_LOGIN', {agentId: '123'});
   */
  public trackBehavioralEvent(name: METRIC_EVENT_NAMES, options?: EventPayload) {
    if (this.isMetricsDisabled()) {
      return;
    }

    const taxonomy = getEventTaxonomy(name);

    const payload = MetricsManager.preparePayload(this.addDurationIfTimed(name, options));

    this.pendingBehavioralEvents.push({taxonomy, payload});
    this.submitPendingBehavioralEvents();
  }

  /**
   * Tracks an operational event and submits it if possible.
   * @param name - The metric event name.
   * @param options - Optional event payload.
   * @public
   * @example
   * MetricsManager.getInstance().trackOperationalEvent('AGENT_LOGOUT', {agentId: '123'});
   */
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

  /**
   * Tracks a business event and submits it if possible.
   * @param name - The metric event name.
   * @param options - Optional event payload.
   * @public
   * @example
   * MetricsManager.getInstance().trackBusinessEvent('AGENT_TRANSFER', {agentId: '123'});
   */
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

  /**
   * Tracks an event across one or more metric services.
   * @param name - The metric event name.
   * @param payload - Optional event payload.
   * @param metricServices - Array of metric types to track (default: ['behavioral']).
   * @public
   * @example
   * MetricsManager.getInstance().trackEvent('AGENT_LOGIN', {agentId: '123'}, ['behavioral', 'operational']);
   */
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

  /**
   * Starts timing for one or more event keys.
   * @param keys - A string or array of strings representing event keys.
   * @public
   * @example
   * MetricsManager.getInstance().timeEvent('AGENT_LOGIN');
   * MetricsManager.getInstance().timeEvent(['AGENT_LOGIN', 'AGENT_LOGOUT']);
   */
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

  /**
   * Sets the Webex SDK instance and marks the manager as ready when the SDK is ready.
   * @param webex - The Webex SDK instance.
   * @private
   */
  private setWebex(webex: WebexSDK) {
    this.webex = webex;
    if (this.webex.ready) {
      this.setReadyToSubmitEvents();
    }
    this.webex.once('ready', () => {
      this.setReadyToSubmitEvents();
    });
  }

  /**
   * Returns the singleton instance of MetricsManager, initializing it if necessary.
   * @param options - Optional object containing the Webex SDK instance.
   * @returns The singleton MetricsManager instance.
   * @public
   * @example
   * const metrics = MetricsManager.getInstance({webex});
   */
  public static getInstance(options?: {webex: WebexSDK}): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager();
    }

    if (!MetricsManager.instance.webex && options && options.webex) {
      MetricsManager.instance.setWebex(options.webex);
    }

    return MetricsManager.instance;
  }

  /**
   * Resets the singleton instance of MetricsManager. Useful for testing.
   * @public
   * @example
   * MetricsManager.resetInstance();
   */
  public static resetInstance() {
    MetricsManager.instance = undefined;
  }

  /**
   * Extracts common tracking fields from an AQM response object.
   * @param response - The AQM response object.
   * @returns An object containing common tracking fields.
   * @public
   * @example
   * const fields = MetricsManager.getCommonTrackingFieldForAQMResponse(response);
   */
  public static getCommonTrackingFieldForAQMResponse(response: any): Record<string, any> {
    // This method is used to extract common tracking fields from the AQM response
    // and return them as an object. The fields are extracted from the response
    // object and its data property.
    const fields = {
      agentId: response?.data?.agentId || response?.agentId,
      agentSessionId: response?.data?.agentSessionId || response?.agentSessionId,
      teamId: response?.teamId ?? response?.data?.teamId ?? undefined,
      siteId: response?.data?.siteId || response?.siteId,
      orgId: response?.data?.orgId || response?.orgId,
      eventType: response?.type,
      trackingId: response?.data?.trackingId,
      notifTrackingId: response?.trackingId,
    };

    return fields;
  }

  /**
   * Extracts common tracking fields from an AQM failure response object.
   * @param failureResponse - The AQM failure response object.
   * @returns An object containing common tracking fields for failures.
   * @public
   * @example
   * const fields = MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failureResponse);
   */
  public static getCommonTrackingFieldForAQMResponseFailed(
    failureResponse: Failure
  ): Record<string, any> {
    // This method is used to extract common tracking fields from the AQM response failure
    // and return them as an object. The fields are extracted from the response
    // object and its data property.
    const fields = {
      agentId: failureResponse?.data?.agentId,
      trackingId: failureResponse?.trackingId,
      notifTrackingId: failureResponse?.trackingId,
      orgId: failureResponse?.orgId,
      failureType: failureResponse?.type,
      failureReason: failureResponse?.data?.reason,
      reasonCode: failureResponse?.data?.reasonCode,
    };

    return fields;
  }
}
