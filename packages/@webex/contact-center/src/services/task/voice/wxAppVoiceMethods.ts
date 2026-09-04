import AnswerCallOnWebexService, {WxAppTelephonyError} from '../../AnswerCallOnWebexService';
import LoggerProxy from '../../../logger-proxy';
import {METHODS} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import {TaskData, TaskToggleMuteOptions, TaskTransmitDtmfOptions} from '../types';
import {TaskState} from '../state-machine';
import MetricsManager from '../../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';
import {
  decodedLineOwnerId,
  getWebexCallingDeviceDetailsForAgent,
  WebexCallingDeviceDetails,
} from '../WebexCallingUtils';
import {
  logWxAppTelephonyAction,
  logWxAppValidationFailure,
  type WxAppTelephonyAction,
} from '../../wxAppDiagnosticLogging';

type WxAppParticipant = {
  deviceType?: string;
  deviceCallId?: string;
  deviceId?: string;
};

export type WxAppVoiceDependencies = {
  enableWxBetterTogether: boolean;
  answerCallOnWebexService?: AnswerCallOnWebexService;
  agentId?: string;
  metricsManager: MetricsManager;
  getTaskData: () => TaskData;
  getTaskState: () => TaskState | undefined;
  getWxAppMuted: () => boolean;
  setWxAppMuted: (muted: boolean) => void;
};

/** @deprecated Use {@link WxAppVoiceDependencies} */
export type WxAppVoiceDeps = WxAppVoiceDependencies;

export type WxAppVoiceLifecycle = {
  setWxAppAcceptInFlight: (inFlight: boolean) => void;
  setWxAppAnswerPending: (pending: boolean) => void;
  resetWxAppMuted: () => void;
  syncWxAppMuteFromCallDetails: () => Promise<boolean | undefined>;
  mapWxAppVoiceError: (error: unknown, method: string) => never;
};

const isWxAppParticipant = (participant: unknown): participant is WxAppParticipant =>
  (participant as WxAppParticipant)?.deviceType === 'wxApp' &&
  typeof (participant as WxAppParticipant)?.deviceCallId === 'string' &&
  (participant as WxAppParticipant).deviceCallId.trim() !== '' &&
  typeof (participant as WxAppParticipant)?.deviceId === 'string' &&
  (participant as WxAppParticipant).deviceId.trim() !== '';

const isOutdialTask = (deps: WxAppVoiceDependencies): boolean =>
  deps.getTaskData()?.interaction?.outboundType === 'OUTDIAL';

function getWxAppAgentParticipant(deps: WxAppVoiceDependencies): unknown {
  const taskData = deps.getTaskData();
  const participants = taskData.interaction?.participants;
  const agentId = deps.agentId ?? taskData.agentId;

  if (!participants || !agentId) {
    return undefined;
  }

  if (participants[agentId]) {
    return participants[agentId];
  }

  return Object.values(participants).find(
    (participant) => (participant as {id?: string})?.id === agentId
  );
}

export function getCallingDeviceDetails(
  deps: WxAppVoiceDependencies
): WebexCallingDeviceDetails | undefined {
  const taskData = deps.getTaskData();
  const participant = getWxAppAgentParticipant(deps);

  if (!isWxAppParticipant(participant)) {
    return undefined;
  }

  return getWebexCallingDeviceDetailsForAgent(
    deps.agentId ?? taskData.agentId,
    taskData.interaction?.participants
  );
}

export function isWebexAppCallingOffer(deps: WxAppVoiceDependencies): boolean {
  if (!deps.enableWxBetterTogether) {
    return false;
  }

  const state = deps.getTaskState();
  if (state !== TaskState.OFFERED) {
    return false;
  }

  const details = getCallingDeviceDetails(deps);

  return Boolean(details);
}

/** Inbound wxApp offer only — outdial decline uses CC routing, not telephony reject. */
export function isWebexAppInboundCallingOffer(deps: WxAppVoiceDependencies): boolean {
  return isWebexAppCallingOffer(deps) && !isOutdialTask(deps);
}

export function getWebexCallingCallId(deps: WxAppVoiceDependencies): string | null {
  const state = deps.getTaskState();
  if (
    !state ||
    state === TaskState.OFFERED ||
    state === TaskState.IDLE ||
    state === TaskState.WRAPPING_UP ||
    state === TaskState.TERMINATED ||
    state === TaskState.COMPLETED
  ) {
    return null;
  }

  return getCallingDeviceDetails(deps)?.deviceCallId ?? null;
}

export function getWxAppLineOwnerId(deps: WxAppVoiceDependencies): string | undefined {
  const participant = getWxAppAgentParticipant(deps) as {lineOwnerId?: string} | undefined;
  const lineOwnerId = participant?.lineOwnerId;

  return typeof lineOwnerId === 'string' && lineOwnerId.trim() !== '' ? lineOwnerId : undefined;
}

export function resolveWxAppLineOwnerId(
  deps: WxAppVoiceDependencies,
  override?: string
): string | undefined {
  if (typeof override === 'string' && override.trim() !== '') {
    return override;
  }

  return decodedLineOwnerId(getWxAppLineOwnerId(deps));
}

function getInteractionId(deps: WxAppVoiceDependencies): string | undefined {
  return deps.getTaskData()?.interactionId;
}

function logTelephonyFailure(
  action: WxAppTelephonyAction,
  deps: WxAppVoiceDependencies,
  error: unknown
): void {
  const wxError = error as WxAppTelephonyError;
  logWxAppTelephonyAction({
    action,
    phase: 'failed',
    interactionId: getInteractionId(deps),
    trackingId: wxError.trackingId,
    httpStatus: wxError.status,
    failureReason: wxError.message,
  });
}

function getWxAppTelephonyMetricFailurePayload(
  deps: WxAppVoiceDependencies,
  error: unknown
): Record<string, string> {
  const wxError = error as WxAppTelephonyError;
  const payload: Record<string, string> = {
    taskId: getInteractionId(deps) ?? '',
    error: error instanceof Error ? error.toString() : String(error),
  };

  if (wxError.trackingId) {
    payload.trackingId = wxError.trackingId;
  }

  return payload;
}

function assertWxAppEnabled(deps: WxAppVoiceDependencies): void {
  if (!deps.enableWxBetterTogether) {
    logWxAppValidationFailure('enableWxBetterTogether_disabled', getInteractionId(deps));
    throw new Error('enableWxBetterTogether is disabled');
  }

  if (!deps.answerCallOnWebexService) {
    logWxAppValidationFailure('answer_call_on_webex_service_unavailable', getInteractionId(deps));
    throw new Error('AnswerCallOnWebexService is unavailable');
  }
}

export async function acceptOnWebex(
  deps: WxAppVoiceDependencies,
  options?: {lineOwnerId?: string}
): Promise<void> {
  const interactionId = getInteractionId(deps);
  logWxAppTelephonyAction({action: 'accept', phase: 'started', interactionId});
  assertWxAppEnabled(deps);

  if (!isWebexAppCallingOffer(deps)) {
    logWxAppValidationFailure('not_wxApp_calling_offer', interactionId);
    throw new Error('Task is not a wxApp calling offer');
  }

  const details = getCallingDeviceDetails(deps);
  if (!details) {
    logWxAppValidationFailure('wxApp_device_details_unavailable', interactionId);
    throw new Error('WxApp calling device details are unavailable');
  }

  await deps.answerCallOnWebexService.answerCall({
    callId: details.deviceCallId,
    endpointId: details.deviceId,
    lineOwnerId: resolveWxAppLineOwnerId(deps, options?.lineOwnerId),
  });
  logWxAppTelephonyAction({action: 'accept', phase: 'success', interactionId});
}

export async function rejectOnWebex(
  deps: WxAppVoiceDependencies,
  options?: {lineOwnerId?: string}
): Promise<void> {
  const interactionId = getInteractionId(deps);
  logWxAppTelephonyAction({action: 'decline', phase: 'started', interactionId});
  assertWxAppEnabled(deps);

  if (!isWebexAppInboundCallingOffer(deps)) {
    logWxAppValidationFailure('not_wxApp_inbound_calling_offer', interactionId);
    throw new Error('Task is not a wxApp inbound calling offer');
  }

  const details = getCallingDeviceDetails(deps);
  if (!details) {
    logWxAppValidationFailure('wxApp_device_details_unavailable', interactionId);
    throw new Error('WxApp calling device details are unavailable');
  }

  await deps.answerCallOnWebexService.rejectCall({
    callId: details.deviceCallId,
    lineOwnerId: resolveWxAppLineOwnerId(deps, options?.lineOwnerId),
  });
  logWxAppTelephonyAction({action: 'decline', phase: 'success', interactionId});
}

export async function toggleMuteOnWebex(
  deps: WxAppVoiceDependencies,
  options?: {lineOwnerId?: string; muted?: boolean}
): Promise<void> {
  const interactionId = getInteractionId(deps);
  logWxAppTelephonyAction({action: 'mute', phase: 'started', interactionId});
  assertWxAppEnabled(deps);

  const callId = getWebexCallingCallId(deps);
  if (!callId) {
    logWxAppValidationFailure('wxApp_call_id_unavailable', interactionId);
    throw new Error('WxApp call ID is unavailable');
  }

  const targetMuted = options?.muted ?? !deps.getWxAppMuted();
  const request = targetMuted
    ? deps.answerCallOnWebexService.muteCall.bind(deps.answerCallOnWebexService)
    : deps.answerCallOnWebexService.unmuteCall.bind(deps.answerCallOnWebexService);

  await request({
    callId,
    lineOwnerId: resolveWxAppLineOwnerId(deps, options?.lineOwnerId),
  });
  deps.setWxAppMuted(targetMuted);
  logWxAppTelephonyAction({action: 'mute', phase: 'success', interactionId});
}

export async function transmitDtmfOnWebex(
  deps: WxAppVoiceDependencies,
  options: {dtmf: string; lineOwnerId?: string}
): Promise<void> {
  const interactionId = getInteractionId(deps);
  logWxAppTelephonyAction({action: 'dtmf', phase: 'started', interactionId});
  assertWxAppEnabled(deps);

  const callId = getWebexCallingCallId(deps);
  if (!callId) {
    logWxAppValidationFailure('wxApp_call_id_unavailable', interactionId);
    throw new Error('WxApp call ID is unavailable');
  }

  LoggerProxy.info('transmitDtmf', {
    module: 'wxAppVoiceMethods',
    method: METHODS.TRANSMIT_DTMF,
    data: {
      interactionId,
      callIdSuffix: callId.length <= 8 ? callId : callId.slice(-8),
      dtmfLength: options.dtmf.length,
      hasLineOwnerId: Boolean(options.lineOwnerId),
    },
  });

  await deps.answerCallOnWebexService.transmitDtmf({
    callId,
    dtmf: options.dtmf,
    lineOwnerId: resolveWxAppLineOwnerId(deps, options.lineOwnerId),
  });
  logWxAppTelephonyAction({action: 'dtmf', phase: 'success', interactionId});
}

export async function runWxAppAccept(
  deps: WxAppVoiceDependencies,
  lifecycle: WxAppVoiceLifecycle,
  options?: {lineOwnerId?: string}
): Promise<void> {
  const taskId = getInteractionId(deps);

  deps.metricsManager.timeEvent([
    METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_SUCCESS,
    METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_FAILED,
  ]);

  try {
    lifecycle.setWxAppAcceptInFlight(true);
    lifecycle.setWxAppAnswerPending(true);
    await acceptOnWebex(deps, options);
    lifecycle.resetWxAppMuted();
    await lifecycle.syncWxAppMuteFromCallDetails();

    deps.metricsManager.trackEvent(METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_SUCCESS, {taskId}, [
      'operational',
      'behavioral',
    ]);
  } catch (error) {
    lifecycle.setWxAppAnswerPending(false);
    logTelephonyFailure('accept', deps, error);
    deps.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_FAILED,
      getWxAppTelephonyMetricFailurePayload(deps, error),
      ['operational', 'behavioral']
    );
    lifecycle.mapWxAppVoiceError(error, METHODS.ACCEPT);
  } finally {
    lifecycle.setWxAppAcceptInFlight(false);
  }
}

export async function runWxAppReject(
  deps: WxAppVoiceDependencies,
  lifecycle: WxAppVoiceLifecycle,
  options?: {lineOwnerId?: string}
): Promise<void> {
  const taskId = getInteractionId(deps);

  deps.metricsManager.timeEvent([
    METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
    METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
  ]);

  try {
    await rejectOnWebex(deps, options);

    deps.metricsManager.trackEvent(METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS, {taskId}, [
      'operational',
      'behavioral',
    ]);
  } catch (error) {
    logTelephonyFailure('decline', deps, error);
    deps.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
      getWxAppTelephonyMetricFailurePayload(deps, error),
      ['operational', 'behavioral']
    );
    lifecycle.mapWxAppVoiceError(error, METHODS.REJECT);
  }
}

export async function runWxAppOutdialDecline<T>(
  deps: WxAppVoiceDependencies,
  executeCancel: () => Promise<T>
): Promise<T> {
  const taskId = getInteractionId(deps);

  deps.metricsManager.timeEvent([
    METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
    METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
  ]);

  try {
    const result = await executeCancel();

    deps.metricsManager.trackEvent(METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS, {taskId}, [
      'operational',
      'behavioral',
    ]);

    return result;
  } catch (error) {
    logTelephonyFailure('decline', deps, error);
    deps.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
      getWxAppTelephonyMetricFailurePayload(deps, error),
      ['operational', 'behavioral']
    );
    throw error;
  }
}

export async function runWxAppToggleMute(
  deps: WxAppVoiceDependencies,
  lifecycle: WxAppVoiceLifecycle,
  options?: TaskToggleMuteOptions
): Promise<void> {
  const taskId = getInteractionId(deps);

  deps.metricsManager.timeEvent([
    METRIC_EVENT_NAMES.WXAPP_TASK_MUTE_SUCCESS,
    METRIC_EVENT_NAMES.WXAPP_TASK_MUTE_FAILED,
  ]);

  try {
    await toggleMuteOnWebex(deps, options);

    deps.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WXAPP_TASK_MUTE_SUCCESS,
      {taskId, targetMuted: deps.getWxAppMuted()},
      ['operational', 'behavioral']
    );
  } catch (error) {
    logTelephonyFailure('mute', deps, error);
    deps.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WXAPP_TASK_MUTE_FAILED,
      getWxAppTelephonyMetricFailurePayload(deps, error),
      ['operational', 'behavioral']
    );
    lifecycle.mapWxAppVoiceError(error, METHODS.TOGGLE_MUTE);
  }
}

export async function runWxAppTransmitDtmf(
  deps: WxAppVoiceDependencies,
  lifecycle: WxAppVoiceLifecycle,
  options: TaskTransmitDtmfOptions
): Promise<void> {
  const taskId = getInteractionId(deps);

  deps.metricsManager.timeEvent([
    METRIC_EVENT_NAMES.WXAPP_TASK_DTMF_SUCCESS,
    METRIC_EVENT_NAMES.WXAPP_TASK_DTMF_FAILED,
  ]);

  try {
    await transmitDtmfOnWebex(deps, options);

    deps.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WXAPP_TASK_DTMF_SUCCESS,
      {taskId, dtmfLength: options.dtmf.length},
      ['operational', 'behavioral']
    );
  } catch (error) {
    logTelephonyFailure('dtmf', deps, error);
    deps.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WXAPP_TASK_DTMF_FAILED,
      getWxAppTelephonyMetricFailurePayload(deps, error),
      ['operational', 'behavioral']
    );
    lifecycle.mapWxAppVoiceError(error, METHODS.TRANSMIT_DTMF);
  }
}

export function mapWxAppVoiceError(error: unknown, method: string, module: string): never {
  if (
    error instanceof Error &&
    (error as Error & {isWxAppTelephonyError?: boolean}).isWxAppTelephonyError
  ) {
    throw error;
  }

  const {error: detailedError} = getErrorDetails(error, method, module);
  throw detailedError;
}
