/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {LLM_ONLINE_EVENT, MEDIA_ENCRYPTION_MERCURY_EVENTS} from './constants';
import type {E2eeSignalingSource} from './types';

/** The subset of the MLS engine the signaling adapter drives. */
export interface IMlsSignalingTarget {
  handleEvent(bytes: Uint8Array, source: E2eeSignalingSource): void;
  setLlmConnectedBeforeJoin(connected: boolean): void;
  notifyLlmConnected(): void;
}

/** The subset of a mercury-style channel (`webex.internal.mercury` / `webex.internal.llm`) the
 * adapter subscribes to for MLS protocol events. */
export interface IMercuryChannel {
  on(event: string, handler: (envelope: any) => void): void;
  off(event: string, handler: (envelope: any) => void): void;
}

/** The subset of `webex.internal.llm` the signaling adapter uses. */
export interface ILlmChannel extends IMercuryChannel {
  isConnected(): boolean;
  getLocusUrl(): string;
}

/**
 * Mercury (and LLM) adapter for the MLS engine. Subscribes to this meeting's
 * media_encryption.* events on both the LLM and mercury channels and forwards them to the engine,
 * and tracks whether the signaling channel is connected so the engine knows when it can proceed
 * with its join.
 */
export default class E2eeSignaling {
  private readonly llm: ILlmChannel;

  private readonly mercury: IMercuryChannel;

  private readonly getLocusUrl: () => string | undefined;

  private readonly session: IMlsSignalingTarget;

  private started = false;

  /**
   * @param {Object} deps
   * @param {ILlmChannel} deps.llm - The mercury (LLM) channel (webex.internal.llm).
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
    llm: ILlmChannel;
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
      this.llm.on(event, this.onLlmEvent);
      this.mercury.on(event, this.onMercuryEvent);
    });

    if (this.isLlmOnlineForThisMeeting()) {
      this.session.setLlmConnectedBeforeJoin(true);
    } else {
      this.llm.on(LLM_ONLINE_EVENT, this.onLlmOnline);
    }
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
      this.llm.off(event, this.onLlmEvent);
      this.mercury.off(event, this.onMercuryEvent);
    });
    this.llm.off(LLM_ONLINE_EVENT, this.onLlmOnline);
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
    if (this.isLlmOnlineForThisMeeting()) {
      this.session.notifyLlmConnected();
    }
  };

  /**
   * @returns {boolean} whether the LLM is connected for this specific meeting (locus-url matched).
   */
  private isLlmOnlineForThisMeeting(): boolean {
    const meetingLocusUrl = this.getLocusUrl();

    return (
      !!meetingLocusUrl && this.llm.isConnected() && meetingLocusUrl === this.llm.getLocusUrl()
    );
  }
}
