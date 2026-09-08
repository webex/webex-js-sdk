import {TaskState} from './state-machine/constants';

export type WebexCallingDeviceDetails = {
  deviceType: string;
  deviceId: string;
  deviceCallId: string;
};

type WebexCallingParticipant = {
  id?: unknown;
  deviceType?: unknown;
  deviceCallId?: unknown;
  deviceId?: unknown;
};

const normalizeId = (id: unknown): string | undefined => {
  if (typeof id !== 'string') {
    return undefined;
  }

  const normalizedId = id.trim();

  return normalizedId === '' ? undefined : normalizedId;
};

const isParticipantsById = (participants: unknown): participants is Record<string, unknown> =>
  Boolean(participants) &&
  typeof participants === 'object' &&
  !Array.isArray(participants) &&
  !(participants instanceof Map);

const hasWebexCallingDeviceDetails = (
  participant: unknown
): participant is WebexCallingParticipant &
  Pick<WebexCallingDeviceDetails, 'deviceCallId' | 'deviceId'> => {
  const participantDetails = participant as WebexCallingParticipant | undefined;

  return (
    typeof participantDetails?.deviceCallId === 'string' &&
    participantDetails.deviceCallId.trim() !== '' &&
    typeof participantDetails?.deviceId === 'string' &&
    participantDetails.deviceId.trim() !== ''
  );
};

const isWebexCallingParticipantForAgent = (
  participant: unknown,
  agentId: string
): participant is WebexCallingParticipant &
  Pick<WebexCallingDeviceDetails, 'deviceCallId' | 'deviceId'> => {
  const participantDetails = participant as WebexCallingParticipant | undefined;

  return (
    normalizeId(participantDetails?.id) === agentId && hasWebexCallingDeviceDetails(participant)
  );
};

const getWebexCallingDeviceDetails = (
  participant: WebexCallingParticipant &
    Pick<WebexCallingDeviceDetails, 'deviceCallId' | 'deviceId'>
): WebexCallingDeviceDetails => ({
  deviceType: typeof participant.deviceType === 'string' ? participant.deviceType : '',
  deviceId: participant.deviceId,
  deviceCallId: participant.deviceCallId,
});

export function getWebexCallingDeviceDetailsForAgent(
  agentId: string | undefined,
  participants: unknown
): WebexCallingDeviceDetails | undefined {
  const normalizedAgentId = normalizeId(agentId);
  if (!normalizedAgentId || !isParticipantsById(participants)) {
    return undefined;
  }

  const agentParticipant = participants[normalizedAgentId];
  const matchingAgentParticipant = hasWebexCallingDeviceDetails(agentParticipant)
    ? agentParticipant
    : Object.values(participants).find((participant) =>
        isWebexCallingParticipantForAgent(participant, normalizedAgentId)
      );

  if (!matchingAgentParticipant || !hasWebexCallingDeviceDetails(matchingAgentParticipant)) {
    return undefined;
  }

  return getWebexCallingDeviceDetails(matchingAgentParticipant);
}

export function isWebexCallingCallForAgent(
  agentId: string | undefined,
  participants: unknown
): boolean {
  return Boolean(getWebexCallingDeviceDetailsForAgent(agentId, participants));
}

/** Matches wxAppVoiceMethods.getWebexCallingCallId engaged semantics for uiControls. */
export function isWxAppEngagedForControls(
  enableWxBetterTogether: boolean,
  agentId: string | undefined,
  participants: unknown,
  state: TaskState
): boolean {
  if (!enableWxBetterTogether) {
    return false;
  }

  if (
    !state ||
    state === TaskState.OFFERED ||
    state === TaskState.IDLE ||
    state === TaskState.WRAPPING_UP ||
    state === TaskState.TERMINATED ||
    state === TaskState.COMPLETED
  ) {
    return false;
  }

  const details = getWebexCallingDeviceDetailsForAgent(agentId, participants);

  return details?.deviceType === 'wxApp';
}

export function decodedLineOwnerId(lineOwnerId?: string): string | undefined {
  if (!lineOwnerId) {
    return undefined;
  }

  try {
    const decoded = atob(lineOwnerId);

    return decoded.split('/').pop();
  } catch {
    return undefined;
  }
}
