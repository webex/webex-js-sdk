/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import {ClientEvent} from '@webex/internal-plugin-metrics/src/ClientEvent';
import {merge} from 'lodash';
import Batcher from './batcher';
import Metrics from './metrics';

const CallDiagnosticEventsBatcher = Batcher.extend({
  namespace: 'Metrics',

  /**
   * @param {string} webClientDomain
   * @returns {string}
   */
  getBuildType(webClientDomain) {
    if (
      webClientDomain?.includes('teams.webex.com') ||
      webClientDomain?.includes('localhost') ||
      webClientDomain?.includes('127.0.0.1') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return 'test';
    }

    return process.env.NODE_ENV === 'production' ? 'prod' : 'test';
  },

  /**
   *
   * @param item
   * @returns
   */
  prepareItem(item) {
    // metrics-a payload type
    const finalEvent = {
      eventPayload: item,
      type: ['diagnostic-event'],
    };

    // check event names and append latencies?
    const eventName = finalEvent.eventPayload?.name as ClientEvent['name'];
    const joinTimes: ClientEvent['joinTimes'] = {};

    switch (eventName) {
      case 'client.locus.join.response':
        joinTimes.joinReqResp = Metrics.callAnalyzerLatencies.getJoinReqResp();
        joinTimes.joinReqSentReceived = Metrics.callAnalyzerLatencies.getJoinRespSentReceived();
        joinTimes.callInitJoinReq = Metrics.callAnalyzerLatencies.getCallInitJoinReq();
        break;
      case 'client.call.initiated':
        joinTimes.meetingInfoReqResp = Metrics.callAnalyzerLatencies.getMeetingInfoReqResp();
        joinTimes.showInterstitialTime = Metrics.callAnalyzerLatencies.getShowInterstitialTime();

      // eslint-disable-next-line no-fallthrough
      default:
        break;
    }

    // networkType should be a enum value: `wifi`, `ethernet`, `cellular`, or `unknown`.
    // Browsers cannot provide such information right now. However, it is a required field.
    const origin = {
      // TODO: suspect this is wrong, it was event.eventData.... it should be item.eventPayload.eventData.webClientDomain
      buildType: this.getBuildType(finalEvent.eventPayload?.eventData?.webClientDomain),
      // network type is supported in chrome.
      networkType: 'unknown',
    };

    finalEvent.eventPayload.origin = Object.assign(origin, finalEvent.eventPayload.origin);
    finalEvent.eventPayload = merge(finalEvent.eventPayload, {joinTimes});

    return Promise.resolve(finalEvent);
  },

  /**
   *
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
