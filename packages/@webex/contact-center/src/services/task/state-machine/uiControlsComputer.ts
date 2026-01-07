/**
 * UI Controls Computer
 *
 * Centralized logic for computing UI control states based on:
 * - State machine current state
 * - State machine context
 * - Configuration
 *
 */

import {
  DESTINATION_TYPE,
  TASK_CHANNEL_TYPE,
  TaskData,
  TaskUIControls,
  VOICE_VARIANT,
} from '../types';
import {RecordingControlState, TaskContext, UIControlConfig} from './types';
import {TaskState, MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE} from './constants';
import {
  getIsCustomerInCall,
  getIsConsultInProgress,
  getConferenceParticipantsCount,
  getIsConferenceInProgress,
} from '../TaskUtils';

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
    switchToMainCall: DISABLED_CONTROL,
    switchToConsult: DISABLED_CONTROL,
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
 *
 */
function computeVoiceUIControls(
  currentState: TaskState,
  context: TaskContext,
  config: UIControlConfig,
  fallbackTaskData?: TaskData
): TaskUIControls {
  if (currentState === TaskState.IDLE) {
    return getDefaultUIControls();
  }

  const isWebrtc = config.voiceVariant === VOICE_VARIANT.WEBRTC;
  const isOffered =
    currentState === TaskState.OFFERED || currentState === TaskState.OFFERED_CONSULT;

  // Base state machine states
  const stateConnected = currentState === TaskState.CONNECTED;
  const stateHeld = currentState === TaskState.HELD;
  const isConfInitiating = currentState === TaskState.CONF_INITIATING;
  const isConsultInitiating = currentState === TaskState.CONSULT_INITIATING;
  const isHoldInitiating = currentState === TaskState.HOLD_INITIATING;
  const isResumeInitiating = currentState === TaskState.RESUME_INITIATING;
  const isConsulting =
    currentState === TaskState.CONSULTING || isConfInitiating || isConsultInitiating;
  const isConferencing = currentState === TaskState.CONFERENCING;
  const isWrappingUp = currentState === TaskState.WRAPPING_UP;

  // Interim states for hold transitions
  const isHoldTransition = isHoldInitiating || isResumeInitiating;
  const isInterimActive = isHoldTransition || isConsultInitiating;
  const callCapableState =
    stateConnected ||
    stateHeld ||
    isInterimActive ||
    isConsulting ||
    isConferencing ||
    isWrappingUp;

  // Use server hold flag from media entry if available for more accurate hold state
  const primaryMediaEntry = getPrimaryMediaEntry(context, fallbackTaskData);
  const serverHoldFlag = primaryMediaEntry?.isHold;

  // Derive effective hold/connected state from server flag or state machine
  let isHeld = serverHoldFlag ?? stateHeld;
  let isConnected = serverHoldFlag !== undefined ? !serverHoldFlag : stateConnected;

  // Reset if not in a call-capable state
  if (!callCapableState) {
    isHeld = false;
    isConnected = false;
  }

  const isActiveCall =
    isConnected || isHeld || isConsulting || isConferencing || isWrappingUp || isInterimActive;
  const taskData = context.taskData ?? fallbackTaskData ?? null;
  const interaction = taskData?.interaction;
  const interactionId = taskData?.interactionId;
  // IMPORTANT: For Agent B (consulted agent), use mainInteractionId to find main call media
  // This is crucial for conference detection and participant counting to work for all agents
  const mainCallId = interaction?.mainInteractionId || interactionId;
  // isConsultedAgent: Detect if this agent is being consulted (not the consult initiator)
  // Two ways to detect:
  // 1. taskData.isConsulted is set by backend
  // 2. Agent is in CONSULTING state but NOT the consultInitiator (they received the consult)
  const isConsultedAgent =
    Boolean(taskData?.isConsulted) || (isConsulting && !context.consultInitiator);
  const isTerminated = interaction?.isTerminated ?? false;
  const {available: recordingAvailable, inProgress: recordingInProgress} =
    getRecordingControlState(context);
  const recordingFeatureEnabled =
    config.channelType === TASK_CHANNEL_TYPE.VOICE && config.isRecordingEnabled;
  // Accept/Decline only for WebRTC - desk phone agents answer on physical phone
  const shouldShowAcceptDecline =
    isWebrtc && isOffered && !isTerminated && (!isConsulting || !isConsultedAgent);

  // ============================================
  // Canonical Derived Flags per widgets-util-logic.md
  // ============================================

  // customerInCall: Is customer still on the call?
  // Use mainCallId to ensure this works for Agent B (consulted agent)
  const customerInCall =
    interaction && mainCallId ? getIsCustomerInCall(interaction, mainCallId) : false;

  // consultInProgress: Is there an active consult?
  const consultInProgress = interaction ? getIsConsultInProgress(interaction) : false;

  // conferenceParticipantsCount: Number of active agent participants
  // Use mainCallId to ensure this works for Agent B (consulted agent)
  const conferenceParticipantsCount =
    interaction && mainCallId ? getConferenceParticipantsCount(interaction, mainCallId) : 0;

  // maxParticipantsReached: At max capacity (7 agents)?
  const maxParticipantsReached =
    conferenceParticipantsCount >= MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE;

  // isConferenceInProgress: Is conference active (2+ agents)?
  const isConferenceInProgress = taskData ? getIsConferenceInProgress(taskData) : false;

  // Composite: Conference + Consulting (consult started from within conference)
  // Used for determining exit/transfer conference availability
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isConferenceAndConsulting = isConferencing || (isConferenceInProgress && isConsulting);

  // ============================================
  // Control Access Rules
  // ============================================

  // Hybrid conference detection for non-consulted agents
  // Uses both state machine state AND backend data
  const inConferenceState = isConferencing || isConferenceInProgress;

  // Consulted agent (Agent B/C) has limited controls during consult phase
  // They get full controls ONLY when their STATE MACHINE is in CONFERENCING
  // (not just because isConferenceInProgress - that checks the PARENT's conference)
  //
  const consultedAgentInConference = isConsultedAgent && isConferencing;
  const consultReceiverLimited =
    isConsultedAgent && !context.consultInitiator && !isWrappingUp && !consultedAgentInConference;
  const allowPrimaryControls = !consultReceiverLimited;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future queue consult gating
  const isConsultQueuePending =
    context.consultInitiator &&
    context.consultDestinationType === DESTINATION_TYPE.QUEUE &&
    !context.consultDestinationAgentJoined;

  // Agent A in CONSULTING state: determine if on consult leg or main call
  // Per ui-controls-conference-task-refactor.md: different buttons based on which leg is active
  // These flags can be used for future enhancements to switch call UI controls
  // const isAgentAOnConsultLeg = isConsulting && context.consultInitiator && !consultCallHeld;
  // const isAgentAOnMainCall = isConsulting && context.consultInitiator && consultCallHeld;

  // Mute is ONLY available for WebRTC calls (browser-based calling)
  // Non-WebRTC voice calls use desk phones where mute is physical
  const muteVisible = isWebrtc && (isConnected || isConsulting || isConferencing);
  const muteEnabled = muteVisible && !isHeld && !isWrappingUp;

  // ============================================
  // Consult Button Gating per widgets-util-logic.md
  // ============================================
  // Consult disabled when:
  // 1. Max participants reached (7 agents)
  // 2. Consult already in progress
  // 3. Customer not in call
  // 4. Agent is the consulted party (Agent B)
  // 5. Agent is in CONSULTING state
  // 6. In CONFERENCING state but no room for more (visible but disabled at max)
  const canInitiateConsultFromConnected =
    allowPrimaryControls &&
    !maxParticipantsReached &&
    !consultInProgress &&
    customerInCall &&
    !isConsultedAgent;

  // For initiating consult from conference, use state machine state (isConsulting) to check
  // if a consult is already active, rather than backend data (consultInProgress).
  // This is because the backend may still have old consult media entries after merge.
  // Use inConferenceState to include Agent B.
  const canInitiateConsultFromConference =
    inConferenceState && !maxParticipantsReached && !isConsulting && customerInCall;

  // ============================================
  // Hold Button in Conference
  // Per ui-controls-conference-task-refactor.md: visible but DISABLED in CONFERENCING
  // ============================================
  const holdVisibleInConference = inConferenceState;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Documented: explicitly disabled per spec
  const holdEnabledInConference = false;

  // ============================================
  // Recording Controls
  // Per ui-controls-conference-task-refactor.md: HIDDEN in CONSULTING and CONFERENCING
  // ============================================
  const recordingVisibleStates = isConnected || isHeld;
  const recordingHiddenInConsultOrConference = isConsulting || inConferenceState;

  // ============================================
  // Exit/Transfer Conference
  // Per ui-controls-conference-task-refactor.md: disabled during Conference + Consult
  // ============================================
  // IMPORTANT: Exit/Transfer should only be DISABLED when Agent A (consultInitiator) starts a NEW
  // consult from within an existing conference. In this case, they can't exit until the consult completes.
  //
  // Agent B (consulted agent, consultInitiator: false) who was merged INTO the conference should
  // always be able to exit, even if their state machine is in CONSULTING state.
  //
  // Key distinction:
  // - consultInitiator: true + isConsulting + isConferenceInProgress → Agent A started new consult FROM conference → DISABLE exit
  // - consultInitiator: false + isConsulting + isConferenceInProgress → Agent B was consulted INTO conference → ENABLE exit
  const isAgentAConsultingFromConference =
    context.consultInitiator && isConsulting && isConferenceInProgress;
  const exitConferenceEnabled = inConferenceState && !isAgentAConsultingFromConference;

  // For consulted agents (isConsultedAgent): exitConference should ONLY be visible when their
  // state machine is in CONFERENCING state, NOT just because isConferenceInProgress is true.
  // This is because isConferenceInProgress checks the PARENT's conference, but the consulted agent
  // might not be IN the conference yet (still in consult phase).
  // - Consulted agent in consult phase: state=CONSULTING, should see endConsult, NOT exitConference
  // - Consulted agent after merge: state=CONFERENCING, should see exitConference
  const exitConferenceVisible = isConsultedAgent
    ? isConferencing // Consulted agent: only when their state machine is in CONFERENCING
    : inConferenceState; // Non-consulted: use hybrid flag (includes isConferenceInProgress)

  // Transfer Conference: Only visible when in conference AND actively consulting another agent
  // Per conference-spec.md: "Transfer Conference" transfers the entire conference to the consulted agent
  // This only makes sense when there's an active consult to transfer TO
  // Also, only the interaction OWNER can transfer the conference
  //
  // IMPORTANT: Transfer Conference IS enabled during Conference + Consult scenario!
  // When Agent A is in a conference and consults Agent C, once Agent C accepts,
  // Agent A should be able to transfer the entire conference to Agent C.
  const isInteractionOwner = config.agentId ? interaction?.owner === config.agentId : true;
  const hasActiveConsultToTransferTo = isConsulting && context.consultDestinationAgentJoined;
  // Transfer Conference: visible when in conference with active consult, enabled for owner only
  const transferConferenceVisible = inConferenceState && hasActiveConsultToTransferTo;
  // Enabled when visible AND owner - NO restriction for consulting from conference
  const transferConferenceEnabled = transferConferenceVisible && isInteractionOwner;

  const voiceControls: TaskUIControls = {
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

    // Hold button: visible when connected, held, or in conference (but disabled in conference)
    // Per ui-controls-conference-task-refactor.md: visible but disabled in CONFERENCING
    // During consulting: HIDDEN (use switchToMainCall/switchToConsult buttons instead)
    // SDK's holdResume() doesn't allow operations in CONSULTING state
    hold: {
      isVisible: allowPrimaryControls && (isConnected || isHeld || holdVisibleInConference),
      isEnabled:
        allowPrimaryControls &&
        (isConnected || isHeld) &&
        !holdVisibleInConference &&
        !isConsulting,
    },

    // Mute button: visible when active call, disabled during wrapup
    mute: {
      isVisible: muteVisible,
      isEnabled: muteEnabled,
    },

    // End button: visible and enabled based on state
    // Per conference-spec.md: End terminates entire call for all participants
    // Per ui-controls-conference-task-refactor.md:
    // - CONSULTING (Agent A on consult leg, consultCallHeld: false): END is NOT visible (use endConsult)
    // - CONSULTING (Agent A on main call, consultCallHeld: true): END IS visible
    // - CONSULTING (Agent B): END is NOT visible
    // - CONFERENCING: END IS visible for ALL agents (primary and consulted)
    // For CONFERENCING state, we explicitly enable End for everyone since conference allows all
    // participants to end the call
    //
    // FIX: During CONSULTING state (especially from conference), hide End button when on consult leg.
    // Agent should use endConsult instead. Only show End when on main call (consultCallHeld: true).
    end: (() => {
      // In CONFERENCING state: always show End for all agents
      if (isConferencing) {
        return {
          isVisible: config.isEndTaskEnabled,
          isEnabled: !isWrappingUp,
        };
      }

      // In CONSULTING state: End is HIDDEN when on consult leg (use endConsult instead)
      // End is VISIBLE only when on main call (consultCallHeld: true) or for consulted agent B
      if (isConsulting) {
        // Consult initiator on consult leg (consultCallHeld: false): hide End
        // Consult initiator on main call (consultCallHeld: true): show End
        // Consulted agent (Agent B): hide End
        const consultCallHeld = context.consultCallHeld ?? false;
        const showEndInConsult = context.consultInitiator && consultCallHeld;

        return {
          isVisible: showEndInConsult && config.isEndTaskEnabled,
          isEnabled: showEndInConsult && !isWrappingUp,
        };
      }

      // Default: Connected/Held states
      return {
        isVisible: allowPrimaryControls && config.isEndTaskEnabled && isActiveCall,
        isEnabled: allowPrimaryControls && isActiveCall && !isHeld && !isWrappingUp,
      };
    })(),

    // Transfer button: SINGLE transfer button for all transfer scenarios
    // - Connected/Held: visible and enabled, wires to regular transfer
    // - Consulting (not from conference): visible, but ONLY enabled after consult accepted
    // - Conferencing: HIDDEN (use transferConference button instead)
    // - Consulting FROM conference: HIDDEN (use transferConference button instead)
    // - CONSULT_INITIATING: visible but DISABLED (must wait for consult to be accepted)
    transfer: {
      isVisible:
        allowPrimaryControls &&
        (stateConnected || stateHeld || (isConsulting && !isConferenceInProgress)) &&
        !inConferenceState,
      isEnabled:
        allowPrimaryControls &&
        // In connected/held: always enabled
        // In consulting: only enabled after destination agent joined (consult accepted)
        (stateConnected || stateHeld || context.consultDestinationAgentJoined),
    },

    // Consult button per widgets-util-logic.md gating
    // Visible in connected, held, or conferencing states
    // Disabled based on max participants, customer presence, consult in progress
    // Use inConferenceState to include Agent B who may not have state machine in CONFERENCING
    consult: {
      isVisible: allowPrimaryControls && (isConnected || isHeld || inConferenceState),
      isEnabled:
        (isConnected || isHeld ? canInitiateConsultFromConnected : false) ||
        canInitiateConsultFromConference,
    },

    // Consult transfer: ALWAYS HIDDEN - use regular transfer button instead
    // Single transfer button handles all transfer scenarios
    consultTransfer: {
      isVisible: false,
      isEnabled: false,
    },

    // End consult button: visible during consulting state
    // Per ui-controls-conference-task-refactor.md: Agent B end consult gated by tenant config
    //
    // IMPORTANT: There are 3 scenarios:
    // 1. Regular consult (not from conference): isConsulting && !isConferenceInProgress
    //    - Agent A: sees End Consult
    //    - Agent B (consulted): sees End Consult (if enabled by tenant)
    //
    // 2. Consulted agent (Agent B) who was merged INTO conference:
    //    - state=CONSULTING means they haven't been merged yet -> show End Consult
    //    - state=CONFERENCING means they're in conference -> show Exit Conference
    //
    // 3. Agent A consulting FROM conference (Conference + Consult):
    //    - isConsulting=true, isConferenceInProgress=true, consultInitiator=true
    //    - Agent A should see End Consult (to end consult and return to conference)
    //    - This is the "isAgentAConsultingFromConference" scenario
    endConsult: {
      isVisible:
        isConsulting &&
        (isConsultedAgent
          ? !isConferencing // Consulted agent: only when NOT in CONFERENCING state
          : !isConferencing || isAgentAConsultingFromConference), // Non-consulted: show when consulting from conference OR not in conference
      isEnabled: context.consultInitiator ? true : config.isEndConsultEnabled,
    },

    // Recording controls: HIDDEN in CONSULTING and CONFERENCING per ui-controls spec
    recording: {
      isVisible:
        allowPrimaryControls &&
        recordingAvailable &&
        recordingFeatureEnabled &&
        recordingVisibleStates &&
        !recordingHiddenInConsultOrConference,
      isEnabled:
        recordingAvailable &&
        recordingFeatureEnabled &&
        recordingInProgress &&
        allowPrimaryControls &&
        !recordingHiddenInConsultOrConference,
    },

    // Conference/Merge button: visible during consulting BEFORE conference starts
    // Once in conference, this button should NOT be visible (use consult button to add more participants)
    // Enabled only if consulted agent has joined and under max participants
    // Conference/Merge buttons: Show when consulting (from any state) and agent is initiator.
    // Removed !isConferenceInProgress because when consulting FROM conference, we DO want merge.
    // The isConsulting && consultInitiator conditions already gate this properly:
    // - In conference without consult: isConsulting=false -> not visible
    // - Consulting from scratch: isConsulting=true, consultInitiator=true -> visible
    // - Consulting from conference: isConsulting=true, consultInitiator=true -> visible (this is the fix!)
    conference: {
      isVisible: allowPrimaryControls && isConsulting,
      isEnabled: allowPrimaryControls && context.consultDestinationAgentJoined,
    },

    // Wrapup button: visible during wrapup state
    wrapup: {
      isVisible: isWrappingUp,
      isEnabled: true,
    },

    // Exit conference button: visible during conference
    // Per ui-controls-conference-task-refactor.md: DISABLED during Conference + Consult
    // Per conference-spec.md: All agents in conference should see exit button
    // IMPORTANT: For consulted agents, only show when their state machine is in CONFERENCING,
    // NOT just because isConferenceInProgress (which checks parent's conference)
    exitConference: {
      isVisible: exitConferenceVisible,
      isEnabled: exitConferenceEnabled,
    },

    // Transfer conference: visible during conference with active consult
    // Per conference-spec.md: "Transfer Conference" transfers entire conference to consulted agent
    // Only visible when there's an active consult to transfer TO, and only enabled for owner
    transferConference: {
      isVisible: transferConferenceVisible,
      isEnabled: transferConferenceEnabled,
    },

    // Merge to conference: visible during consulting BEFORE conference starts (alias for conference button)
    // Once in conference, this button should NOT be visible (use consult button to add more participants)
    // Enabled when consulted agent joined and not at max participants
    mergeToConference: {
      isVisible: isConsulting && context.consultInitiator,
      isEnabled: context.consultDestinationAgentJoined && !maxParticipantsReached,
    },

    // Switch to main call: visible during consulting when on consult leg
    // Only for consult initiator (Agent A) to switch between legs
    switchToMainCall: {
      isVisible: isConsulting && context.consultInitiator && !context.consultCallHeld,
      isEnabled: context.consultDestinationAgentJoined,
    },

    // Switch to consult: visible during consulting when on main call leg
    // Only for consult initiator (Agent A) to switch between legs
    switchToConsult: {
      isVisible: isConsulting && context.consultInitiator && context.consultCallHeld,
      isEnabled: context.consultDestinationAgentJoined,
    },
  };

  return voiceControls;
}

/**
 * Compute UI controls for digital channel
 */
function computeDigitalUIControls(
  currentState: TaskState,
  context: TaskContext,
  fallbackTaskData?: TaskData
): TaskUIControls {
  const isOffered =
    currentState === TaskState.OFFERED || currentState === TaskState.OFFERED_CONSULT;
  const isConnected = currentState === TaskState.CONNECTED;
  const isWrappingUp = currentState === TaskState.WRAPPING_UP;
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

    // Switch to main call: not used in digital channels
    switchToMainCall: {
      isVisible: false,
      isEnabled: false,
    },

    // Switch to consult: not used in digital channels
    switchToConsult: {
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

  // Terminal states - all controls should be hidden
  // This handles the case where a call ends and no wrapup is needed
  if (currentState === TaskState.TERMINATED || currentState === TaskState.COMPLETED) {
    return getDefaultUIControls();
  }

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
