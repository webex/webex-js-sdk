/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */
import {WebexPlugin} from '@webex/webex-core';
import {clamp} from 'lodash';

import {
  LOCUS_SYNC_LATENCY_EVENT_NAMES,
  MetricEventNames,
  PreComputedLatencies,
} from '../metrics.types';

// we only care about client event and feature event for now

type LocusSyncLatencyMilestone = {
  meetingId: string;
  dataSetName: string;
  key: MetricEventNames;
  value: number;
  trackingId?: string;
};

type SaveTimestampOptions = {
  meetingId?: string;
  dataSetName?: string;
  trackingId?: string;
};

type SaveLatencyOptions = {
  meetingId?: string;
  dataSetName?: string;
};

type LocusSyncLatencyRecord = {
  meetingId: string;
  dataSetName: string;
  randomBackoffTime: number;
  trackingId?: string;
  syncStart?: number;
  hashTreeRequest?: number;
  hashTreeResponse?: number;
  syncRequest?: number;
  syncResponse?: number;
  messageReceived?: number;
};

type LocusSyncLatencyTimestampKey = Exclude<keyof LocusSyncLatencyRecord, 'randomBackoffTime'>;

/**
 * Container for the latencies tracked for a single meeting. Locus sync is currently the only
 * meeting-specific latency we track, but this wrapper lets us add other latency records in the
 * future without changing the shape of `meetingLatencies`.
 */
type MeetingLatencyRecord = {
  locusSync: LocusSyncLatencyRecord;
};

/**
 * @description Helper class to store latencies timestamp and to calculate various latencies for CA.
 * @exports
 * @class CallDiagnosticLatencies
 */
export default class CallDiagnosticLatencies extends WebexPlugin {
  latencyTimestamps: Map<MetricEventNames, number>;
  precomputedLatencies: Map<PreComputedLatencies, number>;
  meetingLatencies: Map<string, MeetingLatencyRecord[]>;
  // meetingId that the current latencies are for
  private meetingId?: string;
  private MAX_INTEGER = 2147483647;

  // Aligned with UCF desktop (MekleFlowSyncMetricsTracker::kSleepWakeSkewThresholdMs): if any
  // measured Locus sync segment exceeds this threshold the record is assumed to be corrupted by a
  // clock jump (sleep/wake) and is discarded instead of being reported.
  private LOCUS_SYNC_SKEW_THRESHOLD_MS = 10 * 60 * 1000;

  /**
   * @constructor
   */
  constructor(...args) {
    super(...args);
    this.latencyTimestamps = new Map();
    this.precomputedLatencies = new Map();
    this.meetingLatencies = new Map();
  }

  /**
   * Clear timestamps
   */
  public clearTimestamps() {
    this.latencyTimestamps.clear();
    this.precomputedLatencies.clear();
    this.meetingLatencies.clear();
  }

  /**
   * Clear tracked Locus sync latency state for a dataset.
   * @param dataSetName dataset name
   * @param meetingId meeting id
   */
  public clearLocusSyncLatency(dataSetName: string, meetingId: string) {
    const records = this.meetingLatencies.get(meetingId);

    if (!records) {
      return;
    }

    const remainingRecords = records.filter(
      (record) => record.locusSync.dataSetName !== dataSetName
    );

    if (remainingRecords.length > 0) {
      this.meetingLatencies.set(meetingId, remainingRecords);
    } else {
      this.meetingLatencies.delete(meetingId);
    }
  }

  /**
   * Calculates Locus sync latency values from stored milestone timestamps.
   * @param meetingId meeting id
   * @param trackingId sync tracking id used to match the record
   * @returns sync latency metrics
   */
  public getLocusSyncLatency(meetingId: string, trackingId: string) {
    if (!trackingId) {
      return undefined;
    }

    const record = this.getLocusSyncLatencyRecord(meetingId, trackingId);

    if (!record) {
      return undefined;
    }

    // Some sync flows skip the /hashtree request, for example single-leaf data sets or cases
    // where we already know which leaves to sync. Treat the missing hashtree segment as 0,
    // while still requiring the sync request/response/message milestones below.
    const hashtreePrepTime =
      this.getDiffBetweenLocusSyncTimestamps(record, 'syncStart', 'hashTreeRequest') ?? 0;
    const hashtreeResponseTime =
      this.getDiffBetweenLocusSyncTimestamps(record, 'hashTreeRequest', 'hashTreeResponse') ?? 0;
    const syncPrepStart = this.getLocusSyncPrepStart(record);
    const syncPrepTime = this.getDiffBetweenLocusSyncTimestamps(
      record,
      syncPrepStart,
      'syncRequest'
    );
    const syncResponseTime = this.getDiffBetweenLocusSyncTimestamps(
      record,
      'syncRequest',
      'syncResponse'
    );
    // Aligned with UCF: syncMessageReceiveTime is measured from the sync request start (not the
    // sync response), i.e. how long after we asked Locus to sync the resulting state update arrived.
    const syncMessageReceiveTime = this.getDiffBetweenLocusSyncTimestamps(
      record,
      'syncRequest',
      'messageReceived'
    );
    const totalTimeFromMessageReceived = this.getDiffBetweenLocusSyncTimestamps(
      record,
      'syncStart',
      'messageReceived'
    );
    const totalTimeFromSyncResponse = this.getDiffBetweenLocusSyncTimestamps(
      record,
      'syncStart',
      'syncResponse'
    );

    // messageReceived can occasionally be out of order due to race conditions.
    // Ensure totalTime is never less than syncStart->syncResponse when both exist.
    // Aligned with UCF desktop: the LLM broadcast is NOT required, so when it never arrived we
    // fall back to the /sync response for the total time.
    const totalTime =
      typeof totalTimeFromMessageReceived === 'number' &&
      typeof totalTimeFromSyncResponse === 'number'
        ? Math.max(totalTimeFromMessageReceived, totalTimeFromSyncResponse)
        : totalTimeFromMessageReceived ?? totalTimeFromSyncResponse;

    if (typeof syncPrepTime !== 'number' || typeof totalTime !== 'number') {
      return undefined;
    }

    // Aligned with UCF desktop (MekleFlowSyncMetricsTracker kSleepWakeSkewThresholdMs): if any
    // individual segment is larger than the skew threshold the timestamps were almost certainly
    // distorted by a clock jump (device sleep/wake), so discard the whole record.
    const skewedSegment = [
      record.randomBackoffTime,
      hashtreePrepTime,
      hashtreeResponseTime,
      syncPrepTime,
      syncResponseTime,
      syncMessageReceiveTime,
      totalTime,
    ].some((segment) => typeof segment === 'number' && segment > this.LOCUS_SYNC_SKEW_THRESHOLD_MS);

    if (skewedSegment) {
      return undefined;
    }

    // Aligned with UCF desktop (MekleFlowSyncMetricsTracker): emit whenever at least one measured
    // segment is non-zero, regardless of whether the resulting LLM broadcast was ever observed.
    const hasMeaningfulSegment =
      hashtreeResponseTime > 0 ||
      (typeof syncResponseTime === 'number' && syncResponseTime > 0) ||
      (typeof syncMessageReceiveTime === 'number' && syncMessageReceiveTime > 0);

    if (!hasMeaningfulSegment) {
      return undefined;
    }

    return {
      randomBackoffTime: this.getClampedLocusSyncLatency(record.randomBackoffTime),
      hashtreePrepTime,
      hashtreeResponseTime,
      syncPrepTime,
      ...(typeof syncResponseTime === 'number' ? {syncResponseTime} : {}),
      ...(typeof syncMessageReceiveTime === 'number' ? {syncMessageReceiveTime} : {}),
      totalTime,
    };
  }

  /**
   * Records the time the LLM state-update message for a Locus sync arrived. This is the milestone
   * that gates the client.locus.sync.complete metric: the metric is emitted only for flows where
   * the update came over LLM (aligned with the agreed requirement that body/http-only syncs do not
   * emit). The record is matched by meeting id + tracking id, regardless of which other milestones
   * are present yet, so the real arrival time is captured even if the /sync response has not landed.
   * @param meetingId meeting id
   * @param trackingId sync tracking id used to match the pending record
   * @returns void
   */
  public recordLocusSyncMessageReceived(meetingId: string, trackingId: string) {
    if (!trackingId) {
      return;
    }

    const record = this.getLocusSyncLatencyRecord(meetingId, trackingId);

    if (record && typeof record.messageReceived !== 'number') {
      record.messageReceived = new Date().getTime();
    }
  }

  /**
   * Whether a pending Locus sync latency record exists for a meeting + tracking id. Used by the
   * orchestration layer to decide whether to wait (with a timeout) for the missing milestone.
   * @param meetingId meeting id
   * @param trackingId sync tracking id
   * @returns whether a matching pending record exists
   */
  public hasPendingLocusSyncLatencyRecord(meetingId: string, trackingId: string) {
    if (!trackingId) {
      return false;
    }

    return Boolean(this.getLocusSyncLatencyRecord(meetingId, trackingId));
  }

  /**
   * Complete and remove the latest Locus sync latency record for a meeting.
   *
   * Two completion modes:
   * - eager (requireSyncResponse=true, default): completes immediately when BOTH the LLM message
   *   and the /sync response have arrived. If either is missing the record is kept so the other
   *   milestone can still arrive (or the wait-for-both timeout can complete it).
   * - timeout (requireSyncResponse=false): the wait-for-both timer fired. Aligned with UCF desktop,
   *   completes with whatever milestones are present - the LLM broadcast is NOT required. The
   *   record is still discarded without emitting when no measurable segment exists.
   * @param meetingId meeting id
   * @param trackingId sync tracking id used to match the pending record
   * @param options completion options
   * @returns completed sync latency metric payload, or undefined when not completed
   */
  public completeLocusSyncLatency(
    meetingId: string,
    trackingId: string,
    {requireSyncResponse = true}: {requireSyncResponse?: boolean} = {}
  ) {
    if (!trackingId) {
      return undefined;
    }

    const record = this.getLocusSyncLatencyRecord(meetingId, trackingId);

    if (!record) {
      return undefined;
    }

    const hasMessageReceived = typeof record.messageReceived === 'number';
    const hasSyncResponse = typeof record.syncResponse === 'number';

    if (requireSyncResponse) {
      // Eager: wait until both milestones are present before emitting.
      if (!hasMessageReceived || !hasSyncResponse) {
        return undefined;
      }
    }
    // Timeout (requireSyncResponse=false): aligned with UCF desktop, emit with whatever milestones
    // are present - the LLM broadcast is NOT required. getLocusSyncLatency below still discards
    // records that have no measurable segment.

    const syncLatency = this.getLocusSyncLatency(meetingId, trackingId);

    this.removeLocusSyncLatencyRecord(record);

    if (!syncLatency) {
      return undefined;
    }

    const completed = {
      dataSet: record.dataSetName,
      syncLatency,
    };

    return completed;
  }

  /**
   * Helper to calculate end - start for Locus sync milestones.
   * @param record tracked milestone timestamps
   * @param a start milestone
   * @param b end milestone
   * @returns latency
   */
  private getDiffBetweenLocusSyncTimestamps(
    record: LocusSyncLatencyRecord,
    a: LocusSyncLatencyTimestampKey,
    b: LocusSyncLatencyTimestampKey
  ) {
    const start = record[a];
    const end = record[b];

    if (typeof start !== 'number' || typeof end !== 'number') {
      return undefined;
    }

    return this.getClampedLocusSyncLatency(end - start);
  }

  /**
   * Get the timestamp that starts the sync prep segment.
   * @param record tracked milestone timestamps
   * @returns sync prep start milestone
   */
  private getLocusSyncPrepStart(record: LocusSyncLatencyRecord): LocusSyncLatencyTimestampKey {
    return typeof record.hashTreeResponse === 'number' ? 'hashTreeResponse' : 'syncStart';
  }

  /**
   * Round and clamp Locus sync latency values.
   * @param latency latency value
   * @returns rounded latency
   */
  private getClampedLocusSyncLatency(latency: number) {
    return Math.round(clamp(latency, 0, this.MAX_INTEGER));
  }

  /**
   * Get the Locus sync latency record for a meeting and tracking id.
   * @param meetingId meeting id
   * @param trackingId /sync response tracking id
   * @returns matching Locus sync latency record
   */
  private getLocusSyncLatencyRecord(meetingId: string, trackingId: string) {
    const records = this.meetingLatencies.get(meetingId);

    if (!records) {
      return undefined;
    }

    return [...records].find((record) => record.locusSync.trackingId === trackingId)?.locusSync;
  }

  private removeLocusSyncLatencyRecord(recordToRemove: LocusSyncLatencyRecord) {
    const records = this.meetingLatencies.get(recordToRemove.meetingId);

    if (!records) {
      return;
    }

    const remainingRecords = records.filter((record) => record.locusSync !== recordToRemove);

    if (remainingRecords.length > 0) {
      this.meetingLatencies.set(recordToRemove.meetingId, remainingRecords);
    } else {
      this.meetingLatencies.delete(recordToRemove.meetingId);
    }
  }

  /**
   * Get the latest Locus sync latency record waiting for sync.start.
   * @param meetingId meeting id
   * @param dataSetName dataset name
   * @returns latest pending Locus sync latency record
   */
  private getLatestPendingLocusSyncLatencyRecord(meetingId: string, dataSetName: string) {
    const records = this.meetingLatencies.get(meetingId);

    if (!records) {
      return undefined;
    }

    return [...records]
      .reverse()
      .find(
        (record) =>
          record.locusSync.dataSetName === dataSetName && record.locusSync.syncStart === undefined
      )?.locusSync;
  }

  /**
   * Store random backoff latency for the current or next Locus sync latency record.
   * @param meetingId meeting id
   * @param dataSetName dataset name
   * @param randomBackoffTime random backoff latency value
   * @returns void
   */
  private saveLocusSyncBackoffLatency({
    meetingId,
    dataSetName,
    randomBackoffTime,
  }: {
    meetingId: string;
    dataSetName: string;
    randomBackoffTime: number;
  }) {
    const pendingRecord = this.getLatestPendingLocusSyncLatencyRecord(meetingId, dataSetName);

    if (pendingRecord) {
      pendingRecord.randomBackoffTime = randomBackoffTime;

      return;
    }

    const records = this.meetingLatencies.get(meetingId) ?? [];

    records.push({
      locusSync: {
        meetingId,
        dataSetName,
        randomBackoffTime,
      },
    });
    this.meetingLatencies.set(meetingId, records);
  }

  /**
   * Checks if metric event name is a Locus sync latency milestone.
   * @param key event name
   * @returns whether event is Locus sync latency milestone
   */
  private isLocusSyncLatencyEvent(key: MetricEventNames) {
    return LOCUS_SYNC_LATENCY_EVENT_NAMES.includes(key as any);
  }

  /**
   * Stores a Locus sync latency milestone timestamp.
   * @param options options
   */
  private saveLocusSyncLatencyTimestamp({
    meetingId,
    dataSetName,
    key,
    value,
    trackingId,
  }: LocusSyncLatencyMilestone) {
    if (!trackingId) {
      // @ts-ignore
      this.webex.logger.warn(
        `CallDiagnosticLatencies: saveLocusSyncLatencyTimestamp called without a trackingId for key "${key}"; skipping Locus sync milestone`
      );

      return;
    }

    if (key === 'internal.client.locus.sync.start') {
      const pendingRecord = this.getLatestPendingLocusSyncLatencyRecord(meetingId, dataSetName);

      if (pendingRecord) {
        pendingRecord.trackingId = trackingId;
        pendingRecord.syncStart = value;

        return;
      }

      const records = this.meetingLatencies.get(meetingId) ?? [];

      records.push({
        locusSync: {
          meetingId,
          dataSetName,
          randomBackoffTime: 0,
          trackingId,
          syncStart: value,
        },
      });
      this.meetingLatencies.set(meetingId, records);

      return;
    }

    // Every sync milestone after sync.start is stamped with the same tracking id that was
    // generated up-front and forced onto the /sync request, so the record is located by
    // meeting id + tracking id.
    const record = this.getLocusSyncLatencyRecord(meetingId, trackingId);

    if (!record) {
      return;
    }

    switch (key) {
      case 'internal.client.locus.hashtree.request':
        record.hashTreeRequest = value;
        break;
      case 'internal.client.locus.hashtree.response':
        record.hashTreeResponse = value;
        break;
      case 'internal.client.locus.sync.request':
        record.syncRequest = value;
        break;
      case 'internal.client.locus.sync.response':
        record.syncResponse = value;
        break;
      case 'internal.client.locus.sync.message.received':
        record.messageReceived = value;
        break;
      default:
        break;
    }
  }

  /**
   * Associate current latencies with a meeting id
   * @param meetingId
   */
  private setMeetingId(meetingId: string) {
    this.meetingId = meetingId;
  }

  /**
   * Returns the meeting object associated with current latencies
   * @returns meeting object
   */
  private getMeeting() {
    if (this.meetingId) {
      // @ts-ignore
      return this.webex.meetings.getBasicMeetingInformation(this.meetingId);
    }

    return undefined;
  }

  /**
   * Store timestamp value
   * @param key - key
   * @param value - value
   * @param options - store options
   * @throws
   * @returns
   */
  public saveTimestamp({
    key,
    value = new Date().getTime(),
    options = {},
  }: {
    key: MetricEventNames;
    value?: number;
    options?: SaveTimestampOptions;
  }) {
    // save the meetingId so we can use the meeting object in latency calculations if needed
    const {meetingId} = options;
    if (meetingId) {
      this.setMeetingId(meetingId);
    }

    if (this.isLocusSyncLatencyEvent(key) && options.dataSetName && options.meetingId) {
      this.saveLocusSyncLatencyTimestamp({
        meetingId: options.meetingId,
        dataSetName: options.dataSetName,
        key,
        value,
        trackingId: options.trackingId,
      });

      return;
    }

    // for some events we're only interested in the first timestamp not last
    // as these events can happen multiple times
    if (
      key === 'client.media.rx.start' ||
      key === 'client.media.tx.start' ||
      key === 'internal.client.meetinginfo.request' ||
      key === 'internal.client.meetinginfo.response' ||
      key === 'client.media-engine.remote-sdp-received'
    ) {
      this.saveFirstTimestampOnly(key, value);
    } else {
      this.latencyTimestamps.set(key, value);
      // new offer/answer so reset the remote SDP timestamp
      if (key === 'client.media-engine.local-sdp-generated') {
        this.latencyTimestamps.delete('client.media-engine.remote-sdp-received');
      }
    }
  }

  /**
   * Store precomputed latency value
   * @param key - key
   * @param value - value
   * @param accumulate - when it is true, it overwrites existing value with sum of the current value and the new measurement otherwise just store the new measurement
   * @throws
   * @returns
   */
  public saveLatency(
    key: PreComputedLatencies,
    value: number,
    accumulateOrOptions: boolean | SaveLatencyOptions = false
  ) {
    if (
      key === 'internal.client.locus.sync.random.backoff' &&
      typeof accumulateOrOptions === 'object' &&
      accumulateOrOptions.meetingId &&
      accumulateOrOptions.dataSetName
    ) {
      this.saveLocusSyncBackoffLatency({
        meetingId: accumulateOrOptions.meetingId,
        dataSetName: accumulateOrOptions.dataSetName,
        randomBackoffTime: value,
      });

      return;
    }

    const accumulate = typeof accumulateOrOptions === 'boolean' ? accumulateOrOptions : false;
    const existingValue = accumulate ? this.precomputedLatencies.get(key) || 0 : 0;
    this.precomputedLatencies.set(key, value + existingValue);
  }

  /**
   * Measure latency for a request
   * @param callback - callback for which you would like to measure latency
   * @param key - key
   * @param accumulate - when it is true, it overwrites existing value with sum of the current value and the new measurement otherwise just store the new measurement
   * @returns
   */
  public measureLatency(
    callback: () => Promise<unknown>,
    key: PreComputedLatencies,
    accumulate = false
  ) {
    const start = performance.now();

    return callback().finally(() => {
      this.saveLatency(key, performance.now() - start, accumulate);
    });
  }

  /**
   * Store only the first timestamp value for the given key
   * @param key - key
   * @param  value -value
   * @throws
   * @returns
   */
  saveFirstTimestampOnly(key: MetricEventNames, value: number = new Date().getTime()) {
    if (this.latencyTimestamps.has(key)) {
      return;
    }
    this.latencyTimestamps.set(key, value);
  }

  /**
   * Helper to calculate end - start
   * @param a start
   * @param b end
   * @returns latency
   */
  public getDiffBetweenTimestamps(
    a: MetricEventNames,
    b: MetricEventNames,
    clampValues?: {minimum?: number; maximum?: number}
  ) {
    const start = this.latencyTimestamps.get(a);
    const end = this.latencyTimestamps.get(b);

    if (typeof start !== 'number' || typeof end !== 'number') {
      return undefined;
    }

    const diff = end - start;

    const {minimum = 0, maximum = this.MAX_INTEGER} = clampValues || {};

    return clamp(diff, minimum, maximum);
  }

  /**
   * Meeting Info Request
   * @note Meeting Info request happen not just in the join phase. CA requires
   * metrics around meeting info request that are only part of join phase.
   * This internal.* event is used to track the real timestamps
   * (when the actual request/response happen). This is because the actual CA event is
   * sent inside the join method on the meeting object based on some logic, but that's not exactly when
   * those events are actually fired. The logic only confirms that they have happened, and we send them over.
   * @returns - latency
   */
  public getMeetingInfoReqResp() {
    return this.getDiffBetweenTimestamps(
      'internal.client.meetinginfo.request',
      'internal.client.meetinginfo.response',
      {maximum: 1200000}
    );
  }

  /**
   * Interstitial Time
   * @returns - latency
   */
  public getShowInterstitialTime() {
    return this.getDiffBetweenTimestamps(
      'internal.client.meeting.interstitial-window.showed',
      'internal.client.interstitial-window.click.joinbutton'
    );
  }

  /**
   * getU2CTime
   * @returns - latency
   */
  public getU2CTime() {
    const u2cLatency = this.precomputedLatencies.get('internal.get.u2c.time');

    return typeof u2cLatency === 'number' ? Math.floor(u2cLatency) : undefined;
  }

  /**
   * Device Register Time
   * @returns - latency
   */
  public getRegisterWDMDeviceJMT() {
    return this.getDiffBetweenTimestamps(
      'internal.register.device.request',
      'internal.register.device.response'
    );
  }

  /**
   * Call Init Join Request
   * @returns - latency
   */
  public getCallInitJoinReq() {
    const interstitialShowedToJoinReq = this.getDiffBetweenTimestamps(
      'internal.client.meeting.interstitial-window.showed',
      'client.locus.join.request'
    );
    const showInterstitialTime = this.getShowInterstitialTime() || 0;

    if (typeof interstitialShowedToJoinReq !== 'number') {
      return undefined;
    }

    return clamp(interstitialShowedToJoinReq - showInterstitialTime, 0, 1200000);
  }

  /**
   * Locus Join Request
   * @returns - latency
   */
  public getJoinReqResp() {
    return this.getDiffBetweenTimestamps(
      'client.locus.join.request',
      'client.locus.join.response',
      {maximum: 1200000}
    );
  }

  /**
   * Time taken to do turn discovery
   * @returns - latency
   */
  public getTurnDiscoveryTime() {
    return this.getDiffBetweenTimestamps(
      'internal.client.add-media.turn-discovery.start',
      'internal.client.add-media.turn-discovery.end'
    );
  }

  /**
   * Local SDP Generated Remote SDP REceived
   * @returns - latency
   */
  public getLocalSDPGenRemoteSDPRecv() {
    return this.getDiffBetweenTimestamps(
      'client.media-engine.local-sdp-generated',
      'client.media-engine.remote-sdp-received',
      {maximum: 1200000}
    );
  }

  /**
   * ICE Setup Time
   * @returns - latency
   */
  public getICESetupTime() {
    return this.getDiffBetweenTimestamps('client.ice.start', 'client.ice.end', {maximum: 1200000});
  }

  /**
   * Audio ICE time
   * @returns - latency
   */
  public getAudioICESetupTime() {
    return this.getDiffBetweenTimestamps('client.ice.start', 'client.ice.end');
  }

  /**
   * Video ICE Time
   * @returns - latency
   */
  public getVideoICESetupTime() {
    return this.getDiffBetweenTimestamps('client.ice.start', 'client.ice.end');
  }

  /**
   * Share ICE Time
   * @returns - latency
   */
  public getShareICESetupTime() {
    return this.getDiffBetweenTimestamps('client.ice.start', 'client.ice.end');
  }

  /**
   * Stay Lobby Time
   * @returns - latency
   */
  public getStayLobbyTime() {
    return this.getDiffBetweenTimestamps('client.lobby.entered', 'client.lobby.exited');
  }

  /**
   * Stay lobby time capped by a certain timestamp.
   * This is to handle the case where the target end timestamp could happen before the lobby is exited,
   * for example media-engine.ready or client.ice.end
   * This is supposed to be called AFTER the end timestamp happens
   * @param endTimestampKey name of the target end event
   * @returns - latency
   */
  public getStayLobbyTimeCappedBy(endTimestampKey: MetricEventNames) {
    const lobbyStartTimestamp = this.latencyTimestamps.get('client.lobby.entered'); // might not exist (some meetings don't have lobby)

    if (typeof lobbyStartTimestamp !== 'number') {
      // no lobby in the meeting, stayLobbyTime is 0
      return 0;
    }

    const lobbyEndTimestamp = this.latencyTimestamps.get('client.lobby.exited'); // might not exist (if user still in lobby at the time of measurement)
    const maximumEndTimestamp = this.latencyTimestamps.get(endTimestampKey); // must exist

    if (typeof maximumEndTimestamp !== 'number') {
      // the provided timestamp to be used as a cap should exist, return undefined if it doesn't
      return undefined;
    }

    const endTimestamp =
      typeof lobbyEndTimestamp === 'number'
        ? Math.min(lobbyEndTimestamp, maximumEndTimestamp)
        : maximumEndTimestamp;

    return clamp(endTimestamp - lobbyStartTimestamp, 0, this.MAX_INTEGER);
  }

  /**
   * Page JMT
   * @returns - latency
   */
  public getPageJMT() {
    const latency = this.precomputedLatencies.get('internal.client.pageJMT');

    return typeof latency === 'number' ? clamp(latency, 0, this.MAX_INTEGER) : undefined;
  }

  /**
   * Download Time JMT
   * @returns - latency
   */
  public getDownloadTimeJMT() {
    const latency = this.precomputedLatencies.get('internal.download.time');

    return typeof latency === 'number' ? clamp(latency, 0, this.MAX_INTEGER) : undefined;
  }

  /**
   * Click To Interstitial
   * @returns - latency
   */
  public getClickToInterstitial() {
    const clickToInterstitialLatency = this.precomputedLatencies.get(
      'internal.click.to.interstitial'
    );

    if (typeof clickToInterstitialLatency === 'number') {
      return clamp(clickToInterstitialLatency, 0, this.MAX_INTEGER);
    }

    return undefined;
  }

  /**
   * Click To Interstitial With User Delay
   * @returns - latency
   */
  public getClickToInterstitialWithUserDelay() {
    const clickToInterstitialWithUserDelayLatency = this.precomputedLatencies.get(
      'internal.click.to.interstitial.with.user.delay'
    );

    if (typeof clickToInterstitialWithUserDelayLatency === 'number') {
      return clamp(clickToInterstitialWithUserDelayLatency, 0, this.MAX_INTEGER);
    }

    return undefined;
  }

  /**
   * Interstitial To Join Ok
   * @returns - latency
   */
  public getInterstitialToJoinOK() {
    const interstitialShowedToJoinResp = this.getDiffBetweenTimestamps(
      'internal.client.meeting.interstitial-window.showed',
      'client.locus.join.response'
    );
    const showInterstitialTime = this.getShowInterstitialTime() || 0;

    if (typeof interstitialShowedToJoinResp !== 'number') {
      return undefined;
    }

    return clamp(interstitialShowedToJoinResp - showInterstitialTime, 0, this.MAX_INTEGER);
  }

  /**
   * Call Init To MediaEngineReady
   * @returns - latency
   */
  public getCallInitMediaEngineReady() {
    return this.getInterstitialToMediaOKJMT();
  }

  /**
   * Interstitial To Media Ok
   * @returns - latency
   */
  public getInterstitialToMediaOKJMT() {
    const interstitialShowedToIceEnd = this.getDiffBetweenTimestamps(
      'internal.client.meeting.interstitial-window.showed',
      'client.ice.end'
    );
    const showInterstitialTime = this.getShowInterstitialTime() || 0;
    const stayLobbyTimeCappedByIceEnd = this.getStayLobbyTimeCappedBy('client.ice.end');

    if (
      typeof interstitialShowedToIceEnd === 'number' &&
      typeof stayLobbyTimeCappedByIceEnd === 'number'
    ) {
      return clamp(
        interstitialShowedToIceEnd - showInterstitialTime - stayLobbyTimeCappedByIceEnd,
        0,
        this.MAX_INTEGER
      );
    }

    return undefined;
  }

  /**
   * Total JMT
   * @returns - latency
   */
  public getTotalJMT() {
    const clickToInterstitial = this.getClickToInterstitial();
    const interstitialShowedToJoinLocusResponse = this.getDiffBetweenTimestamps(
      'internal.client.meeting.interstitial-window.showed',
      'client.locus.join.response'
    );
    const showInterstitialTime = this.getShowInterstitialTime() || 0;

    if (
      typeof clickToInterstitial === 'number' &&
      typeof interstitialShowedToJoinLocusResponse === 'number'
    ) {
      return clamp(
        clickToInterstitial + interstitialShowedToJoinLocusResponse - showInterstitialTime,
        0,
        this.MAX_INTEGER
      );
    }

    return undefined;
  }

  /**
   * Total JMT With User Delay
   * @returns - latency
   */
  public getTotalJMTWithUserDelay() {
    const clickToInterstitialWithUserDelay = this.getClickToInterstitialWithUserDelay();
    const interstitialShowedToJoinLocusResponse = this.getDiffBetweenTimestamps(
      'internal.client.meeting.interstitial-window.showed',
      'client.locus.join.response'
    );

    if (
      typeof clickToInterstitialWithUserDelay === 'number' &&
      typeof interstitialShowedToJoinLocusResponse === 'number'
    ) {
      return clamp(
        clickToInterstitialWithUserDelay + interstitialShowedToJoinLocusResponse,
        0,
        this.MAX_INTEGER
      );
    }

    return undefined;
  }

  /**
   * Join Conf JMT
   * @returns - latency
   */
  public getJoinConfJMT() {
    const joinReqResp = this.getJoinReqResp();
    const ICESetupTime = this.getICESetupTime();

    if (joinReqResp && ICESetupTime) {
      return clamp(joinReqResp + ICESetupTime, 0, this.MAX_INTEGER);
    }

    return undefined;
  }

  /**
   * Total Media JMT
   * @returns - latency
   */
  public getTotalMediaJMT() {
    const clickToInterstitial = this.getClickToInterstitial();
    const interstitialShowedToMediaEngineReady = this.getDiffBetweenTimestamps(
      'internal.client.meeting.interstitial-window.showed',
      'client.media-engine.ready'
    );
    const showInterstitialTime = this.getShowInterstitialTime() || 0;
    const stayLobbyTimeCappedByMediaEngineReady = this.getStayLobbyTimeCappedBy(
      'client.media-engine.ready'
    );

    if (
      typeof clickToInterstitial === 'number' &&
      typeof interstitialShowedToMediaEngineReady === 'number' &&
      typeof stayLobbyTimeCappedByMediaEngineReady === 'number'
    ) {
      return clamp(
        clickToInterstitial +
          interstitialShowedToMediaEngineReady -
          showInterstitialTime -
          stayLobbyTimeCappedByMediaEngineReady,
        0,
        this.MAX_INTEGER
      );
    }

    return undefined;
  }

  /**
   * Total Media JMT With User Delay
   * @returns - latency
   */
  public getTotalMediaJMTWithUserDelay() {
    const clickToInterstitialWithUserDelay = this.getClickToInterstitialWithUserDelay();
    const interstitialShowedToMediaEngineReady = this.getDiffBetweenTimestamps(
      'internal.client.meeting.interstitial-window.showed',
      'client.media-engine.ready'
    );

    if (
      typeof clickToInterstitialWithUserDelay === 'number' &&
      typeof interstitialShowedToMediaEngineReady === 'number'
    ) {
      return clamp(
        clickToInterstitialWithUserDelay + interstitialShowedToMediaEngineReady,
        0,
        this.MAX_INTEGER
      );
    }

    return undefined;
  }

  /**
   * Client JMT
   * @returns - latency
   */
  public getClientJMT() {
    const clickToInterstitialForClientJmt = this.precomputedLatencies.get(
      'internal.click.to.interstitial.for.client.jmt'
    );
    const interstitialShowedToLocusJoinRequest = this.getDiffBetweenTimestamps(
      'internal.client.meeting.interstitial-window.showed',
      'client.locus.join.request'
    );
    const showInterstitialTime = this.getShowInterstitialTime() || 0;

    if (
      typeof clickToInterstitialForClientJmt === 'number' &&
      typeof interstitialShowedToLocusJoinRequest === 'number'
    ) {
      return clamp(
        clickToInterstitialForClientJmt +
          interstitialShowedToLocusJoinRequest -
          showInterstitialTime,
        0,
        this.MAX_INTEGER
      );
    }

    return undefined;
  }

  /**
   * Audio setup delay receive
   */
  public getAudioJoinRespRxStart() {
    return this.getDiffBetweenTimestamps('client.locus.join.response', 'client.media.rx.start');
  }

  /**
   * Video setup delay receive
   */
  public getVideoJoinRespRxStart() {
    return this.getDiffBetweenTimestamps('client.locus.join.response', 'client.media.rx.start');
  }

  /**
   * Total latency for all get cluster request.
   */
  public getReachabilityClustersReqResp() {
    const reachablityClusterReqResp = this.precomputedLatencies.get('internal.get.cluster.time');

    return typeof reachablityClusterReqResp === 'number'
      ? clamp(Math.floor(reachablityClusterReqResp), 0, this.MAX_INTEGER)
      : undefined;
  }

  /**
   * Audio setup delay transmit
   */
  public getAudioJoinRespTxStart() {
    return this.getDiffBetweenTimestamps('client.locus.join.response', 'client.media.tx.start');
  }

  /**
   * Video setup delay transmit
   */
  public getVideoJoinRespTxStart() {
    return this.getDiffBetweenTimestamps('client.locus.join.response', 'client.media.tx.start');
  }

  /**
   * Time from share initiation to share stop (ms).
   */
  public getShareDuration() {
    return this.getDiffBetweenTimestamps(
      'internal.client.share.initiated',
      'internal.client.share.stopped'
    );
  }

  /**
   * Total latency for all exchange ci token.
   */
  public getExchangeCITokenJMT() {
    const exchangeCITokenJMT = this.precomputedLatencies.get('internal.exchange.ci.token.time');

    return typeof exchangeCITokenJMT === 'number'
      ? clamp(Math.floor(exchangeCITokenJMT), 0, this.MAX_INTEGER)
      : undefined;
  }

  /**
   * Total latency for all refresh captcha requests.
   */
  public getRefreshCaptchaReqResp() {
    const refreshCaptchaReqResp = this.precomputedLatencies.get('internal.refresh.captcha.time');

    return typeof refreshCaptchaReqResp === 'number'
      ? clamp(Math.floor(refreshCaptchaReqResp), 0, this.MAX_INTEGER)
      : undefined;
  }

  /**
   * Get the latency for downloading intelligence models.
   * @returns - latency
   */
  public getDownloadIntelligenceModelsReqResp() {
    const downloadIntelligenceModelsReqResp = this.precomputedLatencies.get(
      'internal.api.fetch.intelligence.models'
    );

    return typeof downloadIntelligenceModelsReqResp === 'number'
      ? clamp(Math.floor(downloadIntelligenceModelsReqResp), 0, this.MAX_INTEGER)
      : undefined;
  }

  /**
   * Get the total latency for all other app API requests.
   * Excludes meeting info, because it's measured separately.
   * @returns - latency
   */
  public getOtherAppApiReqResp() {
    const otherAppApiJMT = this.precomputedLatencies.get('internal.other.app.api.time');

    return otherAppApiJMT > 0 ? clamp(Math.floor(otherAppApiJMT), 0, this.MAX_INTEGER) : undefined;
  }
}
