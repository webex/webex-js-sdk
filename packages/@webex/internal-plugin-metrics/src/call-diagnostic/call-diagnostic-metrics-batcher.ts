/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import {NewMetrics} from '@webex/internal-plugin-metrics';
import {isEmpty, merge} from 'lodash';
import Batcher from '../batcher';
import {ClientEvent, MetricEventNames} from '../metrics.types';

const CallDiagnosticEventsBatcher = Batcher.extend({
  namespace: 'Metrics',

  /**
   * @param webClientDomain
   * @returns
   */
  getBuildType(webClientDomain) {
    if (
      webClientDomain?.includes('localhost') ||
      webClientDomain?.includes('127.0.0.1') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return 'test';
    }

    return process.env.NODE_ENV === 'production' ? 'prod' : 'test';
  },

  /**
   * Prepare item
   * @param item
   * @returns
   */
  prepareItem(item) {
    const origin = {
      buildType: this.getBuildType(item.event?.eventData?.webClientDomain),
      networkType: 'unknown',
    };

    // check event names and append latencies?
    const eventName = item.eventPayload?.event?.name as MetricEventNames;
    const joinTimes: ClientEvent['payload']['joinTimes'] = {};
    const cdl = NewMetrics.callDiagnosticLatencies;

    switch (eventName) {
      case 'client.interstitial-window.launched':
        joinTimes.meetingInfoReqResp = cdl.getMeetingInfoReqResp();
        joinTimes.clickToInterstitial = cdl.getClickToInterstitial();
        break;

      case 'client.call.initiated':
        joinTimes.meetingInfoReqResp = cdl.getMeetingInfoReqResp();
        joinTimes.showInterstitialTime = cdl.getShowInterstitialTime();
        break;

      case 'client.locus.join.response':
        joinTimes.meetingInfoReqResp = cdl.getMeetingInfoReqResp();
        joinTimes.callInitJoinReq = cdl.getCallInitJoinReq();
        joinTimes.joinReqResp = cdl.getJoinReqResp();
        joinTimes.joinReqSentReceived = cdl.getJoinRespSentReceived();
        joinTimes.pageJmt = cdl.getPageJMT();
        joinTimes.clickToInterstitial = cdl.getClickToInterstitial();
        joinTimes.interstitialToJoinOK = cdl.getInterstitialToJoinOK();
        joinTimes.totalJmt = cdl.getTotalJMT();
        break;

      case 'client.ice.end':
        joinTimes.ICESetupTime = cdl.getICESetupTime();
        joinTimes.audioICESetupTime = cdl.getAudioICESetupTime();
        joinTimes.videoICESetupTime = cdl.getVideoICESetupTime();
        joinTimes.shareICESetupTime = cdl.getShareICESetupTime();
        break;

      case 'client.media.rx.start':
        joinTimes.localSDPGenRemoteSDPRecv = cdl.getLocalSDPGenRemoteSDPRecv();
        break;

      // TODO: Figure out equivalent for WEBRTC
      case 'client.media-engine.ready':
        joinTimes.totalMediaJMT = cdl.getTotalMediaJMT();
        break;
    }

    if (!isEmpty(joinTimes)) {
      item.eventPayload.event = merge(item.eventPayload.event, {joinTimes});
    }

    item.eventPayload.origin = Object.assign(origin, item.eventPayload.origin);

    return Promise.resolve(item);
  },

  /**
   * Prepare request, add time sensitive date etc.
   * @param queue
   * @returns
   */
  prepareRequest(queue) {
    // Add sent timestamp
    queue.forEach((item) => {
      item.eventPayload.originTime = item.eventPayload.originTime || {};
      item.eventPayload.originTime.sent = new Date().toISOString();
    });

    return Promise.resolve(queue);
  },

  /**
   *
   * @param payload
   * @returns
   */
  submitHttpRequest(payload) {
    return this.webex.request({
      method: 'POST',
      service: 'metrics',
      resource: 'clientmetrics',
      body: {
        metrics: payload,
      },
    });
  },
});

export default CallDiagnosticEventsBatcher;
