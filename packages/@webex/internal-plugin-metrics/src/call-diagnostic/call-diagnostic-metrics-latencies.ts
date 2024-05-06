/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */
import {WebexPlugin} from '@webex/webex-core';

import {MetricEventNames, PreComputedLatencies} from '../metrics.types';

// we only care about client event and feature event for now

/**
 * @description Helper class to store latencies timestamp and to calculate various latencies for CA.
 * @exports
 * @class CallDiagnosticLatencies
 */
export default class CallDiagnosticLatencies extends WebexPlugin {
  latencyTimestamps: Map<MetricEventNames, number>;
  precomputedLatencies: Map<PreComputedLatencies, number>;
  // meetingId that the current latencies are for
  private meetingId?: string;

  /**
   * @constructor
   */
  constructor(...args) {
    super(...args);
    this.latencyTimestamps = new Map();
    this.precomputedLatencies = new Map();
  }

  /**
   * Clear timestamps
   */
  public clearTimestamps() {
    this.latencyTimestamps.clear();
    this.precomputedLatencies.clear();
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
      return this.webex.meetings.meetingCollection.get(this.meetingId);
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
    options?: {meetingId?: string};
  }) {
    // save the meetingId so we can use the meeting object in latency calculations if needed
    const {meetingId} = options;
    if (meetingId) {
      this.setMeetingId(meetingId);
    }
    // for some events we're only interested in the first timestamp not last
    // as these events can happen multiple times
    if (
      key === 'client.media.rx.start' ||
      key === 'client.media.tx.start' ||
      key === 'internal.client.meetinginfo.request' ||
      key === 'internal.client.meetinginfo.response'
    ) {
      this.saveFirstTimestampOnly(key, value);
    } else {
      this.latencyTimestamps.set(key, value);
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
  public saveLatency(key: PreComputedLatencies, value: number, accumulate = false) {
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
  public getDiffBetweenTimestamps(a: MetricEventNames, b: MetricEventNames) {
    const start = this.latencyTimestamps.get(a);
    const end = this.latencyTimestamps.get(b);
    if (start && end) {
      return end - start;
    }

    return undefined;
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
      'internal.client.meetinginfo.response'
    );
  }

  /**
   * Interstitial Time
   * @returns - latency
   */
  public getShowInterstitialTime() {
    return this.getDiffBetweenTimestamps(
      'client.interstitial-window.start-launch',
      'internal.client.interstitial-window.click.joinbutton'
    );
  }

  /**
   * getU2CTime
   * @returns - latency
   */
  public getU2CTime() {
    const u2cLatency = this.precomputedLatencies.get('internal.get.u2c.time');

    return u2cLatency ? Math.floor(u2cLatency) : undefined;
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
    return this.getDiffBetweenTimestamps(
      'internal.client.interstitial-window.click.joinbutton',
      'client.locus.join.request'
    );
  }

  /**
   * Locus Join Request
   * @returns - latency
   */
  public getJoinReqResp() {
    return this.getDiffBetweenTimestamps('client.locus.join.request', 'client.locus.join.response');
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
      'client.media-engine.remote-sdp-received'
    );
  }

  /**
   * ICE Setup Time
   * @returns - latency
   */
  public getICESetupTime() {
    return this.getDiffBetweenTimestamps('client.ice.start', 'client.ice.end');
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
    return this.getDiffBetweenTimestamps(
      'client.locus.join.response',
      'internal.host.meeting.participant.admitted'
    );
  }

  /**
   * Page JMT
   * @returns - latency
   */
  public getPageJMT() {
    return this.precomputedLatencies.get('internal.client.pageJMT') || undefined;
  }

  /**
   * Download Time JMT
   * @returns - latency
   */
  public getDownloadTimeJMT() {
    return this.precomputedLatencies.get('internal.download.time') || undefined;
  }

  /**
   * Click To Interstitial
   * @returns - latency
   */
  public getClickToInterstitial() {
    // for normal join (where green join button exists before interstitial, i.e reminder, space list etc)
    if (this.latencyTimestamps.get('internal.client.meeting.click.joinbutton')) {
      return this.getDiffBetweenTimestamps(
        'internal.client.meeting.click.joinbutton',
        'internal.client.meeting.interstitial-window.showed'
      );
    }

    // for cross launch and guest flows
    return this.precomputedLatencies.get('internal.click.to.interstitial') || undefined;
  }

  /**
   * Interstitial To Join Ok
   * @returns - latency
   */
  public getInterstitialToJoinOK() {
    return this.getDiffBetweenTimestamps(
      'internal.client.interstitial-window.click.joinbutton',
      'client.locus.join.response'
    );
  }

  /**
   * Call Init To MediaEngineReady
   * @returns - latency
   */
  public getCallInitMediaEngineReady() {
    return this.getDiffBetweenTimestamps(
      'internal.client.interstitial-window.click.joinbutton',
      'client.media-engine.ready'
    );
  }

  /**
   * Interstitial To Media Ok
   * @returns - latency
   */
  public getInterstitialToMediaOKJMT() {
    const interstitialJoinClickTimestamp = this.latencyTimestamps.get(
      'internal.client.interstitial-window.click.joinbutton'
    );

    // get the first timestamp
    const connectedMedia = this.latencyTimestamps.get('client.ice.end');

    const lobbyTime = this.getStayLobbyTime() || 0;

    if (interstitialJoinClickTimestamp && connectedMedia) {
      return connectedMedia - interstitialJoinClickTimestamp - lobbyTime;
    }

    return undefined;
  }

  /**
   * Total JMT
   * @returns - latency
   */
  public getTotalJMT() {
    const clickToInterstitial = this.getClickToInterstitial();
    const interstitialToJoinOk = this.getInterstitialToJoinOK();

    if (clickToInterstitial && interstitialToJoinOk) {
      return clickToInterstitial + interstitialToJoinOk;
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
      return joinReqResp + ICESetupTime;
    }

    return undefined;
  }

  /**
   * Total Media JMT
   * @returns - latency
   */
  public getTotalMediaJMT() {
    const clickToInterstitial = this.getClickToInterstitial();
    const interstitialToJoinOk = this.getInterstitialToJoinOK();
    const joinConfJMT = this.getJoinConfJMT();
    const lobbyTime = this.getStayLobbyTime();

    if (clickToInterstitial && interstitialToJoinOk && joinConfJMT) {
      const totalMediaJMT = clickToInterstitial + interstitialToJoinOk + joinConfJMT;
      if (this.getMeeting()?.allowMediaInLobby) {
        return totalMediaJMT;
      }

      return totalMediaJMT - lobbyTime;
    }

    return undefined;
  }

  /**
   * Client JMT
   * @returns - latency
   */
  public getClientJMT() {
    const interstitialToJoinOk = this.getInterstitialToJoinOK();
    const joinConfJMT = this.getJoinConfJMT();

    if (interstitialToJoinOk && joinConfJMT) {
      return interstitialToJoinOk - joinConfJMT;
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

    return reachablityClusterReqResp ? Math.floor(reachablityClusterReqResp) : undefined;
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
   * Total latency for all exchange ci token.
   */
  public getExchangeCITokenJMT() {
    const exchangeCITokenJMT = this.precomputedLatencies.get('internal.exchange.ci.token.time');

    return exchangeCITokenJMT ? Math.floor(exchangeCITokenJMT) : undefined;
  }

  /**
   * Total latency for all refresh captcha requests.
   */
  public getRefreshCaptchaReqResp() {
    const refreshCaptchaReqResp = this.precomputedLatencies.get('internal.refresh.captcha.time');

    return refreshCaptchaReqResp ? Math.floor(refreshCaptchaReqResp) : undefined;
  }

  /**
   * Get the latency for downloading intelligence models.
   * @returns - latency
   */
  public getDownloadIntelligenceModelsReqResp() {
    const downloadIntelligenceModelsReqResp = this.precomputedLatencies.get(
      'internal.api.fetch.intelligence.models'
    );

    return downloadIntelligenceModelsReqResp
      ? Math.floor(downloadIntelligenceModelsReqResp)
      : undefined;
  }

  /**
   * Get the total latency for all other app API requests.
   * Excludes meeting info, because it's measured separately.
   * @returns - latency
   */
  public getOtherAppApiReqResp() {
    const otherAppApiJMT = this.precomputedLatencies.get('internal.other.app.api.time');

    return otherAppApiJMT > 0 ? Math.floor(otherAppApiJMT) : undefined;
  }
}
