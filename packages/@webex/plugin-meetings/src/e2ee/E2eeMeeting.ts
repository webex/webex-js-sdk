/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import type {IdentityProvider} from '@webex/internal-plugin-identity';

import EventsScope from '../common/events/events-scope';
import Trigger from '../common/events/trigger-proxy';
import LoggerProxy from '../common/logs/logger-proxy';
import {EVENT_TRIGGERS} from '../constants';
import MLS from './mls';
import MediaEncryptionService from './MediaEncryptionService';
import E2eeSignaling from './E2eeSignaling';
import MemberMLSReconciler from './MemberMLSReconciler';
import {isE2eeEnabledAndSupported, E2EE_WASM_URL, MEDIA_SERVICE_DEVICE_TYPE} from './constants';
import type WasmLoader from '../common/wasm-loader';
import type {E2eeConfig, E2eeState} from './types';

const DEVICE_TYPE = 'WEB';
const TRIGGER_SCOPE = {file: 'e2ee/E2eeMeeting', function: 'e2ee'};

/**
 * Per-meeting E2EE facade (owned by Meeting as `this.e2ee`). It orchestrates the MLS engine, the
 * signaling adapter and the HTTP transport for one meeting, exposes the security code, media-service
 * presence and lifecycle state, and re-emits E2EE events on the meeting. Its start() is a no-op
 * unless the meeting requires E2EE (a V2/zero-trust meeting) and E2EE is enabled in config.
 */
export default class E2eeMeeting extends EventsScope {
  private readonly meeting: any;

  private readonly webex: any;

  private readonly wasmLoader: WasmLoader;

  private readonly identityProvider: IdentityProvider;

  private readonly config: E2eeConfig;

  private session?: MLS;

  private signaling?: E2eeSignaling;

  private reconciler?: MemberMLSReconciler;

  private currentState: E2eeState = 'disabled';

  private securityCode?: string;

  private mediaServicesPresent = false;

  /**
   * @param {Object} deps
   * @param {Object} deps.meeting - The owning meeting.
   * @param {Object} deps.webex - The parent webex instance.
   * @param {WasmLoader} deps.wasmLoader - Shared (pre-warmed) WASM loader.
   * @param {IdentityProvider} deps.identityProvider - Shared identity/credential provider.
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
    wasmLoader: WasmLoader;
    identityProvider: IdentityProvider;
    config: E2eeConfig;
  }) {
    super();
    this.meeting = meeting;
    this.webex = webex;
    this.wasmLoader = wasmLoader;
    this.identityProvider = identityProvider;
    this.config = config;

    if (isE2eeEnabledAndSupported(!!config.enableE2ee)) {
      // Created eagerly (not on join) and registered as the Members pre-emit processor, so member
      // verification is stamped into every members:update - even for member changes outside a
      // joined meeting. Roster-driven verification changes are reported back through Members too.
      this.reconciler = new MemberMLSReconciler({
        membersCollection: meeting.members.membersCollection,
        reportMembersUpdated: (members) => meeting.members.reportMembersUpdated(members),
      });
      meeting.members.setMembersUpdateProcessor((payload) =>
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
    const info = this.meeting?.locusInfo?.info;

    return (
      isE2eeEnabledAndSupported(!!this.config.enableE2ee) &&
      !!info?.isV2E2EEncrypted &&
      !!info?.mediaEncryptionGroupUrl
    );
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
        `e2ee: E2eeMeeting#start --> ignoring, already in state: ${this.currentState}`
      );

      return;
    }
    if (!this.required()) {
      LoggerProxy.logger.info(
        'e2ee: E2eeMeeting#start --> not required for this meeting, skipping'
      );

      return;
    }

    LoggerProxy.logger.info('e2ee: E2eeMeeting#start --> starting E2EE session');
    this.setState('initializing');

    try {
      await this.wasmLoader.get(E2EE_WASM_URL);

      const {device} = this.webex.internal;
      const credentials = await this.identityProvider.getCredentials(device.userId);
      const httpClient = new MediaEncryptionService({
        webexRequest: this.webex.request.bind(this.webex),
      });
      const session = new MLS({
        httpClient,
        wasmLoader: this.wasmLoader,
        wasmUrl: E2EE_WASM_URL,
      });

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

      this.signaling = new E2eeSignaling({
        llm: this.webex.internal.llm,
        mercury: this.webex.internal.mercury,
        getLocusUrl: () => this.meeting.locusInfo?.url,
        session,
      });
      this.signaling.start();

      this.setState('joining');
      session.join();
    } catch (error) {
      LoggerProxy.logger.error(`e2ee: E2eeMeeting#start --> failed to start E2EE: ${error}`);
      this.setState('failed');
      this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_FAILURE, {reason: 'startFailed'});
    }
  }

  /**
   * Tears down the MLS session and resets state. Idempotent.
   * @returns {Promise<void>}
   */
  async stop(): Promise<void> {
    LoggerProxy.logger.info('e2ee: E2eeMeeting#stop --> stopping E2EE session');
    this.signaling?.stop();

    try {
      this.session?.leave();
    } catch (error) {
      LoggerProxy.logger.warn(`e2ee: E2eeMeeting#stop --> error leaving MLS session: ${error}`);
    }

    this.reconciler?.reset();

    this.signaling = undefined;
    this.session = undefined;
    this.clearSecurityCode();
    this.mediaServicesPresent = false;

    if (this.currentState !== 'disabled') {
      this.setState('left');
    }
  }

  /**
   * @param {MLS} session
   * @returns {void}
   */
  private wireSessionEvents(session: MLS): void {
    session.on('joinSuccess', ({securityCode}) => {
      this.securityCode = securityCode;
      this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED, {securityCode});
      this.updateFromRoster();
    });

    session.on('securityCodeChanged', ({code}) => {
      this.securityCode = code;
      this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED, {securityCode: code});
    });

    session.on('rosterAdded', (added) => {
      this.reconciler?.applyRosterAdded(added);
      this.updateFromRoster();
    });
    session.on('rosterRemoved', ({urls}) => {
      this.reconciler?.applyRosterRemoved(urls);
      this.updateFromRoster();
    });

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
  private handleFatal(state: E2eeState, reason: string): void {
    LoggerProxy.logger.error(
      `e2ee: E2eeMeeting --> fatal E2EE error: state=${state} reason=${reason}`
    );
    this.clearSecurityCode();
    this.setState(state);
    this.emitE2eeEvent(EVENT_TRIGGERS.MEETING_E2EE_FAILURE, {reason});
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
    LoggerProxy.logger.info(
      `e2ee: E2eeMeeting --> state changed: ${this.currentState} -> ${state}`
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
    LoggerProxy.logger.info(`e2ee: E2eeMeeting --> emitting event: ${event}`);
    Trigger.trigger(this, TRIGGER_SCOPE, event, payload);
  }
}
