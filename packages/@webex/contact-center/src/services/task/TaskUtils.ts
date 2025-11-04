/* eslint-disable import/prefer-default-export */
import {Interaction, ITask, TaskData} from './types';

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
 * @param TaskData - The payLoad data to check for conference status
 * @returns true if there are 2 or more active agent participants in the main call, false otherwise
 */
export const getIsConferenceInProgress = (data: TaskData): boolean => {
  const mediaMainCall = data?.interaction?.media?.[data?.interactionId];
  const participantsInMainCall = new Set(mediaMainCall?.participants);
  const participants = data?.interaction?.participants;

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

/**
 * Checks if the current agent is a secondary agent in a consultation scenario.
 * Secondary agents are those who were consulted (not the original call owner).
 * @param task - The task object containing interaction details
 * @returns true if this is a secondary agent (consulted party), false otherwise
 */
export const isSecondaryAgent = (interaction: Interaction): boolean => {
  if (!interaction?.callProcessingDetails) {
    return false;
  }

  return (
    interaction.callProcessingDetails.relationshipType === 'consult' &&
    !!interaction.callProcessingDetails.parentInteractionId &&
    interaction.callProcessingDetails.parentInteractionId !== interaction.interactionId
  );
};

/**
 * Checks if the current agent is a secondary EP-DN (Entry Point Dial Number) agent.
 * This is specifically for telephony consultations to external numbers/entry points.
 * Matches Agent Desktop's isSecondaryEpDnAgent logic.
 * @param task - The task object containing interaction details
 * @returns true if this is a secondary EP-DN agent in telephony consultation, false otherwise
 */
export const isSecondaryEpDnAgent = (interaction: Interaction): boolean => {
  if (!interaction) {
    return false;
  }

  return interaction.mediaType === 'telephony' && isSecondaryAgent(interaction);
};

/**
 * Checks if the agent was added to a campaign and is in ringing state
 * Matches Agent Desktop's isAgentAddedToCampaign logic
 * @param task - The task object
 * @param agentId - The agent ID to check
 * @returns true if agent was added to campaign, false otherwise
 */
const isAgentAddedToCampaign = (task: ITask, agentId: string): boolean => {
  const participant = task.data.interaction?.participants?.[agentId];
  if (!participant) {
    return false;
  }

  return (
    (task.data.type === 'AgentAddCampaignReservation' || !!task.data.reservedAgentChannelId) &&
    !participant.isWrapUp &&
    participant.hasJoined === true
  );
};

/**
 * Checks if the task type is CampaignContactUpdated
 * Matches Agent Desktop's isAgentAddedToCampaignNew logic
 * Campaign tasks should not be in ringing state if agent is in wrapUp
 * @param task - The task object
 * @param agentId - The agent ID to check
 * @returns true if task is CampaignContactUpdated and agent not in wrapUp, false otherwise
 */
const isAgentAddedToCampaignNew = (task: ITask, agentId: string): boolean => {
  if (task.data.type !== 'CampaignContactUpdated') {
    return false;
  }
  const participant = task.data.interaction?.participants?.[agentId];
  // Campaign is ringing only if agent is not in wrapUp

  return !participant?.isWrapUp;
};

/**
 * Checks if the task is in a ringing state for the agent
 * This matches Agent Desktop's isTaskRinging logic which checks both
 * isAgentContactInRingingState and isAgentContactInOfferConsultState
 * @param task - The task object containing interaction details
 * @param agentId - The agent ID to check
 * @returns true if the task is in ringing state, false otherwise
 */
export const isTaskRinging = (task: ITask, agentId: string): boolean => {
  const {interaction} = task.data;
  const participant = interaction?.participants?.[agentId];

  // If participant doesn't exist, cannot be in ringing state
  if (!participant) {
    return false;
  }

  // Check if agent is in ringing state for normal interactions
  // This matches Agent Desktop's isAgentContactInRingingState
  if (
    interaction.state === 'new' ||
    interaction.state === 'connected' ||
    interaction.state === 'parked'
  ) {
    // Agent is ringing if:
    // 1. Added to campaign (hasJoined=true but in ringing state for campaigns)
    // 2. OR campaign contact updated
    // 3. OR regular ringing state (hasn't joined and not in wrap-up)
    return (
      isAgentAddedToCampaign(task, agentId) ||
      isAgentAddedToCampaignNew(task, agentId) ||
      (!participant.isWrapUp && !participant.hasJoined)
    );
  }

  // Check if agent is in offer consult state
  // This matches Agent Desktop's isAgentContactInOfferConsultState
  if (interaction.state === 'consult') {
    return !participant.isWrapUp && !participant.hasJoined && participant.isConsulted === true;
  }

  return false;
};
