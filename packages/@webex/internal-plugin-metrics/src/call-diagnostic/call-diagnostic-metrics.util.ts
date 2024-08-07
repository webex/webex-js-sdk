/* eslint-disable valid-jsdoc */
import anonymize from 'ip-anonymize';
import util from 'util';

import {BrowserDetection} from '@webex/common';
import {WebexHttpError} from '@webex/webex-core';
import {isEmpty, merge} from 'lodash';
import {
  ClientEvent,
  Event,
  MediaQualityEventAudioSetupDelayPayload,
  MediaQualityEventVideoSetupDelayPayload,
  MetricEventNames,
} from '../metrics.types';
import {
  BROWSER_MEDIA_ERROR_NAME_TO_CLIENT_ERROR_CODES_MAP,
  DTLS_HANDSHAKE_FAILED_CLIENT_CODE,
  ICE_FAILED_WITHOUT_TURN_TLS_CLIENT_CODE,
  ICE_FAILED_WITH_TURN_TLS_CLIENT_CODE,
  ICE_FAILURE_CLIENT_CODE,
  MISSING_ROAP_ANSWER_CLIENT_CODE,
  WBX_APP_API_URL,
  ERROR_DESCRIPTIONS,
} from './config';

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
 * @returns {boolean}
 */
export const isLocusServiceErrorCode = (errorCode: string | number) => {
  const code = `${errorCode}`;

  if (code.length === 7 && code.charAt(0) === '2') {
    return true;
  }

  return false;
};

/**
 * MeetingInfo errors sometimes has body.data.meetingInfo object
 * MeetingInfo errors come with a wbxappapi url
 *
 * @param {Object} rawError
 * @returns {boolean}
 */
export const isMeetingInfoServiceError = (rawError: any) => {
  if (rawError.body?.data?.meetingInfo || rawError.body?.url?.includes(WBX_APP_API_URL)) {
    return true;
  }

  return false;
};

/**
 * Returns true if the raw error is a network related error
 *
 * @param {Object} rawError
 * @returns {boolean}
 */
export const isNetworkError = (rawError: any) => {
  if (rawError instanceof WebexHttpError.NetworkOrCORSError) {
    return true;
  }

  return false;
};

/**
 * Returns true if the error is an unauthorized error
 *
 * @param {Object} rawError
 * @returns {boolean}
 */
export const isUnauthorizedError = (rawError: any) => {
  if (rawError instanceof WebexHttpError.Unauthorized) {
    return true;
  }

  return false;
};

/**
 * Returns true if the error is an SdpOfferCreation error
 *
 * @param {Object} rawError
 * @returns {boolean}
 */
export const isSdpOfferCreationError = (rawError: any) => {
  // would LIKE to do rawError instanceof Errors.SdpOfferCreationError
  // but including internal-media-core in plugin-metrics breaks meetings and metrics unit tests
  if (rawError.name === ERROR_DESCRIPTIONS.SDP_OFFER_CREATION_ERROR) {
    return true;
  }

  return false;
};

/**
 * MDN Media Devices getUserMedia() method returns a name if it errs
 * Documentation can be found here: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 *
 * @param errorCode
 * @returns
 */
export const isBrowserMediaErrorName = (errorName: any) => {
  if (BROWSER_MEDIA_ERROR_NAME_TO_CLIENT_ERROR_CODES_MAP[errorName]) {
    return true;
  }

  return false;
};

/**
 * @param webClientDomain
 * @returns
 */
export const getBuildType = (
  webClientDomain,
  markAsTestEvent = false
): Event['origin']['buildType'] => {
  // used temporary to test pre join in production without creating noise data, SPARK-468456
  if (markAsTestEvent) {
    return 'test';
  }

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
    buildType: getBuildType(
      item.eventPayload?.event?.eventData?.webClientDomain,
      item.eventPayload?.event?.eventData?.markAsTestEvent
    ),
    networkType: 'unknown',
  };

  // check event names and append latencies?
  const eventName = item.eventPayload?.event?.name as MetricEventNames;
  const joinTimes: ClientEvent['payload']['joinTimes'] = {};
  const audioSetupDelay: MediaQualityEventAudioSetupDelayPayload = {};
  const videoSetupDelay: MediaQualityEventVideoSetupDelayPayload = {};

  const cdl = webex.internal.newMetrics.callDiagnosticLatencies;

  switch (eventName) {
    case 'client.webexapp.launched':
      joinTimes.downloadTime = cdl.getDownloadTimeJMT();
      break;
    case 'client.login.end':
      joinTimes.otherAppApiReqResp = cdl.getOtherAppApiReqResp();
      joinTimes.exchangeCITokenJMT = cdl.getExchangeCITokenJMT();
      break;
    case 'client.interstitial-window.launched':
      joinTimes.meetingInfoReqResp = cdl.getMeetingInfoReqResp();
      joinTimes.clickToInterstitial = cdl.getClickToInterstitial();
      joinTimes.refreshCaptchaServiceReqResp = cdl.getRefreshCaptchaReqResp();
      joinTimes.downloadIntelligenceModelsReqResp = cdl.getDownloadIntelligenceModelsReqResp();
      break;

    case 'client.call.initiated':
      joinTimes.meetingInfoReqResp = cdl.getMeetingInfoReqResp();
      joinTimes.showInterstitialTime = cdl.getShowInterstitialTime();
      joinTimes.registerWDMDeviceJMT = cdl.getRegisterWDMDeviceJMT();
      joinTimes.getU2CTime = cdl.getU2CTime();
      joinTimes.getReachabilityClustersReqResp = cdl.getReachabilityClustersReqResp();
      break;

    case 'client.locus.join.response':
      joinTimes.meetingInfoReqResp = cdl.getMeetingInfoReqResp();
      joinTimes.callInitJoinReq = cdl.getCallInitJoinReq();
      joinTimes.joinReqResp = cdl.getJoinReqResp();
      joinTimes.pageJmt = cdl.getPageJMT();
      joinTimes.clickToInterstitial = cdl.getClickToInterstitial();
      joinTimes.interstitialToJoinOK = cdl.getInterstitialToJoinOK();
      joinTimes.totalJmt = cdl.getTotalJMT();
      joinTimes.clientJmt = cdl.getClientJMT();
      joinTimes.downloadTime = cdl.getDownloadTimeJMT();
      break;

    case 'client.ice.end':
      joinTimes.ICESetupTime = cdl.getICESetupTime();
      joinTimes.audioICESetupTime = cdl.getAudioICESetupTime();
      joinTimes.videoICESetupTime = cdl.getVideoICESetupTime();
      joinTimes.shareICESetupTime = cdl.getShareICESetupTime();
      break;

    case 'client.media.rx.start':
      joinTimes.localSDPGenRemoteSDPRecv = cdl.getLocalSDPGenRemoteSDPRecv();
      audioSetupDelay.joinRespRxStart = cdl.getAudioJoinRespRxStart();
      videoSetupDelay.joinRespRxStart = cdl.getVideoJoinRespRxStart();
      break;

    case 'client.media-engine.ready':
      joinTimes.totalMediaJMT = cdl.getTotalMediaJMT();
      joinTimes.interstitialToMediaOKJMT = cdl.getInterstitialToMediaOKJMT();
      joinTimes.callInitMediaEngineReady = cdl.getCallInitMediaEngineReady();
      joinTimes.stayLobbyTime = cdl.getStayLobbyTime();
      break;

    case 'client.media.tx.start':
      audioSetupDelay.joinRespTxStart = cdl.getAudioJoinRespTxStart();
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

  webex.logger.log(
    `CallDiagnosticLatencies,prepareDiagnosticMetricItem: ${JSON.stringify({
      latencies: Object.fromEntries(cdl.latencyTimestamps),
      event: item,
    })}`
  );

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

export const extractVersionMetadata = (version: string) => {
  // extract major and minor version
  const [majorVersion, minorVersion] = version.split('.');

  return {
    majorVersion: parseInt(majorVersion, 10),
    minorVersion: parseInt(minorVersion, 10),
  };
};

/**
 * Generates client error codes for specific ice failures
 * that happen when trying to add media in a meeting.
 */
export const generateClientErrorCodeForIceFailure = ({
  signalingState,
  iceConnected,
  turnServerUsed,
}: {
  signalingState: RTCPeerConnection['signalingState'];
  iceConnected: boolean;
  turnServerUsed: boolean;
}) => {
  let errorCode = ICE_FAILURE_CLIENT_CODE; // default;

  if (signalingState === 'have-local-offer') {
    errorCode = MISSING_ROAP_ANSWER_CLIENT_CODE;
  }

  if (signalingState === 'stable' && iceConnected) {
    errorCode = DTLS_HANDSHAKE_FAILED_CLIENT_CODE;
  }

  if (signalingState !== 'have-local-offer' && !iceConnected) {
    if (turnServerUsed) {
      errorCode = ICE_FAILED_WITH_TURN_TLS_CLIENT_CODE;
    } else {
      errorCode = ICE_FAILED_WITHOUT_TURN_TLS_CLIENT_CODE;
    }
  }

  return errorCode;
};
