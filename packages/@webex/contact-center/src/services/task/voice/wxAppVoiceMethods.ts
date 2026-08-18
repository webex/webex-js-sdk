import AnswerCallOnWebexService from '../../AnswerCallOnWebexService';
import LoggerProxy from '../../../logger-proxy';
import {METHODS} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import {TaskData} from '../types';
import {TaskState} from '../state-machine';
import {
  getWebexCallingDeviceDetailsForAgent,
  WebexCallingDeviceDetails,
} from '../WebexCallingUtils';

type WxAppParticipant = {
  deviceType?: string;
  deviceCallId?: string;
  deviceId?: string;
};

export type WxAppVoiceDeps = {
  enableAnswerOnWebex: boolean;
  answerCallOnWebexService?: AnswerCallOnWebexService;
  agentId?: string;
  getTaskData: () => TaskData;
  getTaskState: () => TaskState | undefined;
  getWxAppMuted: () => boolean;
  setWxAppMuted: (muted: boolean) => void;
};

const isWxAppParticipant = (participant: unknown): participant is WxAppParticipant =>
  (participant as WxAppParticipant)?.deviceType === 'wxApp' &&
  typeof (participant as WxAppParticipant)?.deviceCallId === 'string' &&
  (participant as WxAppParticipant).deviceCallId.trim() !== '' &&
  typeof (participant as WxAppParticipant)?.deviceId === 'string' &&
  (participant as WxAppParticipant).deviceId.trim() !== '';

const isOutdialTask = (deps: WxAppVoiceDeps): boolean =>
  deps.getTaskData()?.interaction?.outboundType === 'OUTDIAL';

function getWxAppAgentParticipant(deps: WxAppVoiceDeps): unknown {
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
  deps: WxAppVoiceDeps
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

export function isWebexAppCallingOffer(deps: WxAppVoiceDeps): boolean {
  if (!deps.enableAnswerOnWebex) {
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
export function isWebexAppInboundCallingOffer(deps: WxAppVoiceDeps): boolean {
  return isWebexAppCallingOffer(deps) && !isOutdialTask(deps);
}

export function getWebexCallingCallId(deps: WxAppVoiceDeps): string | null {
  const state = deps.getTaskState();
  if (!state || state === TaskState.OFFERED || state === TaskState.IDLE) {
    return null;
  }

  return getCallingDeviceDetails(deps)?.deviceCallId ?? null;
}

export function getWxAppLineOwnerId(deps: WxAppVoiceDeps): string | undefined {
  const participant = getWxAppAgentParticipant(deps) as {lineOwnerId?: string} | undefined;
  const lineOwnerId = participant?.lineOwnerId;

  return typeof lineOwnerId === 'string' && lineOwnerId.trim() !== '' ? lineOwnerId : undefined;
}

function assertWxAppEnabled(deps: WxAppVoiceDeps): void {
  if (!deps.enableAnswerOnWebex) {
    throw new Error('enableAnswerOnWebex is disabled');
  }

  if (!deps.answerCallOnWebexService) {
    throw new Error('AnswerCallOnWebexService is unavailable');
  }
}

export async function acceptOnWebex(
  deps: WxAppVoiceDeps,
  options?: {lineOwnerId?: string}
): Promise<void> {
  assertWxAppEnabled(deps);

  if (!isWebexAppCallingOffer(deps)) {
    throw new Error('Task is not a wxApp calling offer');
  }

  const details = getCallingDeviceDetails(deps);
  if (!details) {
    throw new Error('WxApp calling device details are unavailable');
  }

  await deps.answerCallOnWebexService.answerCall({
    callId: details.deviceCallId,
    endpointId: details.deviceId,
    lineOwnerId: options?.lineOwnerId,
  });
}

export async function rejectOnWebex(
  deps: WxAppVoiceDeps,
  options?: {lineOwnerId?: string}
): Promise<void> {
  assertWxAppEnabled(deps);

  if (!isWebexAppInboundCallingOffer(deps)) {
    throw new Error('Task is not a wxApp inbound calling offer');
  }

  const details = getCallingDeviceDetails(deps);
  if (!details) {
    throw new Error('WxApp calling device details are unavailable');
  }

  await deps.answerCallOnWebexService.rejectCall({
    callId: details.deviceCallId,
    lineOwnerId: options?.lineOwnerId,
  });
}

export async function toggleMuteOnWebex(
  deps: WxAppVoiceDeps,
  options?: {lineOwnerId?: string; muted?: boolean}
): Promise<void> {
  assertWxAppEnabled(deps);

  const callId = getWebexCallingCallId(deps);
  if (!callId) {
    throw new Error('WxApp call ID is unavailable');
  }

  const targetMuted = options?.muted ?? !deps.getWxAppMuted();
  const request = targetMuted
    ? deps.answerCallOnWebexService.muteCall.bind(deps.answerCallOnWebexService)
    : deps.answerCallOnWebexService.unmuteCall.bind(deps.answerCallOnWebexService);

  await request({callId, lineOwnerId: options?.lineOwnerId});
  deps.setWxAppMuted(targetMuted);
}

export async function transmitDtmfOnWebex(
  deps: WxAppVoiceDeps,
  options: {dtmf: string; lineOwnerId?: string}
): Promise<void> {
  assertWxAppEnabled(deps);

  const callId = getWebexCallingCallId(deps);
  if (!callId) {
    throw new Error('WxApp call ID is unavailable');
  }

  LoggerProxy.info('transmitDtmfOnWebex', {
    module: 'wxAppVoiceMethods',
    method: METHODS.TRANSMIT_DTMF_ON_WEBEX,
    data: {
      callId,
      dtmfLength: options.dtmf.length,
      hasLineOwnerId: Boolean(options.lineOwnerId),
    },
  });

  await deps.answerCallOnWebexService.transmitDtmf({
    callId,
    dtmf: options.dtmf,
    lineOwnerId: options.lineOwnerId,
  });
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
