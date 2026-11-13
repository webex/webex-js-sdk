/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import type {IdentityProvider} from '@webex/internal-plugin-identity';

import TypedEventsScope from '../common/events/typed-events-scope';
import LoggerProxy from '../common/logs/logger-proxy';
import Metrics from '../metrics';
import BEHAVIORAL_METRICS from '../metrics/constants';
import {EVENT_TRIGGERS} from '../constants';
import MLS, {type MLSEvent, type MLSEventMap} from './mls';
import MediaEncryptionService from './MediaEncryptionService';
import E2eeSignaling from './E2eeSignaling';
import {MEDIA_SERVICE_DEVICE_TYPE} from './constants';
import MeetingsUtil from '../meetings/util';
import type WasmLoader from '../common/wasm-loader';
import type {
  E2eeControllerEvent,
  E2eeControllerEventMap,
  E2eeMeetingContext,
  E2eeState,
} from './types';

const TRIGGER_SCOPE = {file: 'e2ee/E2eeController', function: 'e2ee'};

/**
 * Per-meeting E2EE controller (owned by Meeting as `this.e2ee`). It orchestrates the MLS engine, the
 * signaling adapter and the HTTP transport for one meeting, exposes the security code, media-service
 * presence and lifecycle state, and re-emits E2EE events on the meeting. Its start() is a no-op
 * unless the meeting requires E2EE (a V2/zero-trust meeting) and E2EE is enabled and supported.
 */
export default class E2eeController extends TypedEventsScope<E2eeControllerEventMap> {
  private readonly context: E2eeMeetingContext;

  private readonly webex: any;

  private readonly wasmLoader: WasmLoader;

  private readonly wasmUrl: string;

  private readonly identityProvider: IdentityProvider;

  private mlsSession?: MLS;

  private signaling?: E2eeSignaling;

  private sessionUnsubscribers: Array<() => void> = [];

  private currentState: E2eeState = 'disabled';

  private securityCode?: string;

  private mediaServicesPresent = false;

  // Incremented by every start() and stop(); an in-flight start() whose attempt is no longer the
  // latest was cancelled by stop() while it was awaiting, and must not continue.
  private startAttempt = 0;

  /**
   * @param {Object} deps
   * @param {E2eeMeetingContext} deps.context - The meeting data and operations used by E2EE.
   * @param {Object} deps.webex - The parent webex instance.
   * @param {WasmLoader} deps.wasmLoader - Shared (pre-warmed) WASM loader.
   * @param {string} deps.wasmUrl - URL of the E2EE WASM module.
   * @param {IdentityProvider} deps.identityProvider - Shared identity/credential provider.
   */
  constructor({
    context,
    webex,
    wasmLoader,
    wasmUrl,
    identityProvider,
  }: {
    context: E2eeMeetingContext;
    webex: any;
    wasmLoader: WasmLoader;
    wasmUrl: string;
    identityProvider: IdentityProvider;
  }) {
    super();
    this.context = context;
    this.webex = webex;
    this.wasmLoader = wasmLoader;
    this.wasmUrl = wasmUrl;
    this.identityProvider = identityProvider;
  }

  /**
   * @returns {E2eeState} the current E2EE lifecycle state.
   */
  get state(): E2eeState {
    return this.currentState;
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
   * Refreshes the LLM channel used for MLS signaling after Meeting changes its channel.
   * @returns {void}
   */
  llmChannelChanged(): void {
    this.signaling?.setLlmChannel(this.context.getLlmChannel());
  }

  /**
   * @returns {boolean} whether this meeting requires an MLS join (V2/zero-trust) and E2EE is enabled.
   */
  private required(): boolean {
    const locusInfo = this.context.getLocusInfo();

    return (
      MeetingsUtil.isE2eeEnabledAndSupported(this.webex?.config) &&
      !!locusInfo?.info?.isV2E2EEncrypted &&
      !!locusInfo?.info?.mediaEncryptionGroupUrl
    );
  }

  /**
   * Starts the MLS session for this meeting. Idempotent and self-guarded: a no-op unless the
   * meeting requires E2EE, and while a session is already starting or running. Never rejects —
   * failures transition to the `failed` state and emit an E2EE failure event. Calling it again
   * from `failed` or `evicted` retries with a fresh MLS session.
   * @returns {Promise<void>}
   */
  async start(): Promise<void> {
    if (
      this.currentState === 'initializing' ||
      this.currentState === 'joining' ||
      this.currentState === 'joined'
    ) {
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
    this.startAttempt += 1;
    const attempt = this.startAttempt;
    const isCancelled = () => attempt !== this.startAttempt;
    // Awaits a startup step, then aborts start() (via the catch below) if stop() ran meanwhile.
    const step = async <T>(promise: Promise<T>): Promise<T> => {
      const result = await promise;

      if (isCancelled()) {
        throw new Error('E2EE start cancelled');
      }

      return result;
    };

    this.setState('initializing');

    try {
      const {device} = this.webex.internal;
      const [, credentials] = await step(
        Promise.all([
          this.wasmLoader.get(this.wasmUrl),
          this.identityProvider.getCredentials(device.userId),
        ])
      );

      const httpClient = new MediaEncryptionService({
        webexRequest: this.webex.request.bind(this.webex),
      });
      const session = new MLS({
        httpClient,
        loadModule: () => this.wasmLoader.get(this.wasmUrl),
      });
      const mediaEncryptionGroupUrl = this.context.getLocusInfo()?.info?.mediaEncryptionGroupUrl;

      if (!mediaEncryptionGroupUrl) {
        throw new Error('Meeting locus has no media encryption group URL');
      }

      this.mlsSession = session;
      this.setupMlsSessionListeners(session);

      // If cancelled, stop() has already left and detached this session.
      await step(
        session.initialize({
          participantId: device.userId,
          deviceUrl: device.url,
          deviceType: this.webex.config.meetings.deviceType,
          correlationId: this.context.correlationId,
          displayName: this.getSelfDisplayName(),
          serviceUrl: mediaEncryptionGroupUrl,
          credentials,
          trustAnchors: this.identityProvider.getTrustAnchors(),
        })
      );

      this.signaling = new E2eeSignaling({
        llm: this.context.getLlmChannel(),
        mercury: this.webex.internal.mercury,
        getLocusUrl: () => this.context.getLocusInfo()?.url,
        session,
      });
      this.signaling.start();

      this.setState('joining');
      session.join();
    } catch (error) {
      if (isCancelled()) {
        LoggerProxy.logger.info(
          'e2ee: E2eeController#start --> cancelled by stop() during startup'
        );

        return;
      }

      LoggerProxy.logger.error(`e2ee: E2eeController#start --> failed to start E2EE: ${error}`);
      this.handleFatal('failed', 'startFailed', {errorMessage: error?.message ?? String(error)});
    }
  }

  /**
   * Tears down the MLS session and resets state, cancelling a start() that is still in progress.
   * Idempotent.
   * @returns {Promise<void>}
   */
  async stop(): Promise<void> {
    if (this.currentState === 'disabled') {
      // E2EE was never started (not required for this meeting, or still pre-join). Nothing to tear
      // down, and we stay silent so callers can invoke stop() unconditionally without log noise.
      return;
    }

    LoggerProxy.logger.info('e2ee: E2eeController#stop --> stopping E2EE session');
    this.startAttempt += 1;
    this.cleanupSession();
    this.setState('left');
  }

  /**
   * @param {MLS} session
   * @returns {void}
   */
  private setupMlsSessionListeners(session: MLS): void {
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
      this.updateFromRoster();
    });
    subscribe('rosterRemoved', ({urls}) => {
      this.updateFromRoster();
    });

    subscribe('joinFailure', ({reason}) => this.handleFatal('failed', reason));
    subscribe('mediaEncryptionServiceFailure', ({errorCode, message}) =>
      this.handleFatal('failed', 'mediaEncryptionServiceFailure', {
        errorCode,
        errorMessage: message,
      })
    );
    subscribe('evicted', () => this.handleFatal('evicted', 'evicted'));
  }

  /**
   * Recomputes media-service presence and MLS-join completion from the current roster. MLS join is
   * complete only once our own device URL appears in the roster.
   * @returns {void}
   */
  private updateFromRoster(): void {
    if (!this.mlsSession) {
      return;
    }

    const roster = this.mlsSession.getRoster();

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
   * @param {Object} [details] - Extra diagnostics included only in the behavioral metric.
   * @param {number} [details.errorCode] - Media-encryption service error code.
   * @param {string} [details.error] - Error message.
   * @returns {void}
   */
  private handleFatal(
    state: 'failed' | 'evicted',
    reason: string,
    details: {errorCode?: number; errorMessage?: string} = {}
  ): void {
    LoggerProxy.logger.error(
      `e2ee: E2eeController --> fatal E2EE error: state=${state} reason=${reason} details=`,
      details
    );
    Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.E2EE_FAILURE, {
      correlation_id: this.context.correlationId,
      state,
      reason,
      ...details,
    });
    this.cleanupSession();
    this.setState(state);
    this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_FAILURE, {reason, ...details});
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

    const {mlsSession} = this;

    this.mlsSession = undefined;

    try {
      mlsSession?.leave();
    } catch (error) {
      LoggerProxy.logger.warn(`e2ee: E2eeController --> error leaving MLS session: ${error}`);
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

  private emitE2eeEvent<K extends E2eeControllerEvent>(
    event: K,
    payload: E2eeControllerEventMap[K]
  ): void {
    LoggerProxy.logger.info(`e2ee: E2eeController --> emitting event: ${event}`);
    this.emit(TRIGGER_SCOPE, event, payload);
  }
}
