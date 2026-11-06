/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import type LLMChannel from '@webex/internal-plugin-llm';

/** Source labels passed to the MLS engine for incoming signaling messages. */
type E2eeSignalingSource = 'llm' | 'mercury';

/** LLM event carrying the channel's connection state. */
export const LLM_ONLINE_EVENT = 'online';

/** Mercury events carrying MLS protocol messages. */
export const MEDIA_ENCRYPTION_MERCURY_EVENTS = [
  'event:media_encryption.leader_nominated',
  'event:media_encryption.welcome',
  'event:media_encryption.annotated_welcome',
  'event:media_encryption.multi_welcome',
  'event:media_encryption.group_update',
  'event:media_encryption.annotated_commit',
  'event:media_encryption.large_group_update',
  'event:media_encryption.use_key',
  'event:media_encryption.join_request',
  'event:media_encryption.leave_request',
  'event:media_encryption.join_failure',
  'event:media_encryption.leader_changed',
  'event:media_encryption.message_segment',
];

/** The subset of the MLS engine the signaling adapter drives. */
export interface IMlsSignalingTarget {
  handleEvent(bytes: Uint8Array, source: E2eeSignalingSource): void;
  setLlmConnectedBeforeJoin(connected: boolean): void;
  llmConnected(): void;
}

/** The subset of a mercury channel the adapter subscribes to for MLS protocol events. */
export interface IMercuryChannel {
  on(event: string, handler: (envelope: any) => void): void;
  off(event: string, handler: (envelope: any) => void): void;
}

/**
 * Mercury (and LLM) adapter for the MLS engine. Subscribes to this meeting's
 * media_encryption.* events on both the LLM and mercury channels and forwards them to the engine,
 * and tracks whether the signaling channel is connected so the engine knows when it can proceed
 * with its join.
 */
export default class E2eeSignaling {
  private llm?: LLMChannel;

  private readonly mercury: IMercuryChannel;

  private readonly getLocusUrl: () => string | undefined;

  private readonly session: IMlsSignalingTarget;

  private started = false;

  /**
   * @param {Object} deps
   * @param {LLMChannel} [deps.llm] - This meeting's LLM channel, when one is available.
   * @param {IMercuryChannel} deps.mercury - The mercury channel (webex.internal.mercury).
   * @param {Function} deps.getLocusUrl - Returns the meeting's current locus url (read live, as it
   *   can change, e.g. when moving between breakout sessions).
   * @param {IMlsSignalingTarget} deps.session - The MLS engine to drive.
   */
  constructor({
    llm,
    mercury,
    getLocusUrl,
    session,
  }: {
    llm?: LLMChannel;
    mercury: IMercuryChannel;
    getLocusUrl: () => string | undefined;
    session: IMlsSignalingTarget;
  }) {
    this.llm = llm;
    this.mercury = mercury;
    this.getLocusUrl = getLocusUrl;
    this.session = session;
  }

  /**
   * Subscribes to MLS mercury events and wires up connection tracking. Idempotent.
   * @returns {void}
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    MEDIA_ENCRYPTION_MERCURY_EVENTS.forEach((event) => {
      this.mercury.on(event, this.onMercuryEvent);
    });

    if (this.llm && this.isLlmOnlineForThisSession()) {
      this.session.setLlmConnectedBeforeJoin(true);
    }
    this.subscribeToLlmEvents();
  }

  /**
   * Removes all subscriptions. Idempotent.
   * @returns {void}
   */
  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;

    MEDIA_ENCRYPTION_MERCURY_EVENTS.forEach((event) => {
      this.mercury.off(event, this.onMercuryEvent);
    });
    this.unsubscribeFromLlmEvents();
  }

  /**
   * Replaces the meeting-owned LLM channel after the meeting reconnects its data channel.
   * @param {LLMChannel} [llm]
   * @returns {void}
   */
  setLlmChannel(llm?: LLMChannel): void {
    if (this.llm === llm) {
      return;
    }

    this.unsubscribeFromLlmEvents();
    this.llm = llm;

    if (!this.started || !this.llm) {
      return;
    }

    this.subscribeToLlmEvents();

    if (this.isLlmOnlineForThisSession()) {
      this.session.llmConnected();
    }
  }

  /**
   * Forwards a signaling envelope to the engine, tagging which channel it came from.
   * @param {Object} envelope - The mercury event envelope.
   * @param {E2eeSignalingSource} source - The channel the envelope arrived on.
   * @returns {void}
   */
  private forwardEvent(envelope: any, source: E2eeSignalingSource): void {
    const eventData = envelope?.data ?? envelope;
    const bytes = new TextEncoder().encode(JSON.stringify(eventData));

    this.session.handleEvent(new Uint8Array(bytes), source);
  }

  /**
   * @param {Object} envelope - The mercury event envelope from the LLM channel.
   * @returns {void}
   */
  private onLlmEvent = (envelope: any): void => {
    this.forwardEvent(envelope, 'llm');
  };

  /**
   * @param {Object} envelope - The mercury event envelope from the mercury channel.
   * @returns {void}
   */
  private onMercuryEvent = (envelope: any): void => {
    this.forwardEvent(envelope, 'mercury');
  };

  /**
   * @returns {void}
   */
  private onLlmOnline = (): void => {
    if (this.isLlmOnlineForThisSession()) {
      this.session.llmConnected();
    }
  };

  /** @returns {void} */
  private subscribeToLlmEvents(): void {
    if (!this.started || !this.llm) {
      return;
    }

    MEDIA_ENCRYPTION_MERCURY_EVENTS.forEach((event) => {
      this.llm?.on(event, this.onLlmEvent);
    });
    if (!this.isLlmOnlineForThisSession()) {
      this.llm.on(LLM_ONLINE_EVENT, this.onLlmOnline);
    }
  }

  /** @returns {void} */
  private unsubscribeFromLlmEvents(): void {
    this.llm?.off(LLM_ONLINE_EVENT, this.onLlmOnline);
    MEDIA_ENCRYPTION_MERCURY_EVENTS.forEach((event) => {
      this.llm?.off(event, this.onLlmEvent);
    });
  }

  /**
   * @returns {boolean} whether the LLM is connected for this specific session (locus-url matched).
   */
  private isLlmOnlineForThisSession(): boolean {
    const sessionLocusUrl = this.getLocusUrl();

    return (
      !!sessionLocusUrl && !!this.llm?.isConnected() && sessionLocusUrl === this.llm.getLocusUrl()
    );
  }
}
