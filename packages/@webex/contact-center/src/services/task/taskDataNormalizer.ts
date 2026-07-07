import {
  CallProcessingBooleanKey,
  InteractionBooleanKey,
  ParticipantBooleanKey,
  TaskData,
} from './types';

const booleanKeys: CallProcessingBooleanKey[] = [
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

const interactionBooleanKeys: InteractionBooleanKey[] = [
  'isFcManaged',
  'isMediaForked',
  'isTerminated',
];

const participantBooleanKeys: ParticipantBooleanKey[] = [
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
    const normalized = value.toLowerCase();

    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
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
  const participants = interaction.participants || {};
  Object.keys(participants).forEach((id) => {
    const participant = participants[id];
    const normalized = normalizeFields(participant, participantBooleanKeys);
    if (normalized) {
      if (!updatedParticipants) {
        updatedParticipants = {...participants};
      }
      updatedParticipants[id] = normalized;
    }
  });

  let updatedMedia: typeof interaction.media | undefined;
  const mediaEntries = interaction.media || {};
  Object.keys(mediaEntries).forEach((id) => {
    const media = mediaEntries[id];
    const normalized = normalizeFields(media, ['isHold']);
    if (normalized) {
      if (!updatedMedia) {
        updatedMedia = {...mediaEntries};
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
