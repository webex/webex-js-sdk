/**
 * UI Controls Computer
 *
 * Centralized logic for computing UI control states based on:
 * - State machine current state
 * - State machine context
 * - Configuration
 */

import {
  DESTINATION_TYPE,
  TASK_CHANNEL_TYPE,
  TaskData,
  TaskUIControls,
  VOICE_VARIANT,
} from '../types';
import {RecordingControlState, TaskContext, UIControlConfig} from './types';
import {TaskState} from './constants';

/**
 * Constant for a disabled/hidden control state
 */
const DISABLED_CONTROL = {isVisible: false, isEnabled: false} as const;

function getRecordingControlState(context: TaskContext): RecordingControlState {
  return {
    available: Boolean(context.recordingControlsAvailable),
    inProgress: Boolean(context.recordingInProgress),
  };
}

/**
 * Get default UI controls (all hidden/disabled)
 */
export function getDefaultUIControls(): TaskUIControls {
  return {
    accept: DISABLED_CONTROL,
    decline: DISABLED_CONTROL,
    hold: DISABLED_CONTROL,
    mute: DISABLED_CONTROL,
    end: DISABLED_CONTROL,
    transfer: DISABLED_CONTROL,
    consult: DISABLED_CONTROL,
    consultTransfer: DISABLED_CONTROL,
    endConsult: DISABLED_CONTROL,
    recording: DISABLED_CONTROL,
    conference: DISABLED_CONTROL,
    wrapup: DISABLED_CONTROL,
    exitConference: DISABLED_CONTROL,
    transferConference: DISABLED_CONTROL,
    mergeToConference: DISABLED_CONTROL,
  };
}

const getPrimaryMediaEntry = (context: TaskContext, fallbackTaskData?: TaskData | null) => {
  const primaryMediaId = context.taskData?.mediaResourceId ?? fallbackTaskData?.mediaResourceId;
  if (!primaryMediaId) {
    return undefined;
  }

  const interactionMedia =
    context.taskData?.interaction?.media ?? fallbackTaskData?.interaction?.media;

  return interactionMedia?.[primaryMediaId];
};

/**
 * Compute UI controls for voice channel
 */
function computeVoiceUIControls(
  currentState: TaskState,
  context: TaskContext,
  config: UIControlConfig,
  fallbackTaskData?: TaskData
): TaskUIControls {
  const isWebrtc = config.voiceVariant === VOICE_VARIANT.WEBRTC;
  const isOffered =
    currentState === TaskState.OFFERED || currentState === TaskState.OFFERED_CONSULT;
  const stateConnected = currentState === TaskState.CONNECTED;
  const stateHeld = currentState === TaskState.HELD;
  const isHoldInitiating = currentState === TaskState.HOLD_INITIATING;
  const isResumeInitiating = currentState === TaskState.RESUME_INITIATING;
  const isTransferInitiating = currentState === TaskState.TRANSFER_INITIATING;
  const isConfInitiating = currentState === TaskState.CONF_INITIATING;
  const isConsultInitiating = currentState === TaskState.CONSULT_INITIATING;
  const isConsulting =
    currentState === TaskState.CONSULTING || isConfInitiating || isConsultInitiating;
  const isConferencing = currentState === TaskState.CONFERENCING;
  const isWrappingUp = currentState === TaskState.WRAPPING_UP || isTransferInitiating;
  const isHoldTransition = isHoldInitiating || isResumeInitiating;
  const isInterimActive = isHoldTransition || isConsultInitiating;
  const callCapableState =
    stateConnected ||
    stateHeld ||
    isInterimActive ||
    isConsultInitiating ||
    isConsulting ||
    isConferencing ||
    isWrappingUp;

  const primaryMediaEntry = getPrimaryMediaEntry(context, fallbackTaskData);
  const serverHoldFlag = primaryMediaEntry?.isHold;

  let isHeld = serverHoldFlag ?? stateHeld;
  let isConnected = serverHoldFlag !== undefined ? !serverHoldFlag : stateConnected;

  if (!callCapableState) {
    isHeld = false;
    isConnected = false;
  }

  const isActiveCall =
    isConnected || isHeld || isConsulting || isConferencing || isWrappingUp || isInterimActive;
  const taskData = context.taskData ?? fallbackTaskData ?? null;
  const isConsultedAgent = Boolean(taskData?.isConsulted);
  const isTerminated = taskData?.interaction?.isTerminated ?? false;
  const {available: recordingAvailable, inProgress: recordingInProgress} =
    getRecordingControlState(context);
  const recordingFeatureEnabled =
    config.channelType === TASK_CHANNEL_TYPE.VOICE && config.isRecordingEnabled;
  const shouldShowAcceptDecline = isWebrtc
    ? isOffered && !isTerminated && (!isConsulting || !isConsultedAgent)
    : isOffered;

  const consultReceiverLimited =
    isConsultedAgent && !context.consultInitiator && !isWrappingUp && !isConferencing;
  const allowPrimaryControls = !consultReceiverLimited;
  const isConsultQueuePending =
    context.consultInitiator &&
    context.consultDestinationType === DESTINATION_TYPE.QUEUE &&
    !context.consultDestinationAgentJoined;

  // For WebRTC: mute is visible in connected state OR when consulting as the consulted agent
  // After transfer, consulted agent transitions to CONNECTED, so isConnected covers that case
  const muteVisible = isWebrtc
    ? isConnected ||
      (isConsulting && isConsultedAgent) ||
      isHoldInitiating ||
      isResumeInitiating ||
      isConsultInitiating
    : isConnected || isHeld || isHoldInitiating || isResumeInitiating;
  const muteEnabled = isWebrtc ? muteVisible && !isHeld && !isWrappingUp : !isWrappingUp;

  return {
    // Accept button: visible when offered, always enabled
    accept: {
      isVisible: shouldShowAcceptDecline,
      isEnabled: isWebrtc ? shouldShowAcceptDecline : true,
    },

    // Decline button: visible when offered, always enabled
    decline: {
      isVisible: shouldShowAcceptDecline,
      isEnabled: isWebrtc ? shouldShowAcceptDecline : true,
    },

    // Hold button: visible when connected or held
    // Enabled based on current state (hold when connected, resume when held)
    hold: {
      isVisible:
        allowPrimaryControls && (isConnected || isHeld || isHoldInitiating || isResumeInitiating),
      isEnabled: allowPrimaryControls && (isConnected || isHeld),
    },

    // Mute button: visible when active call, disabled during wrapup
    mute: {
      isVisible: muteVisible,
      isEnabled: muteEnabled,
    },

    // End button: conditional based on config, disabled when held or wrapping up
    end: {
      isVisible: allowPrimaryControls && config.isEndTaskEnabled && isActiveCall,
      isEnabled:
        allowPrimaryControls && isActiveCall && !isHeld && !isWrappingUp && !isConsultQueuePending,
    },

    // Transfer button: visible in connected/held/consulting states
    transfer: {
      isVisible:
        allowPrimaryControls && (isConnected || isHeld || isConsulting || isHoldTransition),
      isEnabled: allowPrimaryControls && !isConsultQueuePending,
    },

    // Consult button: visible when connected or held
    // Enabled when in connected or held states (not consulting/conferencing)
    consult: {
      isVisible:
        allowPrimaryControls && (isConnected || isHeld || isConsultInitiating || isHoldTransition),
      isEnabled: allowPrimaryControls && (isConnected || isHeld) && !isConsultQueuePending,
    },

    // Consult transfer: visible during consulting
    consultTransfer: {
      isVisible: allowPrimaryControls && isConsulting,
      isEnabled: allowPrimaryControls && !isConsultQueuePending,
    },

    // End consult button: visible during consulting state
    endConsult: {
      isVisible: isConsulting,
      isEnabled: config.isEndConsultEnabled,
    },

    // Recording controls: based on recording state
    recording: {
      isVisible:
        allowPrimaryControls &&
        recordingAvailable &&
        recordingFeatureEnabled &&
        (isConnected || isHeld),
      isEnabled:
        recordingAvailable &&
        recordingFeatureEnabled &&
        recordingInProgress &&
        allowPrimaryControls,
    },

    // Conference button: visible during consulting
    // Enabled only if consulted agent has joined
    conference: {
      isVisible: allowPrimaryControls && isConsulting,
      isEnabled:
        allowPrimaryControls && context.consultDestinationAgentJoined && !isConsultQueuePending,
    },

    // Wrapup button: visible during wrapup state
    wrapup: {
      isVisible: isWrappingUp,
      isEnabled: true,
    },

    // Exit conference button: visible during conference
    exitConference: {
      isVisible: isConferencing,
      isEnabled: true,
    },

    // Transfer conference: visible during conference
    transferConference: {
      isVisible: isConferencing,
      isEnabled: true,
    },

    // Merge to conference: visible during consulting (alias for conference)
    mergeToConference: {
      isVisible: isConsulting,
      isEnabled: context.consultDestinationAgentJoined && !isConsultQueuePending,
    },
  };
}

/**
 * Compute UI controls for digital channel
 */
function computeDigitalUIControls(
  currentState: TaskState,
  context: TaskContext,
  fallbackTaskData?: TaskData
): TaskUIControls {
  const isOffered = currentState === TaskState.OFFERED;
  const isConnected = currentState === TaskState.CONNECTED;
  const isWrappingUp =
    currentState === TaskState.WRAPPING_UP || currentState === TaskState.TRANSFER_INITIATING;
  const taskData = context.taskData ?? fallbackTaskData ?? null;
  const isTerminated = taskData?.interaction?.isTerminated ?? false;

  // For digital channels, determine if task needs wrapup
  const needsWrapup = isTerminated || isWrappingUp;

  return {
    // Accept button: visible when task is offered
    accept: {
      isVisible: isOffered,
      isEnabled: isOffered,
    },

    // Decline: not used in digital channels
    decline: {
      isVisible: false,
      isEnabled: false,
    },

    // Hold: not used in digital channels
    hold: {
      isVisible: false,
      isEnabled: false,
    },

    // Mute: not used in digital channels
    mute: {
      isVisible: false,
      isEnabled: false,
    },

    // End button: visible when connected, not when wrapping up
    end: {
      isVisible: isConnected && !isWrappingUp,
      isEnabled: isConnected && !isWrappingUp,
    },

    // Transfer button: visible when connected, not when wrapping up
    transfer: {
      isVisible: isConnected && !isWrappingUp,
      isEnabled: isConnected && !isWrappingUp,
    },

    // Consult: not used in digital channels
    consult: {
      isVisible: false,
      isEnabled: false,
    },

    // Consult transfer: not used in digital channels
    consultTransfer: {
      isVisible: false,
      isEnabled: false,
    },

    // End consult: not used in digital channels
    endConsult: {
      isVisible: false,
      isEnabled: false,
    },

    // Recording: not used in digital channels
    recording: {
      isVisible: false,
      isEnabled: false,
    },

    // Conference: not used in digital channels
    conference: {
      isVisible: false,
      isEnabled: false,
    },

    // Wrapup button: visible when task is terminated or in wrapup state
    wrapup: {
      isVisible: needsWrapup,
      isEnabled: needsWrapup,
    },

    // Exit conference: not used in digital channels
    exitConference: {
      isVisible: false,
      isEnabled: false,
    },

    // Transfer conference: not used in digital channels
    transferConference: {
      isVisible: false,
      isEnabled: false,
    },

    // Merge to conference: not used in digital channels
    mergeToConference: {
      isVisible: false,
      isEnabled: false,
    },
  };
}

/**
 * Main function to compute UI controls based on state, context, and config
 *
 * @param currentState - Current state machine state
 * @param context - State machine context
 * @returns Computed UI controls
 */
export function computeUIControls(
  currentState: TaskState,
  context: TaskContext,
  fallbackTaskData?: TaskData
): TaskUIControls {
  const {uiControlConfig} = context;

  switch (uiControlConfig.channelType) {
    case TASK_CHANNEL_TYPE.VOICE:
      return computeVoiceUIControls(currentState, context, uiControlConfig, fallbackTaskData);
    case TASK_CHANNEL_TYPE.DIGITAL:
      return computeDigitalUIControls(currentState, context, fallbackTaskData);
    default:
      return getDefaultUIControls();
  }
}

/**
 * Helper to check if UI controls have changed
 */
export function haveUIControlsChanged(
  previous: TaskUIControls | undefined,
  next: TaskUIControls
): boolean {
  if (!previous) {
    return true;
  }

  return (Object.keys(next) as (keyof TaskUIControls)[]).some((key) => {
    const prev = previous[key];
    const curr = next[key];

    return prev.isVisible !== curr.isVisible || prev.isEnabled !== curr.isEnabled;
  });
}
