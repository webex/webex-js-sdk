/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import type {IdentityProvider} from '@webex/internal-plugin-identity';

import EventsScope from '../common/events/events-scope';
import Trigger from '../common/events/trigger-proxy';
import LoggerProxy from '../common/logs/logger-proxy';
import Metrics from '../metrics';
import BEHAVIORAL_METRICS from '../metrics/constants';
import StaticAssetLoader from '../common/static-asset-loader';
import {EVENT_TRIGGERS} from '../constants';
import MLS, {type MLSEvent, type MLSEventMap} from './mls';
import MediaEncryptionService from './MediaEncryptionService';
import E2eeSignaling from './E2eeSignaling';
import MemberMLSReconciler from './MemberMLSReconciler';
import {
  DOMAIN_NAME_ROOTS_P7B_ASSET,
  E2EE_WASM_ASSET,
  isE2eeEnabledAndSupported,
  MEDIA_SERVICE_DEVICE_TYPE,
} from './constants';
import type WasmLoader from '../common/wasm-loader';
import type {E2eeConfig, E2eeMeetingContext, E2eeState} from './types';

const DEVICE_TYPE = 'WEB';
const TRIGGER_SCOPE = {file: 'e2ee/E2eeController', function: 'e2ee'};

/**
 * Per-meeting E2EE facade (owned by Meeting as `this.e2ee`). It orchestrates the MLS engine, the
 * signaling adapter and the HTTP transport for one meeting, exposes the security code, media-service
 * presence and lifecycle state, and re-emits E2EE events on the meeting. Its start() is a no-op
 * unless the meeting requires E2EE (a V2/zero-trust meeting) and E2EE is enabled in config.
 */
export default class E2eeController extends EventsScope {
  private readonly context: E2eeMeetingContext;

  private readonly webex: any;

  private readonly wasmLoader: WasmLoader;

  private readonly assetLoader: StaticAssetLoader;

  private readonly identityProvider: IdentityProvider;

  private readonly config: E2eeConfig;

  private session?: MLS;

  private signaling?: E2eeSignaling;

  private reconciler?: MemberMLSReconciler;

  private sessionUnsubscribers: Array<() => void> = [];

  private currentState: E2eeState = 'disabled';

  private securityCode?: string;

  private mediaServicesPresent = false;

  /**
   * @param {Object} deps
   * @param {E2eeMeetingContext} deps.context - The meeting data and operations used by E2EE.
   * @param {Object} deps.webex - The parent webex instance.
   * @param {WasmLoader} deps.wasmLoader - Shared (pre-warmed) WASM loader.
   * @param {StaticAssetLoader} deps.assetLoader - Shared loader for plugin-meetings static assets.
   * @param {IdentityProvider} deps.identityProvider - Shared identity/credential provider.
   * @param {E2eeConfig} deps.config - The meetings plugin config.
   */
  constructor({
    context,
    webex,
    wasmLoader,
    assetLoader,
    identityProvider,
    config,
  }: {
    context: E2eeMeetingContext;
    webex: any;
    wasmLoader: WasmLoader;
    assetLoader: StaticAssetLoader;
    identityProvider: IdentityProvider;
    config: E2eeConfig;
  }) {
    super();
    this.context = context;
    this.webex = webex;
    this.wasmLoader = wasmLoader;
    this.assetLoader = assetLoader;
    this.identityProvider = identityProvider;
    this.config = config;

    if (isE2eeEnabledAndSupported(!!config.enableE2ee)) {
      // Created eagerly (not on join) and registered as the Members pre-emit processor, so member
      // verification is stamped into every members:update - even for member changes outside a
      // joined meeting. Roster-driven verification changes are reported back through Members too.
      this.reconciler = new MemberMLSReconciler({
        membersCollection: context.members.membersCollection,
        reportMembersUpdated: (members) => context.members.reportMembersUpdated(members),
      });
      context.members.setMembersUpdateProcessor((payload) =>
        this.reconciler?.processMembersUpdate(payload)
      );
    }
  }

  /**
   * @returns {E2eeState} the current E2EE lifecycle state.
   */
  get state(): E2eeState {
    return this.currentState;
  }

  /**
   * @returns {boolean} whether E2EE is enabled via config.
   */
  get isEnabled(): boolean {
    return isE2eeEnabledAndSupported(!!this.config.enableE2ee);
  }

  /**
   * @returns {boolean} whether the MLS roster contains a media service currently considered untrusted.
   */
  get hasUntrustedMediaServices(): boolean {
    // For now, assume every media service is untrusted. Determining which services are trusted is
    // tracked by SPARK-863974.
    return this.mediaServicesPresent;
  }

  /**
   * @returns {string|undefined} the meeting security code, once available.
   */
  getSecurityCode(): string | undefined {
    return this.securityCode;
  }

  /**
   * Emits an E2EE event on the facade so it can be observed directly or forwarded by Meeting.
   * @param {string} event
   * @param {object} payload
   * @returns {void}
   */
  trigger(event: string, payload: object): void {
    this.emit(TRIGGER_SCOPE, event, payload);
  }

  /**
   * @returns {boolean} whether this meeting requires an MLS join (V2/zero-trust) and E2EE is enabled.
   */
  private required(): boolean {
    const locusInfo = this.context.getLocusInfo();

    return (
      isE2eeEnabledAndSupported(!!this.config.enableE2ee) &&
      !!locusInfo?.info?.isV2E2EEncrypted &&
      !!locusInfo?.info?.mediaEncryptionGroupUrl
    );
  }

  /**
   * Loads the signed domain-name roots bundle. This bundle is used to verify some remote
   * participant identities, but is optional for joining the MLS group.
   * @returns {Promise<Uint8Array>}
   */
  private async loadDomainNameRootsP7b(): Promise<Uint8Array> {
    try {
      return await this.assetLoader.getBytes(DOMAIN_NAME_ROOTS_P7B_ASSET);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      LoggerProxy.logger.warn(
        `e2ee: E2eeController#loadDomainNameRootsP7b --> failed to load ${DOMAIN_NAME_ROOTS_P7B_ASSET}; continuing without it`,
        error
      );

      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.E2EE_DOMAIN_NAME_ROOTS_LOAD_FAILURE, {
        correlationId: this.context.correlationId,
        reason,
      });

      return new Uint8Array();
    }
  }

  /**
   * Starts the MLS session for this meeting. Idempotent and self-guarded: a no-op unless the
   * meeting requires E2EE. Never rejects — failures transition to the `failed` state and emit an
   * E2EE failure event.
   * @returns {Promise<void>}
   */
  async start(): Promise<void> {
    if (this.currentState !== 'disabled' && this.currentState !== 'left') {
      LoggerProxy.logger.info(
        `e2ee: E2eeController#start --> ignoring, already in state: ${this.currentState}`
      );

      return;
    }
    if (!this.required()) {
      LoggerProxy.logger.info(
        'e2ee: E2eeController#start --> not required for this meeting, skipping'
      );

      return;
    }

    LoggerProxy.logger.info('e2ee: E2eeController#start --> starting E2EE session');
    this.setState('initializing');

    try {
      const wasmUrl = this.assetLoader.getUrl(E2EE_WASM_ASSET);
      const {device} = this.webex.internal;
      const [, credentials, domainNameRootsP7b] = await Promise.all([
        this.wasmLoader.get(wasmUrl),
        this.identityProvider.getCredentials(device.userId),
        this.loadDomainNameRootsP7b(),
      ]);
      const httpClient = new MediaEncryptionService({
        webexRequest: this.webex.request.bind(this.webex),
      });
      const session = new MLS({
        httpClient,
        wasmLoader: this.wasmLoader,
        wasmUrl,
      });
      const mediaEncryptionGroupUrl = this.context.getLocusInfo()?.info?.mediaEncryptionGroupUrl;

      if (!mediaEncryptionGroupUrl) {
        throw new Error('Meeting locus has no media encryption group URL');
      }

      this.session = session;
      this.wireSessionEvents(session);

      await session.initialize({
        participantId: device.userId,
        deviceUrl: device.url,
        deviceType: DEVICE_TYPE,
        correlationId: this.context.correlationId,
        displayName: this.getSelfDisplayName(),
        serviceUrl: mediaEncryptionGroupUrl,
        credentials,
        trustAnchors: {
          ...this.identityProvider.getTrustAnchors(),
          domainNameRootsP7b,
        },
      });

      this.signaling = new E2eeSignaling({
        llm: this.webex.internal.llm,
        mercury: this.webex.internal.mercury,
        getLocusUrl: () => this.context.getLocusInfo()?.url,
        session,
      });
      this.signaling.start();

      this.setState('joining');
      session.join();
    } catch (error) {
      LoggerProxy.logger.error(`e2ee: E2eeController#start --> failed to start E2EE: ${error}`);
      this.handleFatal('failed', 'startFailed');
    }
  }

  /**
   * Tears down the MLS session and resets state. Idempotent.
   * @returns {Promise<void>}
   */
  async stop(): Promise<void> {
    LoggerProxy.logger.info('e2ee: E2eeController#stop --> stopping E2EE session');
    this.cleanupSession();

    if (this.currentState !== 'disabled') {
      this.setState('left');
    }
  }

  /**
   * @param {MLS} session
   * @returns {void}
   */
  private wireSessionEvents(session: MLS): void {
    const subscribe = <K extends MLSEvent>(
      event: K,
      listener: (payload: MLSEventMap[K]) => void
    ) => {
      session.on(event, listener);
      this.sessionUnsubscribers.push(() => session.off(event, listener));
    };

    subscribe('joinSuccess', ({securityCode}) => {
      this.securityCode = securityCode;
      this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED, {securityCode});
      this.updateFromRoster();
    });

    subscribe('securityCodeChanged', ({code}) => {
      this.securityCode = code;
      this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED, {securityCode: code});
    });

    subscribe('rosterAdded', (added) => {
      this.reconciler?.applyRosterAdded(added);
      this.updateFromRoster();
    });
    subscribe('rosterRemoved', ({urls}) => {
      this.reconciler?.applyRosterRemoved(urls);
      this.updateFromRoster();
    });

    subscribe('joinFailure', ({reason}) => this.handleFatal('failed', reason));
    subscribe('evicted', () => this.handleFatal('evicted', 'evicted'));
  }

  /**
   * Recomputes media-service presence and MLS-join completion from the current roster. MLS join is
   * complete only once our own device URL appears in the roster.
   * @returns {void}
   */
  private updateFromRoster(): void {
    if (!this.session) {
      return;
    }

    const roster = this.session.getRoster();

    const hasMediaServices = roster.some(
      (member) => member.deviceType === MEDIA_SERVICE_DEVICE_TYPE
    );

    if (hasMediaServices !== this.mediaServicesPresent) {
      this.mediaServicesPresent = hasMediaServices;
      this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_MEDIA_SERVICES_CHANGED, {hasMediaServices});
    }

    if (this.currentState === 'joining') {
      const ownDeviceUrl = this.webex.internal.device.url;

      if (roster.some((member) => member.url === ownDeviceUrl)) {
        this.setState('joined');
      }
    }
  }

  /**
   * @param {E2eeState} state
   * @param {string} reason
   * @returns {void}
   */
  private handleFatal(state: 'failed' | 'evicted', reason: string): void {
    LoggerProxy.logger.error(
      `e2ee: E2eeController --> fatal E2EE error: state=${state} reason=${reason}`
    );
    this.cleanupSession();
    this.setState(state);
    this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_FAILURE, {reason});
  }

  /**
   * Stops signaling, detaches session listeners, leaves the MLS group, and resets roster state.
   * @returns {void}
   */
  private cleanupSession(): void {
    try {
      this.signaling?.stop();
    } catch (error) {
      LoggerProxy.logger.warn(`e2ee: E2eeController --> error stopping signaling: ${error}`);
    }
    this.signaling = undefined;

    this.sessionUnsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        LoggerProxy.logger.warn(`e2ee: E2eeController --> error removing MLS listener: ${error}`);
      }
    });
    this.sessionUnsubscribers = [];

    const {session} = this;

    this.session = undefined;

    try {
      session?.leave();
    } catch (error) {
      LoggerProxy.logger.warn(`e2ee: E2eeController --> error leaving MLS session: ${error}`);
    }

    try {
      this.reconciler?.reset();
    } catch (error) {
      LoggerProxy.logger.warn(
        `e2ee: E2eeController --> error resetting member verification: ${error}`
      );
    }

    if (this.mediaServicesPresent) {
      this.mediaServicesPresent = false;
      this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_MEDIA_SERVICES_CHANGED, {
        hasMediaServices: false,
      });
    }
  }

  /**
   * Clears a security code that is no longer valid for the current MLS session.
   * @returns {void}
   */
  private clearSecurityCode(): void {
    if (this.securityCode === undefined) {
      return;
    }

    this.securityCode = undefined;
    this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED, {
      securityCode: undefined,
    });
  }

  /**
   * @returns {string} the self participant's display name, or '' if unavailable.
   */
  private getSelfDisplayName(): string {
    return this.context.members.membersCollection.get(this.context.members.selfId)?.name ?? '';
  }

  /**
   * @param {E2eeState} state
   * @returns {void}
   */
  private setState(state: E2eeState): void {
    if (this.currentState === state) {
      return;
    }

    if (state === 'failed' || state === 'evicted' || state === 'left') {
      this.clearSecurityCode();
    }

    LoggerProxy.logger.info(
      `e2ee: E2eeController --> state changed: ${this.currentState} -> ${state}`
    );
    this.currentState = state;
    this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_STATE_CHANGED, {state});
  }

  /**
   * @param {string} event
   * @param {object} payload
   * @returns {void}
   */
  private emitE2eeEvent(event: string, payload: object): void {
    LoggerProxy.logger.info(`e2ee: E2eeController --> emitting event: ${event}`);
    Trigger.trigger(this, TRIGGER_SCOPE, event, payload);
  }
}
