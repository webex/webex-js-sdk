/* eslint-disable import/prefer-default-export */
import {Interaction, ITask, TaskData, MEDIA_CHANNEL} from './types';
import {LoginOption} from '../../types';
import {PARTICIPANT_TYPE, MEDIA_TYPE_MAIN_CALL} from './state-machine/constants';
import {TaskContext} from './state-machine/types';
import {CC_EVENTS} from '../config/types';
import {OUTBOUND_TYPE, OUTDIAL_DIRECTION, OUTDIAL_MEDIA_TYPE} from '../../constants';

const CAMPAIGN_PREVIEW_OUTBOUND_TYPES = ['STANDARD_PREVIEW_CAMPAIGN', 'DIRECT_PREVIEW_CAMPAIGN'];
const CAMPAIGN_PREVIEW_CAMPAIGN_TYPES = ['preview_standard', 'preview_direct'];

/**
 * Checks if the customer is still in the call (not left)
 *
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID
 * @returns true if customer is in the call
 */
export const getIsCustomerInCall = (interaction: Interaction, interactionId: string): boolean => {
  const mainCallMedia = interaction.media?.[interactionId];
  const participants = interaction.participants;
  if (!mainCallMedia?.participants || !participants) {
    return false;
  }

  return mainCallMedia.participants.some((participantId: string) => {
    const participant = participants[participantId];

    return participant?.pType === PARTICIPANT_TYPE.CUSTOMER && !participant.hasLeft;
  });
};

/**
 * Gets the count of active agent participants in the conference
 * Excludes Customer, Supervisor, and VVA participant types
 *
 * @param interaction - The interaction object
 * @param interactionId - The main interaction ID
 * @returns Number of active agent participants
 */
export const getConferenceParticipantsCount = (
  interaction: Interaction,
  interactionId: string
): number => {
  const mainCallMedia = interaction.media?.[interactionId];
  const participants = interaction.participants;
  if (!mainCallMedia?.participants || !participants) {
    return 0;
  }

  let count = 0;
  for (const participantId of mainCallMedia.participants) {
    const participant = participants[participantId];
    if (
      participant &&
      participant.pType !== PARTICIPANT_TYPE.CUSTOMER &&
      participant.pType !== PARTICIPANT_TYPE.SUPERVISOR &&
      participant.pType !== PARTICIPANT_TYPE.VVA &&
      !participant.hasLeft
    ) {
      count += 1;
    }
  }

  return count;
};

/**
 * Determines if a consult is actively in-progress for conference control gating.
 * This is used to disable conference controls (End/Consult) only when a consult leg
 * still exists outside the main call participants.
 */
export const getIsConsultInProgressForConferenceControls = (
  interaction: Interaction | undefined,
  mainCallId: string | undefined,
  selfAgentId: string | undefined
): boolean => {
  if (!interaction || !mainCallId) return false;

  const mainParticipants = interaction.media?.[mainCallId]?.participants;
  if (!Array.isArray(mainParticipants) || mainParticipants.length === 0) return false;

  const mainSet = new Set(mainParticipants);
  const media = interaction.media;
  if (!media) return false;

  return Object.values(media).some((m: any) => {
    if (!m || m.mType !== 'consult') return false;
    if (!Array.isArray(m.participants) || m.participants.length === 0) return false;

    return m.participants.some((participantId: string) => {
      const p: any = interaction.participants?.[participantId];
      if (!p || p.hasLeft) return false;
      if (selfAgentId && participantId === selfAgentId) return false;

      const consultState = p.consultState as string | undefined;
      const isRonaPendingConsultee = consultState === 'consultReserved' && p.hasJoined === false;
      const consultLegActive =
        consultState === 'consulting' ||
        p.currentState === 'consulting' ||
        (p.isConsulted === true && consultState !== 'consultCompleted' && !isRonaPendingConsultee);

      return consultLegActive && !mainSet.has(participantId);
    });
  });
};

export const getIsConsultedAgentForControls = (
  taskData: TaskData | null,
  context: TaskContext,
  isConsultingState: boolean
): boolean => {
  return Boolean(taskData?.isConsulted) || (isConsultingState && !context.consultInitiator);
};

export const getServerHoldStateForControls = (
  context: TaskContext,
  mainCallId?: string,
  fallbackTaskData?: TaskData | null
): boolean | undefined => {
  const media = context.taskData?.interaction?.media ?? fallbackTaskData?.interaction?.media;
  if (!media) return undefined;

  if (mainCallId && media[mainCallId]) {
    return media[mainCallId].isHold ?? false;
  }

  const mediaId = context.taskData?.mediaResourceId ?? fallbackTaskData?.mediaResourceId;
  if (!mediaId) return undefined;

  return media[mediaId]?.isHold;
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
 * @param data - The task data to check for conference status
 * @returns true if there are 2 or more active agent participants in the main call, false otherwise
 *
 * For Agent B (consulted agent), their task's interactionId may be different from the main call.
 * We use mainInteractionId from the interaction if available, otherwise fallback to interactionId.
 */
export const getIsConferenceInProgress = (data: TaskData): boolean => {
  if (!data.interaction) return false;

  const mainCallId = data.interaction.mainInteractionId || data.interactionId;
  const mediaMainCall = data.interaction.media?.[mainCallId];
  const participantsInMainCall = new Set(mediaMainCall?.participants);
  const {participants} = data.interaction;

  const agentParticipants = new Set();
  participantsInMainCall.forEach((participantId: string) => {
    const participant = participants[participantId];
    if (
      participant &&
      participant.pType !== PARTICIPANT_TYPE.CUSTOMER &&
      participant.pType !== PARTICIPANT_TYPE.SUPERVISOR &&
      participant.pType !== PARTICIPANT_TYPE.VVA &&
      !participant.hasLeft
    ) {
      agentParticipants.add(participantId);
    }
  });

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
 * @param interaction - The interaction object
 * @returns true if this is a secondary EP-DN agent in telephony consultation, false otherwise
 */
export const isSecondaryEpDnAgent = (interaction: Interaction): boolean => {
  return interaction.mediaType === 'telephony' && isSecondaryAgent(interaction);
};

/**
 * Checks if the task belongs to a campaign preview interaction.
 * Campaign preview ContactEnded events are terminal cleanup events and should not trigger wrapup.
 */
export const isCampaignPreviewTask = (taskData?: TaskData | null): boolean => {
  const outboundType = taskData?.interaction?.outboundType ?? '';
  const cpd = taskData?.interaction?.callProcessingDetails as unknown as
    | Record<string, string | undefined>
    | undefined;
  const campaignType = cpd?.campaignType ?? '';

  return (
    CAMPAIGN_PREVIEW_OUTBOUND_TYPES.includes(outboundType) ||
    CAMPAIGN_PREVIEW_CAMPAIGN_TYPES.includes(campaignType)
  );
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

/**
 * Gets the consult media resource ID for switch-call operations.
 * Searches for the consult media leg in the interaction.
 *
 * @param interaction - The interaction object
 * @param consultMediaResourceId - The consult media resource ID from task data
 * @param agentId - Current agent ID
 * @returns The consult media resource ID or undefined
 */
export const getConsultMediaResourceId = (
  interaction: Interaction | undefined,
  consultMediaResourceId: string | undefined,
  agentId: string | undefined
): string | undefined => {
  // First priority: use consultMediaResourceId from task data if available
  if (consultMediaResourceId) {
    return consultMediaResourceId;
  }

  // Second priority: search for consult media leg in interaction.media
  if (!interaction?.media || !agentId) {
    return undefined;
  }

  // Find the consult media leg where this agent is a participant
  for (const [mediaId, media] of Object.entries(interaction.media)) {
    if (media.mType === 'consult' && media.participants?.includes(agentId)) {
      return mediaId;
    }
  }

  return undefined;
};

/**
 * Checks if a task is a campaign preview reservation that has not yet been accepted.
 * Campaign preview tasks should not trigger incoming call handling until the agent
 * explicitly accepts the preview contact.
 * @param task - The task to check
 * @returns true if the task is a pending campaign preview reservation, false otherwise
 */
export const isCampaignPreviewReservation = (task: ITask): boolean => {
  return task?.data?.type === CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION;
};
