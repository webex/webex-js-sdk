/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import {MetricEventNames} from '../types';

// we only care about client event and feature event for now

/**
 * @description Helper class to store latencies timestamp and to calculate various latencies for CA.
 * @exports
 * @class CallAnalyzerLatencies
 */
export default class CallAnalyzerLatencies {
  latencyTimestamps: Map<MetricEventNames, number>;

  /**
   * @constructor
   */
  constructor() {
    this.latencyTimestamps = new Map();
  }

  /**
   * Clear latencies
   */
  public clearLatencies() {
    this.latencyTimestamps.clear();
  }

  /**
   * Store Latency value
   * @param key - key
   * @param  value -value
   * @throws
   * @returns
   */
  public saveLatency(key: MetricEventNames, value: number = new Date().getTime()) {
    this.latencyTimestamps.set(key, value);
  }

  /**
   * Helper to calculate end - start
   * @param a start
   * @param b end
   * @returns latency
   */
  private getDiffBetweenLatencies(a: MetricEventNames, b: MetricEventNames) {
    const start = this.latencyTimestamps.get(a);
    const end = this.latencyTimestamps.get(b);
    if (start && end) {
      return end - start;
    }

    return undefined;
  }

  /**
   * Meeting Info Request
   * @returns - latency
   */
  public getMeetingInfoReqResp() {
    return this.getDiffBetweenLatencies(
      'client.meetinginfo.request',
      'client.meetinginfo.response'
    );
  }

  /**
   * Interstitial Time
   * @returns - latency
   */
  public getShowInterstitialTime() {
    return this.getDiffBetweenLatencies(
      'client.interstitial-window.launched', // need to add it
      'client.meeting.click.joinbutton' // need to add it
    );
  }

  /**
   * Call Init Join Request
   * @returns - latency
   */
  public getCallInitJoinReq() {
    return this.getDiffBetweenLatencies(
      'client.meeting.click.joinbutton', // need to add it
      'client.locus.join.request'
    );
  }

  /**
   * Locus Join Request
   * @returns - latency
   */
  public getJoinReqResp() {
    return this.getDiffBetweenLatencies('client.locus.join.request', 'client.locus.join.response');
  }

  /**
   * Locus Join Response Sent Received
   * @returns - latency
   */
  public getJoinRespSentReceived() {
    // TODO: not clear
    return undefined;
  }

  /**
   * Local SDP Generated Remote SDP REceived
   * @returns - latency
   */
  public getLocalSDPGenRemoteSDPRecv() {
    return this.getDiffBetweenLatencies(
      'client.media-engine.local-sdp-generated',
      'client.media-engine.remote-sdp-received'
    );
  }

  /**
   * ICE Setup Time
   * @returns - latency
   */
  public getICESetupTime() {
    return this.getDiffBetweenLatencies('client.ice.start', 'client.ice.end');
  }

  // /**
  //  * Audio ICE time
  //  * @returns - latency
  //  */
  // public getAudioICESetupTime() {
  //   return this.getDiffBetweenLatencies(
  //     LatencyTimestampKey.audioICEStart,
  //     LatencyTimestampKey.audioICEEnd
  //   );
  // }

  // /**
  //  * Video ICE Time
  //  * @returns - latency
  //  */
  // public getVideoICESetupTime() {
  //   return this.getDiffBetweenLatencies(
  //     LatencyTimestampKey.videoICEStart,
  //     LatencyTimestampKey.videoICEEnd
  //   );
  // }

  // /**
  //  * Share ICE Time
  //  * @returns - latency
  //  */
  // public getShareICESetupTime() {
  //   return this.getDiffBetweenLatencies(
  //     LatencyTimestampKey.shareICEStart,
  //     LatencyTimestampKey.shareICEEnd
  //   );
  // }

  // /**
  //  * Stay Lobby Time
  //  * @returns - latency
  //  */
  // public getStayLobbyTime() {
  //   return this.getDiffBetweenLatencies(
  //     'client.locus.join.response',
  //     LatencyTimestampKey.hostAdmittedUser
  //   );
  // }

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
    return this.getDiffBetweenLatencies(
      'client.meeting.click.joinbutton', // need to add it
      'client.meeting.interstitial-window.showed' // need to add it
    );
  }

  /**
   * Interstitial To Join Ok
   * @returns - latency
   */
  public getInterstitialToJoinOK() {
    return this.getDiffBetweenLatencies(
      'client.meeting.click.joinbutton', // need to add it
      'client.locus.join.response'
    );
  }

  // /**
  //  * Interstitial To Media Ok
  //  * @returns - latency
  //  */
  // public getInterstitialToMediaOK() {
  //   return this.getDiffBetweenLatencies(
  //     'client.meeting.click.joinbutton', // need to add it
  //     LatencyTimestampKey.mediaFlowStarted
  //   );
  // }

  /**
   * Total JMT
   * @returns - latency
   */
  public getTotalJMT() {
    const clickToInterstitial = this.getClickToInterstitial();
    const interstitialToJoinOk = this.getInterstitialToJoinOK();

    if (clickToInterstitial && interstitialToJoinOk) {
      return clickToInterstitial - interstitialToJoinOk;
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
    return this.getDiffBetweenLatencies('client.locus.join.response', 'client.media.rx.start');
  }

  /**
   * Video setup delay receive
   */
  public getVideoJoinRespRxStart() {
    return this.getDiffBetweenLatencies('client.locus.join.response', 'client.media.rx.start');
  }

  /**
   * Audio setup delay transmit
   */
  public getAudioJoinRespTxStart() {
    return this.getDiffBetweenLatencies('client.locus.join.response', 'client.media.tx.start');
  }

  /**
   * Video setup delay transmit
   */
  public getVideoJoinRespTxStart() {
    return this.getDiffBetweenLatencies('client.locus.join.response', 'client.media.tx.start');
  }
}
