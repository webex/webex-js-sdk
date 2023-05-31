/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

export enum LatencyTimestampKey {
  meetingInfoReqStart = 'meetingInfoReqStart',
  meetingInfoReqEnd = 'meetingInfoReqEnd',
  launchInterstitial = 'launchInterstitial',
  clickJoinOnInterstitial = 'clickJoinOnInterstitial',
  locusJoinRequest = 'locusJoinRequest',
  clickJoinMeetingButton = 'clickJoinMeetingButton',
  locusJoinResponse = 'locusJoinResponse',
  localSDPReceived = 'localSDPReceived',
  localSDPGenerated = 'localSDPGenerated',
  ICEEnd = 'ICEEnd',
  ICEStart = 'ICEStart',
  audioICEStart = 'audioICEStart',
  audioICEEnd = 'audioICEEnd',
  videoICEEnd = 'videoICEEnd',
  videoICEStart = 'videoICEStart',
  shareICEStart = 'shareICEStart',
  shareICEEnd = 'shareICEEnd',
  hostAdmittedUser = 'hostAdmittedUser',
  pageJMT = 'pageJMT',
  interstitialShowed = 'interstitialShowed',
  mediaFlowStarted = 'mediaFlowStarted',
}

// we only care about client event and feature event for now

/**
 * @description Helper class to store latencies timestamp and to calculate various latencies for CA.
 * @exports
 * @class CallAnalyzerLatencies
 */
export class CallAnalyzerLatencies {
  latencyTimestamps: Map<LatencyTimestampKey, number>;

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
  public saveLatency(key: LatencyTimestampKey, value: number = new Date().getTime()) {
    this.latencyTimestamps.set(key, value);
  }

  /**
   * Helper to calculate end - start
   * @param a start
   * @param b end
   * @returns latency
   */
  private getDiffBetweenLatencies(a: LatencyTimestampKey, b: LatencyTimestampKey) {
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
      LatencyTimestampKey.meetingInfoReqStart,
      LatencyTimestampKey.meetingInfoReqEnd
    );
  }

  /**
   * Interstitial Time
   * @returns - latency
   */
  public getShowInterstitialTime() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.launchInterstitial,
      LatencyTimestampKey.clickJoinOnInterstitial
    );
  }

  /**
   * Call Init Join Request
   * @returns - latency
   */
  public getCallInitJoinReq() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.clickJoinMeetingButton,
      LatencyTimestampKey.locusJoinRequest
    );
  }

  /**
   * Locus Join Request
   * @returns - latency
   */
  public getJoinReqResp() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.locusJoinRequest,
      LatencyTimestampKey.locusJoinResponse
    );
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
      LatencyTimestampKey.localSDPGenerated,
      LatencyTimestampKey.localSDPReceived
    );
  }

  /**
   * ICE Setup Time
   * @returns - latency
   */
  public getICESetupTime() {
    return this.getDiffBetweenLatencies(LatencyTimestampKey.ICEStart, LatencyTimestampKey.ICEEnd);
  }

  /**
   * Audio ICE time
   * @returns - latency
   */
  public getAudioICESetupTime() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.audioICEStart,
      LatencyTimestampKey.audioICEEnd
    );
  }

  /**
   * Video ICE Time
   * @returns - latency
   */
  public getVideoICESetupTime() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.videoICEStart,
      LatencyTimestampKey.videoICEEnd
    );
  }

  /**
   * Share ICE Time
   * @returns - latency
   */
  public getShareICESetupTime() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.shareICEStart,
      LatencyTimestampKey.shareICEEnd
    );
  }

  /**
   * Stay Lobby Time
   * @returns - latency
   */
  public getStayLobbyTime() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.locusJoinResponse,
      LatencyTimestampKey.hostAdmittedUser
    );
  }

  /**
   * Page JMT
   * @returns - latency
   */
  public getPageJMT() {
    return this.latencyTimestamps.get(LatencyTimestampKey.pageJMT) || undefined;
  }

  /**
   * Click To Interstitial
   * @returns - latency
   */
  public getClickToInterstitial() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.clickJoinMeetingButton,
      LatencyTimestampKey.interstitialShowed
    );
  }

  /**
   * Interstitial To Join Ok
   * @returns - latency
   */
  public getInterstitialToJoinOK() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.clickJoinMeetingButton,
      LatencyTimestampKey.locusJoinResponse
    );
  }

  /**
   * Interstitial To Media Ok
   * @returns - latency
   */
  public getInterstitialToMediaOK() {
    return this.getDiffBetweenLatencies(
      LatencyTimestampKey.clickJoinMeetingButton,
      LatencyTimestampKey.mediaFlowStarted
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
}
