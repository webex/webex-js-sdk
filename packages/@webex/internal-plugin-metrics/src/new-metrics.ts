/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';

import CallDiagnosticMetrics from './call-diagnostic/call-diagnostic-metrics';
import BehavioralMetrics from './behavioral-metrics';
import OperationalMetrics from './operational-metrics';
import BusinessMetrics from './business-metrics';
import PreLoginMetrics from './prelogin-metrics';
import PreLoginMetricsBatcher from './prelogin-metrics-batcher';
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
  Table,
  DelayedClientEvent,
  DelayedClientFeatureEvent,
  PrivacyAndSecurityPermission,
  PrivacyAndSecurityPermissionProvider,
} from './metrics.types';
import CallDiagnosticLatencies from './call-diagnostic/call-diagnostic-metrics-latencies';
import {setMetricTimings} from './call-diagnostic/call-diagnostic-metrics.util';
import {generateCommonErrorMetadata} from './utils';
import {isAutomatedUser as detectAutomatedUser} from './automated-user';

const CAMERA_AND_MICROPHONE_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.call.initiated',
  'client.media.capabilities',
  'client.ice.end',
  'client.locus.join.request',
  'client.locus.join.response',
  'client.media-engine.ready',
]);

const MEDIA_TX_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.media.tx.start',
  'client.media.tx.stop',
]);

const CONTENT_SHARE_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.share.initiated',
  'client.share.floor-grant.request',
  'client.share.floor-granted.local',
]);

const FINAL_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.call.leave',
  'client.call.remote-ended',
  'client.call.aborted',
]);

type PermissionResource = keyof PrivacyAndSecurityPermission;
type PermissionState = PrivacyAndSecurityPermission[PermissionResource];

const DEFAULT_PERMISSION_SCOPE = 'default';

const isSamePermissionState = (current?: PermissionState, previous?: PermissionState): boolean =>
  current?.status === previous?.status && current?.reason === previous?.reason;

const getPermissionResourcesForEvent = (
  name: ClientEvent['name'],
  payload?: RecursivePartial<ClientEvent['payload']>
): PermissionResource[] => {
  if (CAMERA_AND_MICROPHONE_PERMISSION_EVENTS.has(name)) {
    return ['camera', 'microphone'];
  }

  if (MEDIA_TX_PERMISSION_EVENTS.has(name)) {
    if (payload?.mediaType === 'audio') {
      return ['microphone'];
    }

    if (payload?.mediaType === 'video') {
      return ['camera'];
    }

    if (payload?.mediaType === 'share') {
      return ['contentShare'];
    }

    return [];
  }

  if (CONTENT_SHARE_PERMISSION_EVENTS.has(name)) {
    return payload?.mediaType === 'share' ? ['contentShare'] : [];
  }

  if (FINAL_PERMISSION_EVENTS.has(name)) {
    return ['camera', 'microphone', 'contentShare'];
  }

  return [];
};

const projectPrivacyAndSecurityPermission = (
  permission: PrivacyAndSecurityPermission,
  resources: PermissionResource[]
): PrivacyAndSecurityPermission | undefined => {
  const projectedPermission: PrivacyAndSecurityPermission = {
    ...(resources.includes('camera') && permission.camera ? {camera: {...permission.camera}} : {}),
    ...(resources.includes('microphone') && permission.microphone
      ? {microphone: {...permission.microphone}}
      : {}),
    ...(resources.includes('contentShare') && permission.contentShare
      ? {contentShare: {...permission.contentShare}}
      : {}),
  };

  return Object.keys(projectedPermission).length > 0 ? projectedPermission : undefined;
};

/**
 * Metrics plugin to centralize all types of metrics.
 * https://confluence-eng-gpk2.cisco.com/conf/pages/viewpage.action?pageId=231011379
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
  preLoginMetrics: PreLoginMetrics;
  isReady = false;

  /**
   * Whether or not to delay the submission of client events.
   */
  delaySubmitClientEvents = false;

  /**
   * Whether or not to delay the submission of feature events.
   */
  delaySubmitClientFeatureEvents = false;

  /**
   * Overrides for delayed client events. E.g. if you want to override the correlationId for all delayed client events, you can set this to { correlationId: 'newCorrelationId' }
   */
  delayedClientEventsOverrides: Partial<DelayedClientEvent['options']> = {};

  delayedClientFeatureEventsOverrides: Partial<DelayedClientFeatureEvent['options']> = {};

  private privacyAndSecurityPermissionProvider?: PrivacyAndSecurityPermissionProvider;

  private lastReportedPrivacyAndSecurityPermission = new Map<
    string,
    PrivacyAndSecurityPermission
  >();

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
      this.preLoginMetrics = new PreLoginMetrics(
        // @ts-ignore
        new PreLoginMetricsBatcher({}, {parent: this.webex}),
        {},
        // @ts-ignore
        {parent: this.webex}
      );
      this.isReady = true;
      this.setDelaySubmitClientEvents({
        shouldDelay: this.delaySubmitClientEvents,
        overrides: this.delayedClientEventsOverrides,
      });
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
   * if webex metrics is ready, build behavioral metric backend if not already done.
   */
  private lazyBuildBehavioralMetrics() {
    if (this.isReady && !this.behavioralMetrics) {
      // @ts-ignore
      this.behavioralMetrics = new BehavioralMetrics({}, {parent: this.webex});
    }
  }

  /**
   * if webex metrics is ready, build operational metric backend if not already done.
   */
  private lazyBuildOperationalMetrics() {
    if (this.isReady && !this.operationalMetrics) {
      // @ts-ignore
      this.operationalMetrics = new OperationalMetrics({}, {parent: this.webex});
    }
  }

  /**
   * if webex metrics is ready, build business metric backend if not already done.
   */
  private lazyBuildBusinessMetrics() {
    if (this.isReady && !this.businessMetrics) {
      // @ts-ignore
      this.businessMetrics = new BusinessMetrics({}, {parent: this.webex});
    }
  }

  /**
   * @returns true once we have the deviceId we need to submit behavioral events to Amplitude
   */
  isReadyToSubmitBehavioralEvents() {
    this.lazyBuildBehavioralMetrics();

    return this.behavioralMetrics?.isReadyToSubmitEvents() ?? false;
  }

  /**
   * @returns true once we have the deviceId we need to submit operational events
   */
  isReadyToSubmitOperationalEvents() {
    this.lazyBuildOperationalMetrics();

    return this.operationalMetrics?.isReadyToSubmitEvents() ?? false;
  }

  /**
   * @returns true once we have the deviceId we need to submit business events
   */
  isReadyToSubmitBusinessEvents() {
    this.lazyBuildBusinessMetrics();

    return this.businessMetrics?.isReadyToSubmitEvents() ?? false;
  }

  /**
   * @returns whether the current user agent belongs to an automated user
   */
  isAutomatedUser() {
    return detectAutomatedUser();
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

    this.lazyBuildBehavioralMetrics();

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

    this.lazyBuildOperationalMetrics();

    return this.operationalMetrics.submitOperationalEvent({name, payload});
  }

  /**
   * Business event
   * @param args
   */
  submitBusinessEvent({
    name,
    payload,
    table,
    metadata,
  }: {
    name: string;
    payload: EventPayload;
    table?: Table;
    metadata?: EventPayload;
  }) {
    if (!this.isReady) {
      // @ts-ignore
      this.webex.logger.log(
        `NewMetrics: @submitBusinessEvent. Attempted to submit before webex.ready: ${name}`
      );

      return Promise.resolve();
    }

    this.lazyBuildBusinessMetrics();

    return this.businessMetrics.submitBusinessEvent({name, payload, table, metadata});
  }

  /**
   * Call Analyzer: Pre-Login Event
   * @param args
   */
  submitPreLoginEvent({
    name,
    preLoginId,
    payload,
    metadata,
  }: {
    name: string;
    preLoginId: string;
    payload: EventPayload;
    metadata?: EventPayload;
  }): Promise<void> {
    if (!this.isReady) {
      // @ts-ignore
      this.webex.logger.log(
        `NewMetrics: @submitPreLoginEvent. Attempted to submit before webex.ready: ${name}`
      );

      return Promise.resolve();
    }

    return this.preLoginMetrics.submitPreLoginEvent({
      name,
      preLoginId,
      payload,
      metadata,
    });
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
    if (!this.callDiagnosticLatencies || !this.callDiagnosticMetrics) {
      // @ts-ignore
      this.webex.logger.log(
        `NewMetrics: @submitFeatureEvent. Attempted to submit before webex.ready. Event name: ${name}`
      );

      return Promise.resolve();
    }
    this.callDiagnosticLatencies.saveTimestamp({
      key: name,
      options: {meetingId: options?.meetingId},
    });

    return this.callDiagnosticMetrics.submitFeatureEvent({
      name,
      payload,
      options,
      delaySubmitEvent: this.delaySubmitClientFeatureEvents,
    });
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

    const enrichedPayload = this.addPrivacyAndSecurityPermission({name, payload, options});

    return this.callDiagnosticMetrics.submitClientEvent({
      name,
      payload: enrichedPayload,
      options,
      delaySubmitEvent: this.delaySubmitClientEvents,
    });
  }

  /**
   * Registers a provider for the latest browser permission state.
   * @param provider permission snapshot provider, or undefined to clear it
   */
  public setPrivacyAndSecurityPermissionProvider(
    provider?: PrivacyAndSecurityPermissionProvider
  ): void {
    this.privacyAndSecurityPermissionProvider = provider;
    this.lastReportedPrivacyAndSecurityPermission.clear();
  }

  /**
   * Resolves event options to the call identity used by Call Diagnostic where possible.
   * @param options client event options
   * @returns the permission history scope
   */
  private getPermissionScope(options?: SubmitClientEventOptions): string {
    const meeting = options?.meetingId
      ? (this as any).webex.meetings?.getBasicMeetingInformation?.(options.meetingId)
      : undefined;

    return options?.correlationId ?? meeting?.correlationId ?? DEFAULT_PERMISSION_SCOPE;
  }

  /**
   * Adds the relevant permission resources to an eligible client event.
   * @param args client event name and payload
   * @returns the original or enriched payload
   */
  private addPrivacyAndSecurityPermission({
    name,
    payload,
    options,
  }: {
    name: ClientEvent['name'];
    payload?: RecursivePartial<ClientEvent['payload']>;
    options?: SubmitClientEventOptions;
  }): RecursivePartial<ClientEvent['payload']> | undefined {
    const scope = this.getPermissionScope(options);
    const isFinalEvent = FINAL_PERMISSION_EVENTS.has(name);

    if (payload?.privacyAndSecurityPermission !== undefined) {
      if (isFinalEvent) {
        this.lastReportedPrivacyAndSecurityPermission.delete(scope);
      } else {
        this.lastReportedPrivacyAndSecurityPermission.set(scope, {
          ...this.lastReportedPrivacyAndSecurityPermission.get(scope),
          ...(payload.privacyAndSecurityPermission as PrivacyAndSecurityPermission),
        });
      }

      return payload;
    }

    const resources = getPermissionResourcesForEvent(name, payload);

    if (!this.privacyAndSecurityPermissionProvider || resources.length === 0) {
      if (isFinalEvent) {
        this.lastReportedPrivacyAndSecurityPermission.delete(scope);
      }

      return payload;
    }

    try {
      const permission = this.privacyAndSecurityPermissionProvider();
      const projectedPermission = permission
        ? projectPrivacyAndSecurityPermission(permission, resources)
        : undefined;

      if (!projectedPermission) {
        return payload;
      }

      if (isFinalEvent) {
        this.lastReportedPrivacyAndSecurityPermission.delete(scope);

        return {...payload, privacyAndSecurityPermission: projectedPermission};
      }

      const lastReported = this.lastReportedPrivacyAndSecurityPermission.get(scope) ?? {};
      const changedPermission: PrivacyAndSecurityPermission = {
        ...(resources.includes('camera') &&
        projectedPermission.camera &&
        !isSamePermissionState(projectedPermission.camera, lastReported.camera)
          ? {camera: {...projectedPermission.camera}}
          : {}),
        ...(resources.includes('microphone') &&
        projectedPermission.microphone &&
        !isSamePermissionState(projectedPermission.microphone, lastReported.microphone)
          ? {microphone: {...projectedPermission.microphone}}
          : {}),
        ...(resources.includes('contentShare') &&
        projectedPermission.contentShare &&
        !isSamePermissionState(projectedPermission.contentShare, lastReported.contentShare)
          ? {contentShare: {...projectedPermission.contentShare}}
          : {}),
      };

      if (Object.keys(changedPermission).length === 0) {
        return payload;
      }

      this.lastReportedPrivacyAndSecurityPermission.set(scope, {
        ...lastReported,
        ...changedPermission,
      });

      return {...payload, privacyAndSecurityPermission: changedPermission};
    } catch (error) {
      if (isFinalEvent) {
        this.lastReportedPrivacyAndSecurityPermission.delete(scope);
      }
      // @ts-ignore
      this.webex.logger.error(
        'NewMetrics: @submitClientEvent. Privacy and security permission provider failed.',
        error
      );

      return payload;
    }
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

  /**
   * Sets the value of delaySubmitClientEvents. If set to true, client events will be delayed until submitDelayedClientEvents is called. If
   * set to false, delayed client events will be submitted.
   *
   * @param {object} options - {shouldDelay: A boolean value indicating whether to delay the submission of client events, overrides: An object containing overrides for the client events}
   */
  public setDelaySubmitClientEvents({
    shouldDelay,
    overrides,
  }: {
    shouldDelay: boolean;
    overrides?: Partial<DelayedClientEvent['options']>;
  }) {
    this.delaySubmitClientEvents = shouldDelay;
    this.delayedClientEventsOverrides = overrides || {};

    if (this.isReady && !shouldDelay) {
      return this.callDiagnosticMetrics.submitDelayedClientEvents(overrides);
    }

    return Promise.resolve();
  }

  /**
   * Sets the value of setDelaySubmitClientFeatureEvents.
   * If set to true, feature events will be delayed until submitDelayedClientFeatureEvents is called.
   * If set to false, delayed feature events will be submitted.
   *
   * @param {object} options - {shouldDelay: A boolean value indicating whether to delay the submission of feature events,
   * overrides: An object containing overrides for the feature events}
   */
  public setDelaySubmitClientFeatureEvents({
    shouldDelay,
    overrides,
  }: {
    shouldDelay: boolean;
    overrides?: Partial<DelayedClientFeatureEvent['options']>;
  }) {
    this.delaySubmitClientFeatureEvents = shouldDelay;
    this.delayedClientFeatureEventsOverrides = overrides || {};

    if (this.isReady && !shouldDelay) {
      return this.callDiagnosticMetrics.submitDelayedClientFeatureEvents(overrides);
    }

    return Promise.resolve();
  }
}

export default Metrics;
