/**
 * UI Controls Computer - Centralized logic for computing UI control states
 */

import {TASK_CHANNEL_TYPE, TaskData, TaskUIControls, VOICE_VARIANT} from '../types';
import {TaskContext, UIControlConfig} from './types';
import {TaskState, MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE} from './constants';
import {
  getIsCustomerInCall,
  getConferenceParticipantsCount,
  getIsConferenceInProgress,
} from '../TaskUtils';

const DISABLED = {isVisible: false, isEnabled: false} as const;
const VISIBLE_ENABLED = {isVisible: true, isEnabled: true} as const;
const VISIBLE_DISABLED = {isVisible: true, isEnabled: false} as const;

export function getDefaultUIControls(): TaskUIControls {
  return {
    accept: DISABLED,
    decline: DISABLED,
    hold: DISABLED,
    mute: DISABLED,
    end: DISABLED,
    transfer: DISABLED,
    consult: DISABLED,
    consultTransfer: DISABLED,
    endConsult: DISABLED,
    recording: DISABLED,
    conference: DISABLED,
    wrapup: DISABLED,
    exitConference: DISABLED,
    transferConference: DISABLED,
    mergeToConference: DISABLED,
    switchToMainCall: DISABLED,
    switchToConsult: DISABLED,
  };
}

/**
 * Check if agent is the consulted party (not the initiator)
 * Must pass isConsulting state since this is called before state categories are computed
 */
function checkIsConsultedAgent(
  taskData: TaskData | null,
  context: TaskContext,
  isConsultingState: boolean
): boolean {
  return Boolean(taskData?.isConsulted) || (isConsultingState && !context.consultInitiator);
}

/**
 * Get hold state from server media entry (more accurate than state machine during transitions)
 */
function getServerHoldState(
  context: TaskContext,
  mainCallId?: string,
  fallbackTaskData?: TaskData | null
): boolean | undefined {
  const media = context.taskData?.interaction?.media ?? fallbackTaskData?.interaction?.media;
  if (!media) return undefined;

  if (mainCallId && media[mainCallId]) {
    return media[mainCallId].isHold ?? false;
  }

  const mediaId = context.taskData?.mediaResourceId ?? fallbackTaskData?.mediaResourceId;
  if (!mediaId) return undefined;

  return media[mediaId]?.isHold;
}

function isOtherAgentConsultingInMainCall(
  interaction: TaskData['interaction'] | undefined,
  mainCallId: string | undefined,
  selfAgentId: string | undefined
): boolean {
  if (!interaction || !mainCallId) return false;

  const mainParticipants = interaction.media?.[mainCallId]?.participants;
  if (!Array.isArray(mainParticipants) || mainParticipants.length === 0) return false;

  for (const participantId of mainParticipants) {
    const p: any = interaction.participants?.[participantId];
    const isActiveNonSelfAgent =
      Boolean(p) &&
      !p.hasLeft &&
      p.pType !== 'Customer' &&
      p.pType !== 'Supervisor' &&
      p.pType !== 'VVA' &&
      (!selfAgentId || participantId !== selfAgentId);

    if (isActiveNonSelfAgent && p.consultState === 'consulting') {
      return true;
    }
  }

  return false;
}

function computeVoiceUIControls(
  state: TaskState,
  context: TaskContext,
  config: UIControlConfig,
  fallbackTaskData?: TaskData
): TaskUIControls {
  // Early exit for idle
  if (state === TaskState.IDLE) {
    return getDefaultUIControls();
  }

  // Essential data
  const taskData = context.taskData ?? fallbackTaskData ?? null;
  const interaction = taskData?.interaction;
  const mainCallId = interaction?.mainInteractionId || taskData?.interactionId;
  const isWebrtc = config.voiceVariant === VOICE_VARIANT.WEBRTC;
  const serverHold = getServerHoldState(context, mainCallId, fallbackTaskData);

  // Backend-derived checks
  const customerInCall =
    interaction && mainCallId ? getIsCustomerInCall(interaction, mainCallId) : false;
  const participantCount =
    interaction && mainCallId ? getConferenceParticipantsCount(interaction, mainCallId) : 0;
  const maxParticipants = participantCount >= MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE;
  const selfAgentId = config.agentId ?? taskData?.agentId;
  const consultInProgress = isOtherAgentConsultingInMainCall(interaction, mainCallId, selfAgentId);
  const conferenceFromBackend = taskData ? getIsConferenceInProgress(taskData) : false;
  // Note: ownership is used by some controls; keep computations local to those controls

  // Context flags (set by state machine actions)
  const {consultInitiator, consultDestinationAgentJoined, consultCallHeld, consultFromConference} =
    context;
  const {recordingControlsAvailable, recordingInProgress} = context;

  const isHeld = serverHold ?? state === TaskState.HELD;
  const isConnected = serverHold !== undefined ? !serverHold : state === TaskState.CONNECTED;

  // State categories for cleaner logic
  const isOffered = state === TaskState.OFFERED || state === TaskState.OFFERED_CONSULT;
  const isConsulting =
    state === TaskState.CONSULTING ||
    state === TaskState.CONSULT_INITIATING ||
    state === TaskState.CONF_INITIATING;
  const isConferencing = state === TaskState.CONFERENCING;
  const isWrappingUp = state === TaskState.WRAPPING_UP || state === TaskState.TRANSFER_INITIATING;
  const selfInMainCall =
    Boolean(selfAgentId) &&
    Boolean(mainCallId) &&
    Boolean(interaction?.media?.[mainCallId]?.participants?.includes(selfAgentId as string));
  const conferenceActive = isConferencing || conferenceFromBackend || consultFromConference;
  // Treat consult initiator as "in conference" even if mainCall participant list lags while consulting.
  const inConference = conferenceActive && (isConferencing || selfInMainCall || consultInitiator);

  // Check if this is a consulted agent (must be after isConsulting is computed).
  // IMPORTANT: once a conference is active, consulted-role restrictions should not apply.
  const isConsulted = inConference ? false : checkIsConsultedAgent(taskData, context, isConsulting);

  // Active call = can perform call operations
  const isActive =
    state === TaskState.CONNECTED ||
    state === TaskState.HELD ||
    state === TaskState.HOLD_INITIATING ||
    state === TaskState.RESUME_INITIATING ||
    isConsulting ||
    isConferencing;

  // Consulted agents have limited controls until they're in conference or wrapup
  // Use inConference (not isConferencing) so controls remain enabled after state downgrade
  const hasFullControls = !isConsulted || consultInitiator || inConference || isWrappingUp;

  return {
    // Accept/Decline: WebRTC offered state only
    accept: isWebrtc && isOffered && !interaction?.isTerminated ? VISIBLE_ENABLED : DISABLED,
    decline: isWebrtc && isOffered && !interaction?.isTerminated ? VISIBLE_ENABLED : DISABLED,

    // Hold: visible in connected/held/conference, disabled in conference/consulting
    hold: (() => {
      if (!hasFullControls) return DISABLED;
      // Visibility: connected || held || inConference
      if (!(isConnected || isHeld || inConference)) return DISABLED;
      // Enabled: (connected || held) && !inConference && !isConsulting
      const canHold = (isConnected || isHeld) && !inConference && !isConsulting;

      return canHold ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),

    // Mute: WebRTC only, active calls (visible but disabled during wrapup)
    mute: (() => {
      if (!isWebrtc) return DISABLED;
      if (isConsulting) {
        return isWrappingUp ? VISIBLE_DISABLED : VISIBLE_ENABLED;
      }

      if (state === TaskState.CONNECTED || isConferencing || isWrappingUp) {
        if (inConference) {
          return isWrappingUp ? VISIBLE_DISABLED : VISIBLE_ENABLED;
        }

        return isHeld || isWrappingUp ? VISIBLE_DISABLED : VISIBLE_ENABLED;
      }

      return DISABLED;
    })(),

    // End: varies by state
    end: (() => {
      if (!config.isEndTaskEnabled) return DISABLED;

      if (isConsulting) {
        return consultInitiator && consultCallHeld ? VISIBLE_ENABLED : DISABLED;
      }

      if (inConference) {
        if (isConsulted) return DISABLED;

        if (consultInProgress) return VISIBLE_DISABLED;

        return isWrappingUp ? VISIBLE_DISABLED : VISIBLE_ENABLED;
      }
      if (!hasFullControls) return DISABLED;
      if (isActive) return isHeld || isWrappingUp ? VISIBLE_DISABLED : VISIBLE_ENABLED;

      return DISABLED;
    })(),

    // Transfer: connected/held, not in conference
    transfer: (() => {
      if (!hasFullControls || inConference) return DISABLED;
      if (state === TaskState.CONNECTED || state === TaskState.HELD) return VISIBLE_ENABLED;
      if (isConsulting && !conferenceFromBackend) {
        return consultDestinationAgentJoined ? VISIBLE_ENABLED : VISIBLE_DISABLED;
      }

      return DISABLED;
    })(),

    // Consult: connected/held/conference when conditions met
    consult: (() => {
      const isConnectedOrHeld = state === TaskState.CONNECTED || state === TaskState.HELD;

      if (!hasFullControls || !(isConnectedOrHeld || inConference)) {
        return DISABLED;
      }

      // Enabled conditions differ by state
      const canFromConnected =
        !maxParticipants && customerInCall && !consultInProgress && !isConsulted;
      const canFromConference =
        !maxParticipants && customerInCall && !consultInProgress && !isConsulting;

      const isEnabled = inConference ? canFromConference : canFromConnected;

      return {isVisible: true, isEnabled};
    })(),

    // ConsultTransfer: always hidden (use transfer button)
    consultTransfer: DISABLED,

    // EndConsult: during consulting
    endConsult: (() => {
      if (!isConsulting) return DISABLED;
      if (isConsulted && isConferencing) return DISABLED;
      if (!isConsulted && isConferencing && !(consultInitiator && conferenceFromBackend)) {
        return DISABLED;
      }

      return {isVisible: true, isEnabled: consultInitiator || config.isEndConsultEnabled};
    })(),

    // Recording: connected/held only, not in consult/conference
    recording: (() => {
      if (!recordingControlsAvailable || !config.isRecordingEnabled) return DISABLED;
      if (!hasFullControls || isConsulting || inConference) return DISABLED;
      if (state === TaskState.CONNECTED || state === TaskState.HELD) {
        return recordingInProgress ? VISIBLE_ENABLED : VISIBLE_DISABLED;
      }

      return DISABLED;
    })(),

    // Conference/Merge: during consulting when agent joined
    conference: (() => {
      if (!hasFullControls || !isConsulting) return DISABLED;

      return consultDestinationAgentJoined ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),

    // Wrapup: wrapping up state
    wrapup: isWrappingUp ? VISIBLE_ENABLED : DISABLED,

    // ExitConference: in conference, not consulting from conference
    exitConference: (() => {
      if (isConsulted && !isConferencing) return DISABLED;
      if (!inConference) return DISABLED;
      const consultingFromConference = consultInitiator && isConsulting && conferenceFromBackend;

      return consultingFromConference ? VISIBLE_DISABLED : VISIBLE_ENABLED;
    })(),

    // TransferConference: in conference with active consult, owner consulting from conference
    transferConference: (() => {
      if (!inConference || !isConsulting) return DISABLED;
      if (!consultInitiator || isConsulted) return DISABLED;

      return consultDestinationAgentJoined ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),

    // MergeToConference: during consulting when agent joined
    mergeToConference: (() => {
      if (!isConsulting || !consultInitiator) return DISABLED;

      return consultDestinationAgentJoined && !maxParticipants ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),

    // SwitchToMainCall: consulting, on consult leg
    switchToMainCall: (() => {
      if (!isConsulting || !consultInitiator || consultCallHeld) return DISABLED;

      return consultDestinationAgentJoined ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),

    // SwitchToConsult: consulting, on main call
    switchToConsult: (() => {
      if (!isConsulting || !consultInitiator || !consultCallHeld) return DISABLED;

      return consultDestinationAgentJoined ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),
  };
}

function computeDigitalUIControls(
  state: TaskState,
  context: TaskContext,
  fallbackTaskData?: TaskData
): TaskUIControls {
  const taskData = context.taskData ?? fallbackTaskData ?? null;
  const isTerminated = taskData?.interaction?.isTerminated ?? false;

  const isOffered = state === TaskState.OFFERED;
  const isConnected = state === TaskState.CONNECTED;
  const isWrappingUp = state === TaskState.WRAPPING_UP || state === TaskState.TRANSFER_INITIATING;

  return {
    accept: isOffered ? VISIBLE_ENABLED : DISABLED,
    decline: DISABLED,
    hold: DISABLED,
    mute: DISABLED,
    end: isConnected && !isWrappingUp ? VISIBLE_ENABLED : DISABLED,
    transfer: isConnected && !isWrappingUp ? VISIBLE_ENABLED : DISABLED,
    consult: DISABLED,
    consultTransfer: DISABLED,
    endConsult: DISABLED,
    recording: DISABLED,
    conference: DISABLED,
    wrapup: isTerminated || isWrappingUp ? VISIBLE_ENABLED : DISABLED,
    exitConference: DISABLED,
    transferConference: DISABLED,
    mergeToConference: DISABLED,
    switchToMainCall: DISABLED,
    switchToConsult: DISABLED,
  };
}

export function computeUIControls(
  currentState: TaskState,
  context: TaskContext,
  fallbackTaskData?: TaskData
): TaskUIControls {
  if (currentState === TaskState.TERMINATED || currentState === TaskState.COMPLETED) {
    return getDefaultUIControls();
  }

  switch (context.uiControlConfig.channelType) {
    case TASK_CHANNEL_TYPE.VOICE:
      return computeVoiceUIControls(
        currentState,
        context,
        context.uiControlConfig,
        fallbackTaskData
      );
    case TASK_CHANNEL_TYPE.DIGITAL:
      return computeDigitalUIControls(currentState, context, fallbackTaskData);
    default:
      return getDefaultUIControls();
  }
}

export function haveUIControlsChanged(
  previous: TaskUIControls | undefined,
  next: TaskUIControls
): boolean {
  if (!previous) return true;

  return (Object.keys(next) as (keyof TaskUIControls)[]).some((key) => {
    const prev = previous[key];
    const curr = next[key];

    return prev.isVisible !== curr.isVisible || prev.isEnabled !== curr.isEnabled;
  });
}
