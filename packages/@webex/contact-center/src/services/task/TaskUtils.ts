/* eslint-disable import/prefer-default-export */
import {ITask} from './types';

/**
 * Determines if the given agent is the primary agent (owner) of the task
 * @param task - The task to check
 * @param agentId - The agent ID to check for primary status
 * @returns true if the agent is the primary agent, false otherwise
 */
export const isPrimary = (task: ITask, agentId: string): boolean => {
  if (!task.data?.interaction?.owner) {
    // Fall back to checking data.agentId when owner is not set
    return task.data.agentId === agentId;
  }

  return task.data.interaction.owner === agentId;
};

/**
 * Checks if the given agent is a participant in the main interaction (mainCall)
 * @param task - The task to check
 * @param agentId - The agent ID to check for participation
 * @returns true if the agent is a participant in the main interaction, false otherwise
 */
export const isParticipantInMainInteraction = (task: ITask, agentId: string): boolean => {
  if (!task?.data?.interaction?.media) {
    return false;
  }

  return Object.values(task.data.interaction.media).some(
    (mediaObj) =>
      mediaObj && mediaObj.mType === 'mainCall' && mediaObj.participants?.includes(agentId)
  );
};

/**
 * Checks if the given agent is not in the interaction or has left the interaction
 * @param task - The task to check
 * @param agentId - The agent ID to check
 * @returns true if the agent is not in the interaction or has left, false otherwise
 */
export const checkParticipantNotInInteraction = (task: ITask, agentId: string): boolean => {
  if (!task?.data?.interaction?.participants) {
    return true;
  }
  const {data} = task;

  return (
    !(agentId in data.interaction.participants) ||
    (agentId in data.interaction.participants && data.interaction.participants[agentId].hasLeft)
  );
};

/**
 * Determines if a conference is currently in progress based on the number of active agent participants
 * @param task - The task to check for conference status
 * @returns true if there are 2 or more active agent participants in the main call, false otherwise
 */
export const getIsConferenceInProgress = (task: ITask): boolean => {
  const mediaMainCall = task?.data?.interaction?.media?.[task?.data?.interactionId];
  const participantsInMainCall = new Set(mediaMainCall?.participants);
  const participants = task?.data?.interaction?.participants;

  const agentParticipants = new Set();
  if (participantsInMainCall.size > 0) {
    participantsInMainCall.forEach((participantId: string) => {
      const participant = participants?.[participantId];
      if (
        participant &&
        participant.pType !== 'Customer' &&
        participant.pType !== 'Supervisor' &&
        !participant.hasLeft &&
        participant.pType !== 'VVA'
      ) {
        agentParticipants.add(participantId);
      }
    });
  }

  return agentParticipants.size >= 2;
};
