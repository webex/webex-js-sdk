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
  getIsConsultInProgressForConferenceControls,
  getIsConsultedAgentForControls,
  getServerHoldStateForControls,
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
  const isOutdial = interaction?.outboundType === 'OUTDIAL';
  const serverHold = getServerHoldStateForControls(context, mainCallId, fallbackTaskData);

  // Backend-derived checks
  const customerInCall =
    interaction && mainCallId ? getIsCustomerInCall(interaction, mainCallId) : false;
  // EP-DN/secondary legs can have incomplete media participant lists; fall back to participants map.
  const customerPresent =
    customerInCall ||
    Boolean(
      interaction &&
        interaction.participants &&
        Object.values(interaction.participants).some(
          (p: any) => p?.pType === 'Customer' && !p?.hasLeft
        )
    );
  const participantCount =
    interaction && mainCallId ? getConferenceParticipantsCount(interaction, mainCallId) : 0;
  const maxParticipants = participantCount >= MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE;
  const selfAgentId = config.agentId ?? taskData?.agentId;
  const consultInProgress = getIsConsultInProgressForConferenceControls(
    interaction,
    mainCallId,
    selfAgentId
  );
  const conferenceFromBackend = taskData ? getIsConferenceInProgress(taskData) : false;
  // Note: ownership is used by some controls; keep computations local to those controls

  // Context flags (set by state machine actions)
  const {consultInitiator, consultDestinationAgentJoined, consultCallHeld, consultFromConference} =
    context;
  const {recordingControlsAvailable, recordingInProgress} = context;

  const isHeld = serverHold ?? state === TaskState.HELD;
  const isConnected = serverHold !== undefined ? !serverHold : state === TaskState.CONNECTED;

  // State categories for cleaner logic
  const isConsulting =
    state === TaskState.CONSULTING ||
    state === TaskState.CONSULT_INITIATING ||
    state === TaskState.CONF_INITIATING;
  const isConferencing = state === TaskState.CONFERENCING;
  const isWrappingUp = state === TaskState.WRAPPING_UP;
  const selfInMainCall =
    Boolean(selfAgentId) &&
    Boolean(mainCallId) &&
    Boolean(interaction?.media?.[mainCallId]?.participants?.includes(selfAgentId as string));
  const conferenceActive = isConferencing || conferenceFromBackend || consultFromConference;
  // Treat consult initiator as "in conference" even if mainCall participant list lags while consulting.
  const inConference = conferenceActive && (isConferencing || selfInMainCall || consultInitiator);

  // Check if this is a consulted agent (must be after isConsulting is computed).
  const isSoleAgentOnCall = participantCount <= 1 && !isConsulting && !inConference;
  const isConsulted =
    inConference || isSoleAgentOnCall
      ? false
      : getIsConsultedAgentForControls(taskData, context, isConsulting);

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
    // Accept/Decline: Voice tasks in offered state
    // For outdial, accept is disabled (auto-answer handles it), decline remains enabled
    // For Extension mode (non-WebRTC), accept shows as disabled "Ringing" button
    accept:
      state === TaskState.OFFERED && !interaction?.isTerminated
        ? {isVisible: true, isEnabled: isWebrtc && !isOutdial}
        : DISABLED,
    decline:
      isWebrtc && state === TaskState.OFFERED && !interaction?.isTerminated
        ? VISIBLE_ENABLED
        : DISABLED,

    // Hold: visible in connected/held/conference, disabled in conference/consulting
    hold: (() => {
      if (!hasFullControls) return DISABLED;
      if (state === TaskState.OFFERED) return DISABLED;
      if (isWrappingUp) return DISABLED;
      // Visibility: connected || held || inConference
      if (!(isConnected || isHeld || inConference)) return DISABLED;
      // Enabled: (connected || held) && !inConference && !isConsulting
      const canHold = (isConnected || isHeld) && !inConference && !isConsulting;

      return canHold ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),

    // Mute: WebRTC only, active calls; hidden entirely during wrapup
    mute: (() => {
      if (!isWebrtc) return DISABLED;
      if (isWrappingUp) return DISABLED;
      if (isConsulting) return VISIBLE_ENABLED;

      if (state === TaskState.CONNECTED || isConferencing) {
        if (inConference) return VISIBLE_ENABLED;

        return isHeld ? VISIBLE_DISABLED : VISIBLE_ENABLED;
      }

      return DISABLED;
    })(),

    // End: varies by state; during consulting only on main leg (consult held)
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
        !maxParticipants && customerPresent && !consultInProgress && !isConsulted;
      const canFromConference =
        !maxParticipants && customerPresent && !consultInProgress && !isConsulting;

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

    // Conference: during consulting, enabled on both legs when agent joined
    // Label changes based on leg: "Conference" on main leg, "Merge" on consult leg
    conference: (() => {
      if (!hasFullControls || !isConsulting) return DISABLED;
      if (!consultInitiator) return DISABLED;

      return consultDestinationAgentJoined && !maxParticipants ? VISIBLE_ENABLED : VISIBLE_DISABLED;
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

    // MergeToConference: mirrors conference control, enabled on both legs
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

  const isConnected = state === TaskState.CONNECTED;
  const isWrappingUp = state === TaskState.WRAPPING_UP;

  return {
    accept: state === TaskState.OFFERED ? VISIBLE_ENABLED : DISABLED,
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
