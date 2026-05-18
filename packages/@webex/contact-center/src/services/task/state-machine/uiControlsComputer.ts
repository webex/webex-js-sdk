/**
 * UI Controls Computer - Centralized logic for computing UI control states
 */

import {
  InteractionUIControls,
  TASK_CHANNEL_TYPE,
  TaskData,
  TaskUILeg,
  TaskUIControls,
  VOICE_VARIANT,
} from '../types';
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

function getDefaultInteractionUIControls(): InteractionUIControls {
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
    switch: DISABLED,
  };
}

function createTaskUIControls(
  main: InteractionUIControls,
  consult: InteractionUIControls,
  activeLeg: TaskUILeg
): TaskUIControls {
  return {
    main,
    consult,
    activeLeg,
  };
}

export function getDefaultUIControls(): TaskUIControls {
  return createTaskUIControls(
    getDefaultInteractionUIControls(),
    getDefaultInteractionUIControls(),
    'main'
  );
}

function computeVoiceInteractionUIControls(
  state: TaskState,
  context: TaskContext,
  config: UIControlConfig,
  fallbackTaskData?: TaskData,
  currentLeg: TaskUILeg = 'main'
): InteractionUIControls {
  // Early exit for idle
  if (state === TaskState.IDLE) {
    return getDefaultInteractionUIControls();
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
  const {
    consultInitiator,
    consultDestinationAgentJoined,
    consultDestinationType,
    consultCallHeld,
    consultFromConference,
  } = context;
  const {recordingControlsAvailable} = context;

  // EP_DN consults are "ready" as soon as the consult is created (EP accepts routing immediately).
  // Backend sends destinationType as 'EP-DN'; SDK method uses 'entryPoint' — check both.
  const isEpDnConsult =
    consultDestinationType === 'entryPoint' || consultDestinationType === ('EP-DN' as any);
  const isConsultDestinationReady = consultDestinationAgentJoined || isEpDnConsult;

  const stateImpliesHeld = state === TaskState.HELD || state === TaskState.RESUME_INITIATING;
  const stateImpliesConnected =
    state === TaskState.CONNECTED || state === TaskState.HOLD_INITIATING;
  const isHeld = stateImpliesHeld || serverHold === true;
  const isConnected = stateImpliesConnected || (!stateImpliesHeld && serverHold === false);

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
  const consultMedia = Object.values(interaction?.media ?? {}).find(
    (media: any) =>
      media?.mediaResourceId === taskData?.consultMediaResourceId || media?.mType === 'consult'
  ) as {participants?: string[]} | undefined;
  const selfInConsultCall =
    Boolean(selfAgentId) && Boolean(consultMedia?.participants?.includes(selfAgentId as string));
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
  const consultOwnedBySelf =
    consultInitiator || (Boolean(selfAgentId) && taskData?.consultingAgentId === selfAgentId);
  const hasConsultMedia = Boolean(
    taskData?.consultMediaResourceId ||
      Object.values(interaction?.media ?? {}).some((media: any) => media?.mType === 'consult')
  );
  const selfParticipant = selfAgentId ? interaction?.participants?.[selfAgentId] : null;
  const selfConsultPendingOnConsultMedia =
    selfParticipant?.consultState === 'consultInitiated' &&
    !taskData?.isConsulted &&
    hasConsultMedia;
  const isHydratedConferenceConsultPending =
    inConference && selfConsultPendingOnConsultMedia && !consultDestinationAgentJoined;
  const hasParallelConsultLeg =
    consultOwnedBySelf &&
    !isConsulting &&
    !isConsulted &&
    (consultInProgress || consultCallHeld || hasConsultMedia);
  const consultLegOnHold = isConsulting && consultCallHeld;
  const callProcessingDetails = interaction?.callProcessingDetails as
    | {conferenceHoldParticipant?: boolean | string}
    | undefined;
  const conferenceHoldParticipant =
    callProcessingDetails?.conferenceHoldParticipant === true ||
    callProcessingDetails?.conferenceHoldParticipant === 'true';
  const postDeclineHeldMainLeg =
    consultInitiator &&
    !consultDestinationAgentJoined &&
    isHeld &&
    inConference &&
    conferenceHoldParticipant;
  const postConsultCompletedHeldMainLeg =
    selfParticipant?.consultState === 'consultCompleted' && isHeld && inConference && !isConsulting;
  const isConsultPendingBeforeJoin =
    selfParticipant?.consultState === 'consultInitiated' && !consultDestinationAgentJoined;
  const hideExitConferenceWhileConsultPending =
    isConsultPendingBeforeJoin &&
    (consultFromConference || consultInitiator || taskData?.type === 'AgentConsultCreated');
  const hideExitConferenceDuringActiveConsultFromConference =
    inConference &&
    consultInitiator &&
    consultDestinationAgentJoined &&
    (isConsulting ||
      taskData?.type === 'AgentConsulting' ||
      selfParticipant?.consultState === 'consulting');
  const forceHeldPostConsultControls =
    !hideExitConferenceWhileConsultPending &&
    (postDeclineHeldMainLeg || postConsultCompletedHeldMainLeg);

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
      if (forceHeldPostConsultControls) return VISIBLE_ENABLED;
      if (consultOwnedBySelf && (isConsulting || hasParallelConsultLeg || consultCallHeld)) {
        return DISABLED;
      }
      if (hasParallelConsultLeg) return DISABLED;
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
      if (currentLeg === 'consult' && !selfInConsultCall) return DISABLED;
      if (isConsulting) return VISIBLE_ENABLED;

      if (isConnected || isHeld || isConferencing) {
        if (inConference) return VISIBLE_ENABLED;

        return isHeld ? VISIBLE_DISABLED : VISIBLE_ENABLED;
      }

      return DISABLED;
    })(),

    // End: varies by state; during consulting only on main leg (consult held)
    end: (() => {
      if (isHydratedConferenceConsultPending && currentLeg === 'main') return VISIBLE_DISABLED;
      if (!config.isEndTaskEnabled) return DISABLED;
      if (hasParallelConsultLeg) {
        return isConnected && isEpDnConsult ? VISIBLE_ENABLED : VISIBLE_DISABLED;
      }

      if (isConsulting) {
        if (currentLeg === 'consult' && consultCallHeld) return DISABLED;

        return consultInitiator && consultCallHeld ? VISIBLE_ENABLED : DISABLED;
      }

      if (inConference) {
        if (isConsulted) return DISABLED;
        if (forceHeldPostConsultControls) return VISIBLE_DISABLED;

        if (consultInProgress) return VISIBLE_DISABLED;

        return isWrappingUp ? VISIBLE_DISABLED : VISIBLE_ENABLED;
      }
      if (!hasFullControls) return DISABLED;
      if (isActive) return isHeld || isWrappingUp ? VISIBLE_DISABLED : VISIBLE_ENABLED;

      return DISABLED;
    })(),

    // Transfer: connected/held/conference
    transfer: (() => {
      if (isHydratedConferenceConsultPending) return VISIBLE_DISABLED;
      if (hasParallelConsultLeg) {
        if (!customerPresent) return DISABLED;
        if (state === TaskState.CONNECTED) return VISIBLE_ENABLED;
        if (state === TaskState.HELD) return VISIBLE_DISABLED;
      }
      if (isConsulting) {
        if (!consultInitiator) return DISABLED;
        if (!customerPresent) return VISIBLE_DISABLED;
        if (consultLegOnHold) return VISIBLE_DISABLED;

        return isConsultDestinationReady ? VISIBLE_ENABLED : VISIBLE_DISABLED;
      }
      if (!hasFullControls) return DISABLED;
      if (inConference) {
        // Real conference (multiple agents): transfer is hidden
        // Pending conference (only self agent): transfer remains available
        return participantCount > 1 ? DISABLED : VISIBLE_ENABLED;
      }
      if (state === TaskState.CONNECTED || state === TaskState.HELD) return VISIBLE_ENABLED;

      return DISABLED;
    })(),

    // Consult: connected/held/conference when conditions met
    consult: (() => {
      const isConnectedOrHeld = state === TaskState.CONNECTED || state === TaskState.HELD;

      if (hasParallelConsultLeg) return DISABLED;
      if (!hasFullControls || !(isConnectedOrHeld || inConference)) {
        return DISABLED;
      }

      // In conference: behavior depends on whether it's a real multi-agent conference
      if (inConference) {
        // Pending conference (only self agent): consult disabled
        if (participantCount <= 1) return VISIBLE_DISABLED;
        // Real conference: consult enabled if conditions met
        const canFromConference =
          !maxParticipants && customerPresent && !consultInProgress && !isConsulting;

        return {isVisible: true, isEnabled: canFromConference};
      }

      // Enabled conditions for connected/held
      const canFromConnected =
        !maxParticipants && customerPresent && !consultInProgress && !isConsulted;

      return {isVisible: true, isEnabled: canFromConnected};
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

    // Recording: connected/held, hidden in real conference, visible in pending conference
    recording: (() => {
      if (!recordingControlsAvailable || !config.isRecordingEnabled) return DISABLED;
      if (!hasFullControls || isConsulting) return DISABLED;
      if (inConference) {
        // Real conference (multiple agents): recording hidden
        // Pending conference (only self agent): recording available
        return participantCount > 1 ? DISABLED : VISIBLE_ENABLED;
      }
      if (hasParallelConsultLeg && !customerPresent) return DISABLED;
      if (state === TaskState.CONNECTED || state === TaskState.HELD) {
        return VISIBLE_ENABLED;
      }

      return DISABLED;
    })(),

    // Conference: during consulting, enabled on both legs when agent joined
    // Label changes based on leg: "Conference" on main leg, "Merge" on consult leg
    conference: (() => {
      if (isHydratedConferenceConsultPending && currentLeg === 'main') return VISIBLE_DISABLED;
      if (hasParallelConsultLeg) {
        if (!customerPresent) return DISABLED;
        if (state === TaskState.CONNECTED) {
          return maxParticipants ? VISIBLE_DISABLED : VISIBLE_ENABLED;
        }
        if (state === TaskState.HELD) return VISIBLE_DISABLED;

        return DISABLED;
      }
      if (!hasFullControls || !isConsulting) return DISABLED;
      if (!consultInitiator) return DISABLED;
      if (!customerPresent) return VISIBLE_DISABLED;
      if (consultLegOnHold) return VISIBLE_DISABLED;

      return isConsultDestinationReady && !maxParticipants ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),

    // Wrapup: wrapping up state
    wrapup: isWrappingUp ? VISIBLE_ENABLED : DISABLED,

    // ExitConference: in conference with multiple agents in main call
    exitConference: (() => {
      if (hideExitConferenceDuringActiveConsultFromConference) return DISABLED;
      if (forceHeldPostConsultControls) return VISIBLE_DISABLED;
      if (hideExitConferenceWhileConsultPending) return DISABLED;
      if (isConsulted && !isConferencing) return DISABLED;
      if (!inConference) return DISABLED;
      if (participantCount <= 1) return DISABLED;
      if (consultInProgress) return VISIBLE_DISABLED;
      const consultingFromConference = consultInitiator && isConsulting && conferenceFromBackend;

      return consultingFromConference ? VISIBLE_DISABLED : VISIBLE_ENABLED;
    })(),

    // TransferConference: in conference with active consult, owner consulting from conference
    transferConference: (() => {
      if (hasParallelConsultLeg || consultLegOnHold) return DISABLED;
      if (!inConference || !isConsulting) return DISABLED;
      if (!consultInitiator || isConsulted) return DISABLED;

      return isConsultDestinationReady ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),

    // MergeToConference: mirrors conference control, enabled on both legs
    mergeToConference: (() => {
      if (isHydratedConferenceConsultPending && currentLeg === 'consult') return VISIBLE_DISABLED;
      if (!isConsulting || !consultInitiator) return DISABLED;
      if (!customerPresent) return VISIBLE_DISABLED;
      if (consultLegOnHold) return VISIBLE_DISABLED;

      return isConsultDestinationReady && !maxParticipants ? VISIBLE_ENABLED : VISIBLE_DISABLED;
    })(),

    // Switch: visible only on the currently active leg
    switch: (() => {
      if (isHydratedConferenceConsultPending && currentLeg === 'consult') return VISIBLE_DISABLED;
      if (!customerPresent && hasParallelConsultLeg) return DISABLED;
      if (currentLeg === 'consult') {
        if (!isConsulting || !consultInitiator || consultCallHeld) return DISABLED;
        if (!customerPresent) return VISIBLE_DISABLED;

        return isConsultDestinationReady ? VISIBLE_ENABLED : VISIBLE_DISABLED;
      }

      if (hasParallelConsultLeg && state === TaskState.CONNECTED) {
        return isConsultDestinationReady ? VISIBLE_ENABLED : VISIBLE_DISABLED;
      }

      return DISABLED;
    })(),
  };
}

function computeDigitalInteractionUIControls(
  state: TaskState,
  context: TaskContext,
  fallbackTaskData?: TaskData
): InteractionUIControls {
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
    switch: DISABLED,
  };
}

function getVoiceLegState(
  currentState: TaskState,
  context: TaskContext,
  config: UIControlConfig,
  fallbackTaskData?: TaskData
): {hasConsultLeg: boolean; activeLeg: TaskUILeg; mainState: TaskState; consultState: TaskState} {
  if (currentState === TaskState.WRAPPING_UP) {
    return {
      hasConsultLeg: false,
      activeLeg: 'main',
      mainState: currentState,
      consultState: TaskState.CONSULTING,
    };
  }

  const taskData = context.taskData ?? fallbackTaskData ?? null;
  const interaction = taskData?.interaction;
  const mainCallId = interaction?.mainInteractionId || taskData?.interactionId;
  const selfAgentId = config.agentId ?? taskData?.agentId;
  const consultInProgress = getIsConsultInProgressForConferenceControls(
    interaction,
    mainCallId,
    selfAgentId
  );
  const isConsultingState =
    currentState === TaskState.CONSULTING ||
    currentState === TaskState.CONSULT_INITIATING ||
    currentState === TaskState.CONF_INITIATING;
  const consultOwnedBySelf =
    context.consultInitiator ||
    (Boolean(selfAgentId) && taskData?.consultingAgentId === selfAgentId);
  const hasConsultMedia = Boolean(
    taskData?.consultMediaResourceId ||
      Object.values(interaction?.media ?? {}).some((media: any) => media?.mType === 'consult')
  );
  const selfParticipant = selfAgentId ? interaction?.participants?.[selfAgentId] : null;
  const selfConsultPendingOnConsultMedia =
    selfParticipant?.consultState === 'consultInitiated' &&
    !taskData?.isConsulted &&
    hasConsultMedia;
  const selfConsultingOnConsultMedia =
    selfParticipant?.consultState === 'consulting' && hasConsultMedia;
  const hasConsultLeg = Boolean(
    !interaction?.isTerminated &&
      ((consultOwnedBySelf && !taskData?.isConsulted) ||
        selfConsultingOnConsultMedia ||
        selfConsultPendingOnConsultMedia) &&
      (consultInProgress || isConsultingState || context.consultCallHeld || hasConsultMedia)
  );

  if (!hasConsultLeg) {
    return {
      hasConsultLeg: false,
      activeLeg: 'main',
      mainState: currentState,
      consultState: TaskState.CONSULTING,
    };
  }

  let mainState = TaskState.HELD;
  if (currentState === TaskState.CONFERENCING) {
    mainState = TaskState.CONFERENCING;
  } else if (context.consultCallHeld) {
    mainState = TaskState.CONNECTED;
  }

  return {
    hasConsultLeg: true,
    activeLeg: context.consultCallHeld ? 'main' : 'consult',
    mainState,
    consultState: isConsultingState ? currentState : TaskState.CONSULTING,
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
    case TASK_CHANNEL_TYPE.VOICE: {
      const {hasConsultLeg, activeLeg, mainState, consultState} = getVoiceLegState(
        currentState,
        context,
        context.uiControlConfig,
        fallbackTaskData
      );

      const mainControls = computeVoiceInteractionUIControls(
        mainState,
        context,
        context.uiControlConfig,
        fallbackTaskData,
        'main'
      );
      const consultControls = hasConsultLeg
        ? computeVoiceInteractionUIControls(
            consultState,
            context,
            context.uiControlConfig,
            fallbackTaskData,
            'consult'
          )
        : getDefaultInteractionUIControls();

      return createTaskUIControls(mainControls, consultControls, activeLeg);
    }
    case TASK_CHANNEL_TYPE.DIGITAL:
      return createTaskUIControls(
        computeDigitalInteractionUIControls(currentState, context, fallbackTaskData),
        getDefaultInteractionUIControls(),
        'main'
      );
    default:
      return getDefaultUIControls();
  }
}

function haveInteractionUIControlsChanged(
  previous: InteractionUIControls,
  next: InteractionUIControls
): boolean {
  return (Object.keys(next) as (keyof InteractionUIControls)[]).some((key) => {
    const prev = previous[key];
    const curr = next[key];

    return prev.isVisible !== curr.isVisible || prev.isEnabled !== curr.isEnabled;
  });
}

export function haveUIControlsChanged(
  previous: TaskUIControls | undefined,
  next: TaskUIControls
): boolean {
  if (!previous) return true;

  return (
    previous.activeLeg !== next.activeLeg ||
    haveInteractionUIControlsChanged(previous.main, next.main) ||
    haveInteractionUIControlsChanged(previous.consult, next.consult)
  );
}
