/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import {MetricEventNames} from '../metrics.types';

// we only care about client event and feature event for now

/**
 * @description Helper class to store latencies timestamp and to calculate various latencies for CA.
 * @exports
 * @class CallDiagnosticLatencies
 */
export default class CallDiagnosticLatencies {
  latencyTimestamps: Map<MetricEventNames, number>;

  /**
   * @constructor
   */
  constructor() {
    this.latencyTimestamps = new Map();
  }

  /**
   * Clear timestamps
   */
  public clearTimestamps() {
    this.latencyTimestamps.clear();
  }

  /**
   * Store timestamp value
   * @param key - key
   * @param  value -value
   * @throws
   * @returns
   */
  public saveTimestamp(key: MetricEventNames, value: number = new Date().getTime()) {
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
      'client.interstitial-window.launched',
      'client.meeting.click.joinbutton'
    );
  }

  /**
   * Call Init Join Request
   * @returns - latency
   */
  public getCallInitJoinReq() {
    return this.getDiffBetweenTimestamps(
      'client.meeting.click.joinbutton',
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
   * Locus Join Response Sent Received
   * @returns - latency
   */
  public getJoinRespSentReceived() {
    // TODO: not clear SPARK-440554
    return undefined;
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
      'host.meeting.participant.admitted'
    );
  }

  /**
   * Page JMT
   * @returns - latency
   */
  public getPageJMT() {
    return this.latencyTimestamps.get('client.pageJMT.received') || undefined;
  }

  /**
   * Click To Interstitial
   * @returns - latency
   */
  public getClickToInterstitial() {
    return this.getDiffBetweenTimestamps(
      'client.meeting.click.joinbutton',
      'client.meeting.interstitial-window.showed'
    );
  }

  /**
   * Interstitial To Join Ok
   * @returns - latency
   */
  public getInterstitialToJoinOK() {
    return this.getDiffBetweenTimestamps(
      'client.meeting.click.joinbutton',
      'client.locus.join.response'
    );
  }

  /**
   * Interstitial To Media Ok
   * @returns - latency
   */
  public getInterstitialToMediaOK() {
    return this.getDiffBetweenTimestamps(
      'client.meeting.click.joinbutton',
      'sdk.media-flow.started'
    );
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

    if (clickToInterstitial && interstitialToJoinOk && joinConfJMT) {
      return clickToInterstitial + interstitialToJoinOk + joinConfJMT;
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
      return interstitialToJoinOk + joinConfJMT;
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
}
