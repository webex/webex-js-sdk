/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import Trigger from '../common/events/trigger-proxy';
import LoggerProxy from '../common/logs/logger-proxy';
import {EVENT_TRIGGERS} from '../constants';
import MlsGroupSession from './MlsGroupSession';
import MediaEncryptionService from './MediaEncryptionService';
import E2eeSignaling from './E2eeSignaling';
import {MEDIA_SERVICE_DEVICE_TYPE} from './constants';
import type E2eeIdentityProvider from './E2eeIdentityProvider';
import type {IWasmLoader} from './WasmLoader';
import type {E2eeConfig, E2eeState} from './types';

const DEVICE_TYPE = 'WEB';
const TRIGGER_SCOPE = {file: 'e2ee/E2eeMeeting', function: 'e2ee'};

/**
 * Per-meeting E2EE facade (owned by Meeting as `this.e2ee`). It orchestrates the MLS engine, the
 * signaling adapter and the HTTP transport for one meeting, exposes the security code, media-service
 * presence and lifecycle state, and re-emits E2EE events on the meeting. Its start() is a no-op
 * unless the meeting requires E2EE (a V2/zero-trust meeting) and E2EE is enabled in config.
 */
export default class E2eeMeeting {
  private readonly meeting: any;

  private readonly webex: any;

  private readonly wasmLoader: IWasmLoader;

  private readonly identityProvider: E2eeIdentityProvider;

  private readonly config: E2eeConfig;

  private session?: MlsGroupSession;

  private signaling?: E2eeSignaling;

  private currentState: E2eeState = 'disabled';

  private securityCode?: string;

  private mediaServicesPresent = false;

  /**
   * @param {Object} deps
   * @param {Object} deps.meeting - The owning meeting.
   * @param {Object} deps.webex - The parent webex instance.
   * @param {IWasmLoader} deps.wasmLoader - Shared (pre-warmed) WASM loader.
   * @param {E2eeIdentityProvider} deps.identityProvider - Shared identity/credential provider.
   * @param {E2eeConfig} deps.config - The meetings plugin config.
   */
  constructor({
    meeting,
    webex,
    wasmLoader,
    identityProvider,
    config,
  }: {
    meeting: any;
    webex: any;
    wasmLoader: IWasmLoader;
    identityProvider: E2eeIdentityProvider;
    config: E2eeConfig;
  }) {
    this.meeting = meeting;
    this.webex = webex;
    this.wasmLoader = wasmLoader;
    this.identityProvider = identityProvider;
    this.config = config;
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
    return !!this.config.enableE2ee;
  }

  /**
   * @returns {boolean} whether the MLS roster currently contains a media service.
   */
  get hasMediaServices(): boolean {
    return this.mediaServicesPresent;
  }

  /**
   * @returns {string|undefined} the meeting security code, once available.
   */
  getSecurityCode(): string | undefined {
    return this.securityCode;
  }

  /**
   * @returns {boolean} whether this meeting requires an MLS join (V2/zero-trust) and E2EE is enabled.
   */
  private required(): boolean {
    const info = this.meeting?.locusInfo?.info;

    return !!this.config.enableE2ee && !!info?.isV2E2EEncrypted && !!info?.mediaEncryptionGroupUrl;
  }

  /**
   * Starts the MLS session for this meeting. Idempotent and self-guarded: a no-op unless the
   * meeting requires E2EE. Never rejects — failures transition to the `failed` state and emit an
   * E2EE failure event.
   * @returns {Promise<void>}
   */
  async start(): Promise<void> {
    if (this.currentState !== 'disabled' && this.currentState !== 'left') {
      return;
    }
    if (!this.required()) {
      return;
    }

    this.setState('initializing');

    try {
      await this.wasmLoader.get();

      const {device} = this.webex.internal;
      const credentials = await this.identityProvider.getCredentials(device.userId);
      const httpClient = new MediaEncryptionService({webex: this.webex});
      const session = new MlsGroupSession({httpClient, wasmLoader: this.wasmLoader});

      this.session = session;
      this.wireSessionEvents(session);

      await session.initialize({
        participantId: device.userId,
        deviceUrl: device.url,
        deviceType: DEVICE_TYPE,
        correlationId: this.meeting.correlationId,
        displayName: this.getSelfDisplayName(),
        serviceUrl: this.meeting.locusInfo.info.mediaEncryptionGroupUrl,
        credentials,
        trustAnchors: this.identityProvider.getTrustAnchors(),
      });

      this.signaling = new E2eeSignaling({webex: this.webex, meeting: this.meeting, session});
      this.signaling.start();

      this.setState('joining');
      session.join();
    } catch (error) {
      LoggerProxy.logger.error(`E2eeMeeting#start --> failed to start E2EE: ${error}`);
      this.setState('failed');
      this.emit(EVENT_TRIGGERS.MEETING_E2EE_FAILURE, {reason: 'startFailed'});
    }
  }

  /**
   * Tears down the MLS session and resets state. Idempotent.
   * @returns {Promise<void>}
   */
  async stop(): Promise<void> {
    this.signaling?.stop();

    try {
      this.session?.leave();
    } catch (error) {
      LoggerProxy.logger.warn(`E2eeMeeting#stop --> error leaving MLS session: ${error}`);
    }

    this.signaling = undefined;
    this.session = undefined;
    this.securityCode = undefined;
    this.mediaServicesPresent = false;

    if (this.currentState !== 'disabled') {
      this.setState('left');
    }
  }

  /**
   * @param {MlsGroupSession} session
   * @returns {void}
   */
  private wireSessionEvents(session: MlsGroupSession): void {
    session.on('joinSuccess', ({securityCode}) => {
      this.securityCode = securityCode;
      this.emit(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED, {securityCode});
      this.updateFromRoster();
    });

    session.on('securityCodeChanged', ({code}) => {
      this.securityCode = code;
      this.emit(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED, {securityCode: code});
    });

    session.on('rosterAdded', () => this.updateFromRoster());
    session.on('rosterRemoved', () => this.updateFromRoster());

    session.on('joinFailure', ({reason}) => this.handleFatal('failed', reason));
    session.on('evicted', () => this.handleFatal('evicted', 'evicted'));
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
      this.emit(EVENT_TRIGGERS.MEETING_E2EE_MEDIA_SERVICES_CHANGED, {hasMediaServices});
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
  private handleFatal(state: E2eeState, reason: string): void {
    this.setState(state);
    this.emit(EVENT_TRIGGERS.MEETING_E2EE_FAILURE, {reason});
  }

  /**
   * @returns {string} the self participant's display name, or '' if unavailable.
   */
  private getSelfDisplayName(): string {
    const {members} = this.meeting ?? {};

    return members?.membersCollection?.get?.(members?.selfId)?.name ?? '';
  }

  /**
   * @param {E2eeState} state
   * @returns {void}
   */
  private setState(state: E2eeState): void {
    if (this.currentState === state) {
      return;
    }
    this.currentState = state;
    this.emit(EVENT_TRIGGERS.MEETING_E2EE_STATE_CHANGED, {state});
  }

  /**
   * @param {string} event
   * @param {Object} payload
   * @returns {void}
   */
  private emit(event: string, payload: object): void {
    Trigger.trigger(this.meeting, TRIGGER_SCOPE, event, payload);
  }
}
