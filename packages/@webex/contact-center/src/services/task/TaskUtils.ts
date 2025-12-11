/* eslint-disable import/prefer-default-export */
import {Interaction, ITask, TaskData, MEDIA_CHANNEL} from './types';
import {OUTDIAL_DIRECTION, OUTDIAL_MEDIA_TYPE, OUTBOUND_TYPE} from '../../constants';
import {LoginOption} from '../../types';

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
  const mediaMainCall = data.interaction.media?.[data?.interactionId];
  const participantsInMainCall = new Set(mediaMainCall?.participants);
  const participants = data.interaction.participants;

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
  if (!interaction.callProcessingDetails) {
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
 * Checks if auto-answer is enabled for the agent participant
 * @param interaction - The interaction object
 * @param agentId - Current agent ID
 * @returns true if auto-answer is enabled, false otherwise
 */
export const isAutoAnswerEnabled = (interaction: Interaction, agentId: string): boolean => {
  return interaction.participants?.[agentId]?.autoAnswerEnabled === true;
};

/**
 * Checks if the interaction is a WebRTC call eligible for auto-answer
 * @param interaction - The interaction object
 * @param loginOption - The agent's login option (BROWSER, AGENT_DN, etc.)
 * @param webRtcEnabled - Whether WebRTC is enabled for the agent
 * @returns true if this is a WebRTC call, false otherwise
 */
export const isWebRTCCall = (
  interaction: Interaction,
  loginOption: string,
  webRtcEnabled: boolean
): boolean => {
  return (
    webRtcEnabled &&
    loginOption === LoginOption.BROWSER &&
    interaction.mediaType === OUTDIAL_MEDIA_TYPE
  );
};

/**
 * Checks if the interaction is a digital outbound (Email/SMS)
 * @param interaction - The interaction object
 * @returns true if this is a digital outbound, false otherwise
 */
export const isDigitalOutbound = (interaction: Interaction): boolean => {
  return (
    interaction.contactDirection?.type === OUTDIAL_DIRECTION &&
    interaction.outboundType === OUTBOUND_TYPE &&
    (interaction.mediaChannel === MEDIA_CHANNEL.EMAIL ||
      interaction.mediaChannel === MEDIA_CHANNEL.SMS)
  );
};

/**
 * Checks if the outdial was initiated by the current agent
 * @param interaction - The interaction object
 * @param agentId - Current agent ID
 * @returns true if agent initiated the outdial, false otherwise
 */
export const hasAgentInitiatedOutdial = (interaction: Interaction, agentId: string): boolean => {
  return (
    interaction.contactDirection?.type === OUTDIAL_DIRECTION &&
    interaction.outboundType === OUTBOUND_TYPE &&
    interaction.callProcessingDetails?.outdialAgentId === agentId &&
    interaction.owner === agentId &&
    !interaction.callProcessingDetails?.BLIND_TRANSFER_IN_PROGRESS
  );
};

/**
 * Determines if a task should be auto-answered based on interaction data
 * Auto-answer logic handles:
 * 1. WebRTC calls with auto-answer enabled in agent profile
 * 2. Agent-initiated WebRTC outdial calls
 * 3. Agent-initiated digital outbound (Email/SMS) without previous transfers
 *
 * @param taskData - The task data
 * @param agentId - Current agent ID
 * @param loginOption - Agent's login option
 * @param webRtcEnabled - Whether WebRTC is enabled for the agent
 * @returns true if task should be auto-answered, false otherwise
 */
export const shouldAutoAnswerTask = (
  taskData: TaskData,
  agentId: string,
  loginOption: string,
  webRtcEnabled: boolean
): boolean => {
  const {interaction} = taskData;

  if (!interaction || !agentId) {
    return false;
  }

  // Check if auto-answer is enabled for this agent
  const autoAnswerEnabled = isAutoAnswerEnabled(interaction, agentId);

  // Check if this is an agent-initiated outdial
  const agentInitiatedOutdial = hasAgentInitiatedOutdial(interaction, agentId);

  // WebRTC telephony calls
  if (isWebRTCCall(interaction, loginOption, webRtcEnabled)) {
    return autoAnswerEnabled || agentInitiatedOutdial;
  }

  // Digital outbound (Email/SMS)
  if (isDigitalOutbound(interaction) && agentInitiatedOutdial) {
    // Don't auto-answer if task has been transferred (has previous vteams)
    const hasPreviousVteams = interaction.previousVTeams && interaction.previousVTeams.length > 0;

    return !hasPreviousVteams;
  }

  return false;
};
