/* eslint-disable import/prefer-default-export */
import {Interaction, ITask, TaskData, MEDIA_CHANNEL} from './types';
import {OUTDIAL_DIRECTION, OUTDIAL_MEDIA_TYPE, OUTBOUND_TYPE} from '../../constants';
import {LoginOption} from '../../types';
import {
  MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE,
  PARTICIPANT_TYPE_CUSTOMER,
  PARTICIPANT_TYPE_SUPERVISOR,
  PARTICIPANT_TYPE_VVA,
  MEDIA_TYPE_CONSULT,
  MEDIA_TYPE_MAIN_CALL,
} from './state-machine/constants';

// Re-export for backward compatibility
export {MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE};

/**
 * Media entry type from interaction.media
 */
type MediaEntry = {
  mediaResourceId: string;
  mediaType: MEDIA_CHANNEL;
  mediaMgr: string;
  participants: string[];
  mType: string;
  isHold: boolean;
  holdTimestamp: number | null;
};

/**
 * Hold status result for main or consult call
 */
export interface HoldStatus {
  isHeld: boolean;
  mediaResourceId?: string;
}

/**
 * Checks if the agent is on the consult leg and the consult is NOT held
 * (meaning the main call is effectively held from the agent's perspective)
 * Per widgets-util-logic.md: isConsultOnHoldMPC implementation
 *
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID (kept for API compatibility)
 * @returns true if agent is on consult (and thus main call is held from their POV)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const isConsultOnHoldMPC = (interaction: Interaction, interactionId: string): boolean => {
  if (!interaction?.media || interaction.state !== 'consulting') {
    return false;
  }

  // Find the consult media entry
  const consultMedia = Object.values(interaction.media).find(
    (m: MediaEntry) => m && m.mType === MEDIA_TYPE_CONSULT
  );

  // If consult exists and is NOT held, the agent is talking on consult
  // which means main call is effectively held from their perspective
  return consultMedia !== undefined && consultMedia.isHold !== true;
};

/**
 * Finds the hold status for a specific media type (main call or consult)
 * Per widgets-util-logic.md: findHoldStatus implementation
 *
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID
 * @param mediaType - The media type to check ('mainCall' or 'consult')
 * @returns HoldStatus object with isHeld flag and mediaResourceId
 */
export const findHoldStatus = (
  interaction: Interaction,
  interactionId: string,
  mediaType: 'mainCall' | 'consult'
): HoldStatus => {
  if (!interaction?.media) {
    return {isHeld: false};
  }

  // Find the media entry for the specified type
  let mediaEntry: MediaEntry | undefined;
  let mediaResourceId: string | undefined;

  for (const [id, media] of Object.entries(interaction.media)) {
    if (media && media.mType === mediaType) {
      mediaEntry = media;
      mediaResourceId = id;
      break;
    }
  }

  if (!mediaEntry) {
    return {isHeld: false};
  }

  // Special handling for main call when agent is on consult
  if (mediaType === MEDIA_TYPE_MAIN_CALL && isConsultOnHoldMPC(interaction, interactionId)) {
    // When agent is on consult, main call is effectively held
    return {isHeld: true, mediaResourceId};
  }

  return {isHeld: mediaEntry.isHold === true, mediaResourceId};
};

/**
 * Gets the hold status of the consult call leg
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID
 * @returns true if consult call is held
 */
export const getConsultCallHeld = (interaction: Interaction, interactionId: string): boolean => {
  return findHoldStatus(interaction, interactionId, MEDIA_TYPE_CONSULT).isHeld;
};

/**
 * Gets the hold status of the main call leg
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID
 * @returns true if main call is held
 */
export const getMainCallHeld = (interaction: Interaction, interactionId: string): boolean => {
  return findHoldStatus(interaction, interactionId, MEDIA_TYPE_MAIN_CALL).isHeld;
};

/**
 * Checks if the customer is still in the call (not left)
 * Per widgets-util-logic.md: getIsCustomerInCall implementation
 *
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID
 * @returns true if customer is in the call
 */
export const getIsCustomerInCall = (interaction: Interaction, interactionId: string): boolean => {
  if (!interaction?.media || !interaction?.participants) {
    return false;
  }

  // Get the main call media
  const mainCallMedia = interaction.media[interactionId];
  if (!mainCallMedia?.participants) {
    return false;
  }

  // Check if any participant in main call is a Customer and has not left
  return mainCallMedia.participants.some((participantId: string) => {
    const participant = interaction.participants?.[participantId];

    return participant?.pType === PARTICIPANT_TYPE_CUSTOMER && !participant.hasLeft;
  });
};

/**
 * Checks if a consult is currently in progress
 * Per widgets-util-logic.md: getIsConsultInProgress implementation
 *
 * @param interaction - The interaction object
 * @returns true if consult is in progress
 */
export const getIsConsultInProgress = (interaction: Interaction): boolean => {
  if (!interaction?.media) {
    return false;
  }

  // Check if any media has mType === 'consult'
  return Object.values(interaction.media).some(
    (media: MediaEntry) => media && media.mType === MEDIA_TYPE_CONSULT
  );
};

/**
 * Gets the count of active agent participants in the conference
 * Per widgets-util-logic.md: getConferenceParticipantsCount implementation
 * This excludes Customer, Supervisor, and VVA participant types
 *
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID
 * @returns Number of active agent participants
 */
export const getConferenceParticipantsCount = (
  interaction: Interaction,
  interactionId: string
): number => {
  if (!interaction?.media || !interaction?.participants) {
    return 0;
  }

  // Get the main call media
  const mainCallMedia = interaction.media[interactionId];
  if (!mainCallMedia?.participants) {
    return 0;
  }

  // Count participants that are:
  // - In the main call
  // - Not Customer, Supervisor, or VVA
  // - Have not left
  let count = 0;
  for (const participantId of mainCallMedia.participants) {
    const participant = interaction.participants[participantId];
    if (
      participant &&
      participant.pType !== PARTICIPANT_TYPE_CUSTOMER &&
      participant.pType !== PARTICIPANT_TYPE_SUPERVISOR &&
      participant.pType !== PARTICIPANT_TYPE_VVA &&
      !participant.hasLeft
    ) {
      count += 1;
    }
  }

  return count;
};

/**
 * Checks if the maximum number of participants in a conference has been reached
 * Per conference-spec.md: Max 7 counted participants + 1 customer
 *
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID
 * @returns true if max participants reached
 */
export const hasReachedMaxParticipants = (
  interaction: Interaction,
  interactionId: string
): boolean => {
  return (
    getConferenceParticipantsCount(interaction, interactionId) >=
    MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE
  );
};

/**
 * Determines if consult button should be visible/enabled based on all conditions
 * Per widgets-util-logic.md: getConsultButtonVisibility implementation
 *
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID
 * @param isHeld - Whether the call is currently held
 * @param isConferenceInProgress - Whether conference is in progress
 * @param isConsultCompleted - Whether a previous consult was completed
 * @returns true if consult button should be enabled
 */
export const canInitiateConsult = (
  interaction: Interaction,
  interactionId: string,
  isHeld: boolean,
  isConferenceInProgress: boolean,
  isConsultCompleted: boolean
): boolean => {
  const conferenceParticipantsCount = getConferenceParticipantsCount(interaction, interactionId);
  const isConsultInProgress = getIsConsultInProgress(interaction);
  const isCustomerInCall = getIsCustomerInCall(interaction, interactionId);

  // Per widgets-util-logic.md gating logic:
  // 1. Must not be at max participants
  // 2. Must not have consult already in progress
  // 3. Customer must be in call
  // 4. Special case: if held AND conference in progress AND consult not completed, disable
  if (conferenceParticipantsCount >= MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE) {
    return false;
  }

  if (isConsultInProgress) {
    return false;
  }

  if (!isCustomerInCall) {
    return false;
  }

  // Special case per widgets-util-logic.md
  if (isHeld && isConferenceInProgress && !isConsultCompleted) {
    return false;
  }

  return true;
};

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
      mediaObj &&
      mediaObj.mType === MEDIA_TYPE_MAIN_CALL &&
      mediaObj.participants?.includes(agentId)
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
 *
 * IMPORTANT: For Agent B (consulted agent), their task's interactionId may be different from
 * the main call. We use mainInteractionId from the interaction if available, otherwise fallback
 * to interactionId. This ensures conference detection works for both Agent A and Agent B.
 */
export const getIsConferenceInProgress = (data: TaskData): boolean => {
  // Early return if no interaction data
  if (!data?.interaction) {
    return false;
  }

  // Use mainInteractionId if available (important for Agent B / consulted agents)
  // Fall back to interactionId for Agent A
  const mainCallId = data.interaction.mainInteractionId || data.interactionId;
  const mediaMainCall = data.interaction.media?.[mainCallId];
  const participantsInMainCall = new Set(mediaMainCall?.participants);
  const participants = data.interaction.participants;

  const agentParticipants = new Set();
  if (participantsInMainCall.size > 0) {
    participantsInMainCall.forEach((participantId: string) => {
      const participant = participants?.[participantId];
      if (
        participant &&
        participant.pType !== PARTICIPANT_TYPE_CUSTOMER &&
        participant.pType !== PARTICIPANT_TYPE_SUPERVISOR &&
        !participant.hasLeft &&
        participant.pType !== PARTICIPANT_TYPE_VVA
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
