import {TaskData} from './types';

type BooleanKey =
  | 'recordingStarted'
  | 'recordInProgress'
  | 'isPaused'
  | 'pauseResumeEnabled'
  | 'ctqInProgress'
  | 'outdialTransferToQueueEnabled'
  | 'taskToBeSelfServiced'
  | 'CONTINUE_RECORDING_ON_TRANSFER'
  | 'isParked'
  | 'participantInviteTimeout'
  | 'checkAgentAvailability';

const booleanKeys: BooleanKey[] = [
  'recordingStarted',
  'recordInProgress',
  'isPaused',
  'pauseResumeEnabled',
  'ctqInProgress',
  'outdialTransferToQueueEnabled',
  'taskToBeSelfServiced',
  'CONTINUE_RECORDING_ON_TRANSFER',
  'isParked',
  'participantInviteTimeout',
  'checkAgentAvailability',
];

const interactionBooleanKeys: Array<keyof TaskData['interaction']> = [
  'isFcManaged',
  'isMediaForked',
  'isTerminated',
];

const participantBooleanKeys = [
  'autoAnswerEnabled',
  'hasJoined',
  'hasLeft',
  'isConsulted',
  'isInPredial',
  'isOffered',
  'isWrapUp',
  'isWrappedUp',
];

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return undefined;
};

const normalizeFields = <T extends Record<string, any>>(obj: T, keys: string[]): T | undefined => {
  let updated: T | undefined;

  keys.forEach((key) => {
    const normalized = toBoolean(obj[key]);

    if (typeof normalized !== 'undefined') {
      if (!updated) {
        updated = {...obj};
      }
      (updated as any)[key] = normalized;
    }
  });

  return updated;
};

/**
 * Normalize backend task payload quirks so downstream code can rely on actual booleans.
 *
 * Applies to every Agent Contact websocket event before it reaches the state machine:
 * - Converts string booleans in callProcessingDetails to actual booleans.
 * - Also normalizes known boolean fields on interaction and participants.
 * - Keeps payload shape intact; only coerces known boolean fields.
 */
export function normalizeTaskData(data: TaskData): TaskData {
  const interaction = data?.interaction;

  if (!interaction) {
    return data;
  }

  const details = interaction.callProcessingDetails;
  const updatedDetails = details ? normalizeFields(details, booleanKeys) : undefined;
  const updatedInteractionBooleans = normalizeFields(
    interaction,
    interactionBooleanKeys as string[]
  );

  let updatedParticipants: typeof interaction.participants | undefined;
  Object.entries(interaction.participants || {}).forEach(([id, participant]) => {
    const normalized = normalizeFields(participant, participantBooleanKeys);
    if (normalized) {
      if (!updatedParticipants) {
        updatedParticipants = {...interaction.participants};
      }
      updatedParticipants[id] = normalized;
    }
  });

  let updatedMedia: typeof interaction.media | undefined;
  Object.entries(interaction.media || {}).forEach(([id, media]) => {
    const normalized = normalizeFields(media, ['isHold']);
    if (normalized) {
      if (!updatedMedia) {
        updatedMedia = {...interaction.media};
      }
      updatedMedia[id] = normalized;
    }
  });

  if (!updatedDetails && !updatedInteractionBooleans && !updatedParticipants && !updatedMedia) {
    return data;
  }

  return {
    ...data,
    interaction: {
      ...interaction,
      ...(updatedInteractionBooleans || {}),
      callProcessingDetails: updatedDetails || details,
      participants: updatedParticipants || interaction.participants,
      media: updatedMedia || interaction.media,
    },
  };
}
