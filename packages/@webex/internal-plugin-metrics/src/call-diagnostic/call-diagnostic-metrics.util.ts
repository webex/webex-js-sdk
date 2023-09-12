/* eslint-disable valid-jsdoc */
import anonymize from 'ip-anonymize';
import util from 'util';

import {BrowserDetection} from '@webex/common';
import {isEmpty, merge} from 'lodash';
import {
  ClientEvent,
  Event,
  MediaQualityEventAudioSetupDelayPayload,
  MediaQualityEventVideoSetupDelayPayload,
  MetricEventNames,
} from '../metrics.types';

const {getOSName, getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

export const anonymizeIPAddress = (localIp) => anonymize(localIp, 28, 96);

/**
 * Returns a formated string of the user agent.
 *
 * @returns {string} formatted user agent information
 */
export const userAgentToString = ({clientName, webexVersion}) => {
  let userAgentOption;
  let browserInfo;
  const clientInfo = util.format('client=%s', `${clientName}`);

  if (
    ['chrome', 'firefox', 'msie', 'msedge', 'safari'].indexOf(getBrowserName().toLowerCase()) !== -1
  ) {
    browserInfo = util.format(
      'browser=%s',
      `${getBrowserName().toLowerCase()}/${getBrowserVersion().split('.')[0]}`
    );
  }
  const osInfo = util.format('os=%s', `${getOSName()}/${getOSVersion().split('.')[0]}`);

  if (browserInfo) {
    userAgentOption = `(${browserInfo}`;
  }
  if (osInfo) {
    userAgentOption = userAgentOption
      ? `${userAgentOption}; ${clientInfo}; ${osInfo}`
      : `${clientInfo}; (${osInfo}`;
  }
  if (userAgentOption) {
    userAgentOption += ')';

    return util.format(
      'webex-js-sdk/%s %s',
      `${process.env.NODE_ENV}-${webexVersion}`,
      userAgentOption
    );
  }

  return util.format('webex-js-sdk/%s', `${process.env.NODE_ENV}-${webexVersion}`);
};

/**
 * Iterates object recursively and removes any
 * property that returns isEmpty for it's associated value
 * isEmpty = implementation from Lodash.
 *
 * It modifies the object in place (mutable)
 *
 * @param obj - input
 * @returns
 */
export const clearEmptyKeysRecursively = (obj: any) => {
  // Check if the object is empty
  if (Object.keys(obj).length === 0) {
    return;
  }

  Object.keys(obj).forEach((key) => {
    if (
      (typeof obj[key] === 'object' || typeof obj[key] === 'string' || Array.isArray(obj[key])) &&
      isEmpty(obj[key])
    ) {
      delete obj[key];
    }
    if (Array.isArray(obj[key])) {
      obj[key] = [...obj[key].filter((x) => !!x)];
    }
    if (typeof obj[key] === 'object') {
      clearEmptyKeysRecursively(obj[key]);
    }
  });
};

/**
 * Locus error codes start with 2. The next three digits are the
 * HTTP status code related to the error code (like 400, 403, 502, etc.)
 * The remaining three digits are just an increasing integer.
 * If it is 7 digits and starts with a 2, it is locus.
 *
 * @param errorCode
 * @returns
 */
export const isLocusServiceErrorCode = (errorCode: string | number) => {
  const code = `${errorCode}`;

  if (code.length === 7 && code.charAt(0) === '2') {
    return true;
  }

  return false;
};

/**
 * @param webClientDomain
 * @returns
 */
export const getBuildType = (webClientDomain): Event['origin']['buildType'] => {
  if (
    webClientDomain?.includes('localhost') ||
    webClientDomain?.includes('127.0.0.1') ||
    process.env.NODE_ENV !== 'production'
  ) {
    return 'test';
  }

  return 'prod';
};

/**
 * Prepare metric item for submission.
 * @param {Object} webex sdk instance
 * @param {Object} item
 * @returns {Object} prepared item
 */
export const prepareDiagnosticMetricItem = (webex: any, item: any) => {
  const origin: Partial<Event['origin']> = {
    buildType: getBuildType(item.event?.eventData?.webClientDomain),
    networkType: 'unknown',
  };

  // check event names and append latencies?
  const eventName = item.eventPayload?.event?.name as MetricEventNames;
  const joinTimes: ClientEvent['payload']['joinTimes'] = {};
  const audioSetupDelay: MediaQualityEventAudioSetupDelayPayload = {};
  const videoSetupDelay: MediaQualityEventVideoSetupDelayPayload = {};

  const cdl = webex.internal.newMetrics.callDiagnosticLatencies;

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
      joinTimes.clientJmt = cdl.getClientJMT();
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

    case 'client.media-engine.ready':
      joinTimes.totalMediaJMT = cdl.getTotalMediaJMT();
      joinTimes.interstitialToMediaOKJMT = cdl.getInterstitialToMediaOKJMT();
      joinTimes.callInitMediaEngineReady = cdl.getCallInitMediaEngineReady();
      joinTimes.stayLobbyTime = cdl.getStayLobbyTime();
      break;

    case 'client.mediaquality.event':
      audioSetupDelay.joinRespRxStart = cdl.getAudioJoinRespRxStart();
      audioSetupDelay.joinRespTxStart = cdl.getAudioJoinRespTxStart();
      videoSetupDelay.joinRespRxStart = cdl.getVideoJoinRespRxStart();
      videoSetupDelay.joinRespTxStart = cdl.getVideoJoinRespTxStart();
  }

  if (!isEmpty(joinTimes)) {
    item.eventPayload.event = merge(item.eventPayload.event, {joinTimes});
  }

  if (!isEmpty(audioSetupDelay)) {
    item.eventPayload.event = merge(item.eventPayload.event, {audioSetupDelay});
  }

  if (!isEmpty(videoSetupDelay)) {
    item.eventPayload.event = merge(item.eventPayload.event, {videoSetupDelay});
  }

  item.eventPayload.origin = Object.assign(origin, item.eventPayload.origin);

  return item;
};

/**
 * Sets the originTime value(s) before the request/fetch.
 * This function is only useful if you are about to submit a metrics
 * request using pre-built fetch options;
 *
 * @param {any} options
 * @returns {any} the updated options object
 */
export const setMetricTimings = (options) => {
  if (options.body && options.json) {
    const body = JSON.parse(options.body);

    const now = new Date().toISOString();
    body.metrics?.forEach((metric) => {
      if (metric.eventPayload) {
        // The event will effectively be triggered and sent at the same time.
        // The existing triggered time is from when the options were built.
        metric.eventPayload.originTime = {
          triggered: now,
          sent: now,
        };
      }
    });
    options.body = JSON.stringify(body);
  }

  return options;
};
