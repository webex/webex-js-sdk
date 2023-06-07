/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import {isEmpty, merge} from 'lodash';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import Batcher from '../batcher';
import NewMetrics from '../new-metrics';
import EventJSonSchema from './types/Event.json';
import {ClientEvent} from './types/ClientEvent';

const ajv = new Ajv();

addFormats(ajv);
const validate = ajv.compile(EventJSonSchema);

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

    // check event names and append latencies?
    const eventName = item.eventPayload?.event?.name as ClientEvent['name'];
    const joinTimes: ClientEvent['joinTimes'] = {};

    switch (eventName) {
      case 'client.locus.join.response':
        joinTimes.joinReqResp = NewMetrics.callAnalyzerLatencies.getJoinReqResp();
        joinTimes.joinReqSentReceived = NewMetrics.callAnalyzerLatencies.getJoinRespSentReceived();
        joinTimes.callInitJoinReq = NewMetrics.callAnalyzerLatencies.getCallInitJoinReq();
        break;
      case 'client.call.initiated':
        joinTimes.meetingInfoReqResp = NewMetrics.callAnalyzerLatencies.getMeetingInfoReqResp();
        joinTimes.showInterstitialTime = NewMetrics.callAnalyzerLatencies.getShowInterstitialTime();

      // eslint-disable-next-line no-fallthrough
      default:
        break;
    }

    // networkType should be a enum value: `wifi`, `ethernet`, `cellular`, or `unknown`.
    // Browsers cannot provide such information right now. However, it is a required field.
    const origin = {
      buildType: this.getBuildType(item.eventPayload?.eventData?.webClientDomain),
      // network type is supported in chrome.
      networkType: 'unknown',
    };

    item.eventPayload.origin = Object.assign(origin, item.eventPayload.origin);

    if (!isEmpty(joinTimes)) {
      item.eventPayload.event = merge(item.eventPayload.event, {joinTimes});
    }

    return Promise.resolve(item);
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

      this.logger.info(
        `Call Diagnostic Event -> Validating against JSON Schema...:\n${JSON.stringify(
          item.eventPayload
        )}`
      );

      const isValid = validate(item.eventPayload);
      if (!isValid) {
        this.logger.info(
          `Call Diagnostic Event -> Error: Event is not valid!\n${JSON.stringify(validate.errors)}`
        );
        throw new Error('Invalid event.');
      }
      this.logger.info('Call Diagnostic Event -> Event is valid!');
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
