/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {LLM_ONLINE_EVENT, MEDIA_ENCRYPTION_MERCURY_EVENTS} from './constants';

/** The subset of the MLS engine the signaling adapter drives. */
export interface IMlsSignalingTarget {
  handleEvent(bytes: Uint8Array): void;
  setLlmConnectedBeforeJoin(connected: boolean): void;
  notifyLlmConnected(): void;
}

/**
 * LLM (Low Latency Mercury) adapter for the MLS engine. Subscribes to this meeting's
 * media_encryption.* mercury events and forwards them to the engine, and tracks whether the
 * signaling channel is connected so the engine knows when it can proceed with its join.
 */
export default class E2eeSignaling {
  private readonly webex: any;

  private readonly meeting: any;

  private readonly session: IMlsSignalingTarget;

  private started = false;

  /**
   * @param {Object} deps
   * @param {Object} deps.webex - The parent webex instance.
   * @param {Object} deps.meeting - The owning meeting (for locus-url matching).
   * @param {IMlsSignalingTarget} deps.session - The MLS engine to drive.
   */
  constructor({webex, meeting, session}: {webex: any; meeting: any; session: IMlsSignalingTarget}) {
    this.webex = webex;
    this.meeting = meeting;
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
      this.webex.internal.llm.on(event, this.onMercuryEvent);
    });

    if (this.isLlmOnlineForThisMeeting()) {
      this.session.setLlmConnectedBeforeJoin(true);
    } else {
      this.webex.internal.llm.on(LLM_ONLINE_EVENT, this.onLlmOnline);
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
      this.webex.internal.llm.off(event, this.onMercuryEvent);
    });
    this.webex.internal.llm.off(LLM_ONLINE_EVENT, this.onLlmOnline);
  }

  /**
   * @param {Object} envelope - The mercury event envelope.
   * @returns {void}
   */
  private onMercuryEvent = (envelope: any): void => {
    const eventData = envelope?.data ?? envelope;
    const bytes = new TextEncoder().encode(JSON.stringify(eventData));

    this.session.handleEvent(new Uint8Array(bytes));
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
    const {llm} = this.webex.internal;
    const meetingLocusUrl = this.meeting?.locusInfo?.url;

    return !!meetingLocusUrl && llm.isConnected() && meetingLocusUrl === llm.getLocusUrl();
  }
}
