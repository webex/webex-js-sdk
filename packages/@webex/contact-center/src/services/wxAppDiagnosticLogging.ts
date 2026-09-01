import LoggerProxy from '../logger-proxy';

export const WXAPP_LOG_FEATURE = 'wxApp';
export const WXAPP_LOG_PREFIX = '[CC wxApp]';

export type WxAppAcceptReason =
  | 'wxApp_offer_ready'
  | 'wxApp_answer_pending'
  | 'wxApp_accept_in_flight'
  | 'extension_non_wxApp_offer'
  | 'browser_webrtc_offer'
  | 'outdial_auto_answer';

export type WxAppSessionSkipReason =
  | 'unsupported_browser_login'
  | 'flag_disabled'
  | 'mercury_subscribe_failed'
  | 'publish_failed';

export type WxAppTelephonyAction = 'accept' | 'decline' | 'mute' | 'dtmf';
export type WxAppTelephonyPhase = 'started' | 'success' | 'failed';

type WxAppLogData = Record<string, string | boolean | number | undefined>;

/** Last 8 chars of callId for correlation without logging full id. */
export function callIdSuffix(callId: string | null | undefined): string | undefined {
  if (!callId) {
    return undefined;
  }

  return callId.length <= 8 ? callId : callId.slice(-8);
}

function logWxApp(message: string, method: string, data: WxAppLogData): void {
  LoggerProxy.info(`${WXAPP_LOG_PREFIX} ${message}`, {
    module: 'wxAppDiagnosticLogging',
    method,
    data: {feature: WXAPP_LOG_FEATURE, ...data},
  });
}

function logWxAppError(message: string, method: string, data: WxAppLogData): void {
  LoggerProxy.error(`${WXAPP_LOG_PREFIX} ${message}`, {
    module: 'wxAppDiagnosticLogging',
    method,
    data: {feature: WXAPP_LOG_FEATURE, ...data},
  });
}

export function logWxAppSessionReadiness(params: {
  enableWxBetterTogether: boolean;
  loginOption: string | undefined;
  wxAppHooksApplied: boolean;
  usersubPublished: boolean;
  mercurySubscribed: boolean;
  telephonyTaskType: 'Voice' | 'WebRTC' | 'unknown';
  skipReason?: WxAppSessionSkipReason;
}): void {
  logWxApp('session readiness', 'logWxAppSessionReadiness', {
    event: 'session_readiness',
    enableWxBetterTogether: params.enableWxBetterTogether,
    loginOption: params.loginOption,
    wxAppHooksApplied: params.wxAppHooksApplied,
    usersubPublished: params.usersubPublished,
    mercurySubscribed: params.mercurySubscribed,
    telephonyTaskType: params.telephonyTaskType,
    skipReason: params.skipReason,
  });
}

export function deriveWxAppAcceptReason(params: {
  isWxAppInboundOffer: boolean;
  isWxAppOutdialOffer: boolean;
  isWebrtc: boolean;
  isOutdial: boolean;
  wxAppAcceptInFlight: boolean;
  wxAppAnswerPending: boolean;
  enableWxBetterTogether: boolean;
  hasDeviceCallId: boolean;
}): WxAppAcceptReason {
  if (params.isWxAppInboundOffer || params.isWxAppOutdialOffer) {
    if (params.wxAppAcceptInFlight) {
      return 'wxApp_accept_in_flight';
    }
    if (params.wxAppAnswerPending) {
      return 'wxApp_answer_pending';
    }

    return 'wxApp_offer_ready';
  }

  if (params.isWebrtc && !params.isOutdial) {
    return 'browser_webrtc_offer';
  }

  if (params.isOutdial) {
    return 'outdial_auto_answer';
  }

  if (params.enableWxBetterTogether && !params.hasDeviceCallId) {
    return 'extension_non_wxApp_offer';
  }

  return 'extension_non_wxApp_offer';
}

export function logWxAppOfferDecision(params: {
  interactionId: string;
  acceptVisible: boolean;
  acceptEnabled: boolean;
  acceptReason: WxAppAcceptReason;
  wxAppParticipantDeviceType?: string;
  hasDeviceCallId: boolean;
}): void {
  logWxApp('offer decision', 'logWxAppOfferDecision', {
    event: 'offer_decision',
    interactionId: params.interactionId,
    acceptVisible: params.acceptVisible,
    acceptEnabled: params.acceptEnabled,
    acceptReason: params.acceptReason,
    wxAppParticipantDeviceType: params.wxAppParticipantDeviceType,
    hasDeviceCallId: params.hasDeviceCallId,
  });
}

export function logWxAppTelephonyAction(params: {
  action: WxAppTelephonyAction;
  phase: WxAppTelephonyPhase;
  interactionId?: string;
  trackingId?: string;
  httpStatus?: number | string;
  failureReason?: string;
}): void {
  const payload: WxAppLogData = {
    event: 'telephony_action',
    action: params.action,
    phase: params.phase,
    interactionId: params.interactionId,
    trackingId: params.trackingId,
    httpStatus: params.httpStatus,
    failureReason: params.failureReason,
  };

  if (params.phase === 'failed') {
    logWxAppError(`telephony ${params.action} ${params.phase}`, 'logWxAppTelephonyAction', payload);
  } else {
    logWxApp(`telephony ${params.action} ${params.phase}`, 'logWxAppTelephonyAction', payload);
  }
}

export function logWxAppValidationFailure(reason: string, interactionId?: string): void {
  logWxAppError('validation failed', 'logWxAppValidationFailure', {
    event: 'validation_failed',
    reason,
    interactionId,
  });
}

export function logWxAppMercuryMuteSync(params: {
  phase: 'received' | 'applied' | 'dropped';
  muted?: boolean;
  callIdSuffix?: string;
  interactionId?: string;
  dropReason?: string;
}): void {
  logWxApp(`mercury mute sync ${params.phase}`, 'logWxAppMercuryMuteSync', {
    event: 'mercury_mute_sync',
    phase: params.phase,
    muted: params.muted,
    callIdSuffix: params.callIdSuffix,
    interactionId: params.interactionId,
    dropReason: params.dropReason,
  });
}
