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

/** Consult media must exist on the interaction payload, not only as a stale resource id. */
function hasConsultMediaInInteraction(
  interaction: TaskData['interaction'] | undefined,
  consultMediaResourceId?: string
): boolean {
  const media = interaction?.media ?? {};
  const hasConsultLeg = Object.values(media).some((entry: any) => entry?.mType === 'consult');

  if (hasConsultLeg) return true;
  if (!consultMediaResourceId) return false;

  return Boolean(media[consultMediaResourceId]);
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

  // Prefer live task.data (fallback) over stale state-machine snapshot during multi-login sync.
  const taskData = fallbackTaskData ?? context.taskData ?? null;
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
  const selfParticipant = selfAgentId ? interaction?.participants?.[selfAgentId] : null;
  const selfInConsultCall =
    Boolean(selfAgentId) && Boolean(consultMedia?.participants?.includes(selfAgentId as string));
  const hasConsultMedia = hasConsultMediaInInteraction(
    interaction,
    taskData?.consultMediaResourceId
  );
  const isConsultEndedForSelf =
    taskData?.type === 'AgentConsultEnded' ||
    taskData?.type === 'AgentConsultFailed' ||
    (selfParticipant?.consultState === 'consultCompleted' &&
      !hasConsultMedia &&
      taskData?.isConsulted === false);
  const effectiveConsultInitiator = isConsultEndedForSelf ? false : consultInitiator;
  const effectiveConsultCallHeld = isConsultEndedForSelf ? false : consultCallHeld;
  const effectiveConsultFromConference = isConsultEndedForSelf ? false : consultFromConference;
  const effectiveConsultDestinationAgentJoined = isConsultEndedForSelf
    ? false
    : consultDestinationAgentJoined;
  // After a consult ends for self, the backend stops sending consult media but the merged
  // task.data can still carry the stale consult-media entry (reconcileData never deletes keys).
  // Treat it as gone so post-consult main-leg controls (consult retry) are not blocked.
  const effectiveHasConsultMedia = isConsultEndedForSelf ? false : hasConsultMedia;
  const isConsultDestinationReady = effectiveConsultDestinationAgentJoined || isEpDnConsult;
  const conferenceActive =
    isConferencing || conferenceFromBackend || effectiveConsultFromConference;
  // Treat consult initiator as "in conference" even if mainCall participant list lags while consulting.
  const inConference =
    conferenceActive && (isConferencing || selfInMainCall || effectiveConsultInitiator);

  // Check if this is a consulted agent (must be after isConsulting is computed).
  const isSoleAgentOnCall =
    participantCount <= 1 && selfInMainCall && !isConsulting && !inConference;
  const isConsulted =
    inConference || isSoleAgentOnCall
      ? false
      : getIsConsultedAgentForControls(taskData, context, isConsulting) ||
        (!effectiveConsultInitiator &&
          (selfParticipant?.isConsulted === true ||
            selfParticipant?.consultState === 'consulting'));

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
  const hasFullControls = !isConsulted || effectiveConsultInitiator || inConference || isWrappingUp;
  const consultOwnedBySelf =
    effectiveConsultInitiator ||
    (Boolean(selfAgentId) && taskData?.consultingAgentId === selfAgentId);
  const selfConsultPendingOnConsultMedia =
    selfParticipant?.consultState === 'consultInitiated' &&
    !taskData?.isConsulted &&
    hasConsultMedia;
  const ownerParticipant = interaction?.owner
    ? interaction.participants?.[interaction.owner]
    : undefined;
  const otherAgentConsultInProgress = Boolean(
    interaction?.participants &&
      Object.values(interaction.participants).some((participant: any) => {
        if (!participant || participant.hasLeft) return false;
        if (participant.id === selfAgentId) return false;
        if (participant.pType !== 'AGENT') return false;

        return (
          participant.consultState === 'consultInitiated' ||
          participant.consultState === 'consultReserved' ||
          participant.consultState === 'consulting' ||
          participant.currentState === 'consulting'
        );
      })
  );
  const isHydratedConferenceConsultPending =
    inConference && selfConsultPendingOnConsultMedia && !effectiveConsultDestinationAgentJoined;
  const hasParallelConsultLeg =
    !isConsultEndedForSelf &&
    consultOwnedBySelf &&
    !isConsulting &&
    !isConsulted &&
    (consultInProgress || effectiveConsultCallHeld || hasConsultMedia);
  const activeLegForConferenceConsult = effectiveConsultCallHeld ? 'main' : 'consult';
  const isCurrentLegActive = currentLeg === activeLegForConferenceConsult;
  const isConferenceConsultTransferContext =
    inConference && effectiveConsultInitiator && hasConsultMedia && isConsultDestinationReady;
  const consultLegOnHold = isConsulting && effectiveConsultCallHeld;
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
  const nonOwnerPostConsultCompletedHeldMainLeg =
    isHeld &&
    inConference &&
    !isConsulting &&
    !consultInitiator &&
    Boolean(selfAgentId) &&
    Boolean(interaction?.owner) &&
    selfAgentId !== interaction?.owner &&
    ownerParticipant?.consultState === 'consultCompleted';
  const isConsultPendingBeforeJoin =
    selfParticipant?.consultState === 'consultInitiated' && !consultDestinationAgentJoined;
  const hideExitConferenceWhileConsultPending =
    currentLeg === 'main' &&
    inConference &&
    isConsultPendingBeforeJoin &&
    (consultFromConference ||
      consultInitiator ||
      taskData?.type === 'AgentConsultCreated' ||
      consultInProgress ||
      isConsulting);
  const hideExitConferenceDuringActiveConsultFromConference =
    inConference &&
    consultInitiator &&
    consultDestinationAgentJoined &&
    (isConsulting ||
      taskData?.type === 'AgentConsulting' ||
      selfParticipant?.consultState === 'consulting');
  const hideExitConferenceOnMainLegForEpDnConsultFromConference =
    currentLeg === 'main' &&
    inConference &&
    consultFromConference &&
    consultInitiator &&
    (isConsulting ||
      consultInProgress ||
      taskData?.type === 'AgentConsultCreated' ||
      taskData?.type === 'AgentConsulting' ||
      selfParticipant?.consultState === 'consultInitiated' ||
      selfParticipant?.consultState === 'consulting');
  const forceHeldPostConsultControls =
    !hideExitConferenceWhileConsultPending &&
    (postDeclineHeldMainLeg || postConsultCompletedHeldMainLeg);
  const selfOnConsultLeg =
    selfParticipant?.consultState === 'consulting' ||
    selfParticipant?.currentState === 'consulting';
  const showMainLegConferenceControlsDuringConsult =
    currentLeg === 'main' && inConference && consultInProgress && !selfOnConsultLeg;
  const allowHeldMainLegControlsForNonInitiator =
    showMainLegConferenceControlsDuringConsult && !isHydratedConferenceConsultPending;
  const isConsultRequestedPhase =
    isConsultPendingBeforeJoin &&
    !isConsulted &&
    (consultInitiator ||
      (Boolean(selfAgentId) &&
        selfParticipant?.consultState === 'consultInitiated' &&
        taskData?.agentId === selfAgentId));
  const isConsultUnansweredFailure =
    currentLeg === 'main' &&
    !inConference &&
    !taskData?.isConsulted &&
    !effectiveHasConsultMedia &&
    isHeld &&
    selfParticipant?.consultState === 'consultCompleted' &&
    (taskData?.type === 'AgentConsultFailed' ||
      taskData?.type === 'AgentConsultEnded' ||
      isConsultEndedForSelf);

  if (isConsultUnansweredFailure) {
    const recordingControl =
      recordingControlsAvailable && config.isRecordingEnabled && !inConference
        ? VISIBLE_ENABLED
        : DISABLED;

    return {
      ...getDefaultInteractionUIControls(),
      hold: VISIBLE_ENABLED,
      transfer: VISIBLE_ENABLED,
      consult: VISIBLE_ENABLED,
      recording: recordingControl,
      end: VISIBLE_DISABLED,
    };
  }

  if (isConsultRequestedPhase) {
    if (currentLeg === 'main') {
      return {
        ...getDefaultInteractionUIControls(),
        transfer: VISIBLE_DISABLED,
        conference: VISIBLE_DISABLED,
        end: VISIBLE_DISABLED,
      };
    }

    if (currentLeg === 'consult') {
      return {
        ...getDefaultInteractionUIControls(),
        endConsult: VISIBLE_ENABLED,
        switch: VISIBLE_DISABLED,
        transfer: VISIBLE_DISABLED,
        transferConference: inConference ? VISIBLE_DISABLED : DISABLED,
        mergeToConference: VISIBLE_DISABLED,
      };
    }
  }

  return {
    // Accept/Decline: Voice tasks in offered state
    // Desktop/WebRTC + inbound: accept enabled (agent manually accepts)
    // Desktop/WebRTC + outdial: accept disabled (auto-answer handles it; Widgets show "Accept" disabled)
    // Extension mode (non-WebRTC): accept disabled (Widgets show "Ringing...")
    accept:
      state === TaskState.OFFERED && !interaction?.isTerminated
        ? {isVisible: true, isEnabled: isWebrtc && !isOutdial}
        : DISABLED,
    decline: (() => {
      if (!isWebrtc || state !== TaskState.OFFERED || interaction?.isTerminated) return DISABLED;

      return isOutdial ? VISIBLE_DISABLED : VISIBLE_ENABLED;
    })(),

    // Hold: visible in connected/held/conference, disabled in conference/consulting
    hold: (() => {
      if (!hasFullControls) return DISABLED;
      if (forceHeldPostConsultControls) return VISIBLE_ENABLED;
      if (
        consultOwnedBySelf &&
        (isConsulting || hasParallelConsultLeg || effectiveConsultCallHeld)
      ) {
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
      // The consulted agent has no separate consult leg; their main leg is the active call, so
      // mute stays available while they consult (the heuristic below targets the initiator's
      // inactive leg, not the consultee's only leg).
      const isConsultedActiveMainLeg = isConsulted && currentLeg === 'main';
      if (
        (isConsulting || hasParallelConsultLeg) &&
        !isCurrentLegActive &&
        !isConsultedActiveMainLeg
      ) {
        return VISIBLE_DISABLED;
      }
      if (isConsulting) return VISIBLE_ENABLED;

      if (isConnected || isHeld || isConferencing) {
        if (inConference) return VISIBLE_ENABLED;

        return isHeld ? VISIBLE_DISABLED : VISIBLE_ENABLED;
      }

      return DISABLED;
    })(),

    // End: varies by state; during consulting only on main leg (consult held)
    end: (() => {
      if (allowHeldMainLegControlsForNonInitiator) return VISIBLE_ENABLED;
      if (showMainLegConferenceControlsDuringConsult) return VISIBLE_DISABLED;
      if (isHydratedConferenceConsultPending && currentLeg === 'main') return VISIBLE_DISABLED;
      if (!config.isEndTaskEnabled && !isWebrtc) return DISABLED;
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
      if (isConferenceConsultTransferContext && currentLeg === 'main' && isCurrentLegActive) {
        return DISABLED;
      }
      if (inConference && isConsulting && consultInitiator) return DISABLED;
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

      if (
        isHeld &&
        !inConference &&
        !effectiveHasConsultMedia &&
        selfParticipant?.consultState === 'consultCompleted' &&
        !taskData?.isConsulted
      ) {
        const canRetryConsult = !maxParticipants && customerPresent && !otherAgentConsultInProgress;

        return {isVisible: true, isEnabled: canRetryConsult};
      }

      if (inConference && nonOwnerPostConsultCompletedHeldMainLeg) return VISIBLE_DISABLED;
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
          !maxParticipants &&
          customerPresent &&
          !consultInProgress &&
          !otherAgentConsultInProgress &&
          !isConsulting;

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
      if (hideExitConferenceWhileConsultPending) return DISABLED;
      if (hideExitConferenceOnMainLegForEpDnConsultFromConference) return DISABLED;
      if (allowHeldMainLegControlsForNonInitiator) return VISIBLE_ENABLED;
      if (showMainLegConferenceControlsDuringConsult) return VISIBLE_DISABLED;
      if (hideExitConferenceDuringActiveConsultFromConference) return DISABLED;
      if (forceHeldPostConsultControls) return VISIBLE_DISABLED;
      if (isConsulted && !isConferencing) return DISABLED;
      if (!inConference) return DISABLED;
      if (participantCount <= 1) return DISABLED;
      if (consultInProgress) return VISIBLE_DISABLED;
      const consultingFromConference = consultInitiator && isConsulting && conferenceFromBackend;

      return consultingFromConference ? VISIBLE_DISABLED : VISIBLE_ENABLED;
    })(),

    // TransferConference: in conference with active consult, owner consulting from conference
    transferConference: (() => {
      if (isConferenceConsultTransferContext && !isCurrentLegActive) return VISIBLE_DISABLED;
      const consultLegTransferAvailable =
        currentLeg === 'consult' && inConference && consultInitiator && hasConsultMedia;
      const selfConsultingOnParticipantState = selfParticipant?.consultState === 'consulting';
      const conferenceTransferAvailable =
        consultLegTransferAvailable ||
        (inConference &&
          consultInitiator &&
          hasConsultMedia &&
          (isConsulting || consultInProgress || selfConsultingOnParticipantState));
      if (consultLegOnHold) return DISABLED;
      if (hasParallelConsultLeg && !conferenceTransferAvailable) return DISABLED;
      if (!conferenceTransferAvailable && (!inConference || !isConsulting)) return DISABLED;
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

  const taskData = fallbackTaskData ?? context.taskData ?? null;
  const interaction = taskData?.interaction;
  const mainCallId = interaction?.mainInteractionId || taskData?.interactionId;
  const selfAgentId = config.agentId ?? taskData?.agentId;
  const selfParticipant = selfAgentId ? interaction?.participants?.[selfAgentId] : null;
  const hasConsultMedia = hasConsultMediaInInteraction(
    interaction,
    taskData?.consultMediaResourceId
  );
  const isConsultEndedForSelf =
    taskData?.type === 'AgentConsultEnded' ||
    taskData?.type === 'AgentConsultFailed' ||
    (selfParticipant?.consultState === 'consultCompleted' &&
      !hasConsultMedia &&
      taskData?.isConsulted === false);
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
  const selfConsultPendingOnConsultMedia =
    selfParticipant?.consultState === 'consultInitiated' &&
    !taskData?.isConsulted &&
    hasConsultMedia;
  const selfConsultingOnConsultMedia =
    selfParticipant?.consultState === 'consulting' && hasConsultMedia;
  const isConsultUnansweredFailure =
    !taskData?.isConsulted &&
    !hasConsultMedia &&
    selfParticipant?.consultState === 'consultCompleted' &&
    Boolean(mainCallId && taskData?.interaction?.media?.[mainCallId]?.isHold === true) &&
    taskData?.interaction?.state !== 'conference' &&
    !getIsConferenceInProgress(taskData);
  const hasConsultLeg = Boolean(
    !isConsultEndedForSelf &&
      !interaction?.isTerminated &&
      !isConsultUnansweredFailure &&
      (consultOwnedBySelf || selfConsultingOnConsultMedia || selfConsultPendingOnConsultMedia) &&
      (consultInProgress || isConsultingState || context.consultCallHeld || hasConsultMedia)
  );

  if (!hasConsultLeg) {
    let mainState = currentState;
    if (isConsultEndedForSelf && taskData?.interaction) {
      const resolvedMainId = taskData.interaction.mainInteractionId || taskData.interactionId;
      const isMainHeld = Boolean(
        resolvedMainId && taskData.interaction.media?.[resolvedMainId]?.isHold === true
      );

      if (taskData.interaction.state === 'conference' || getIsConferenceInProgress(taskData)) {
        mainState = TaskState.CONFERENCING;
      } else if (isMainHeld || taskData.interaction.state === 'hold') {
        mainState = TaskState.HELD;
      } else {
        mainState = TaskState.CONNECTED;
      }
    }

    return {
      hasConsultLeg: false,
      activeLeg: 'main',
      mainState,
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
