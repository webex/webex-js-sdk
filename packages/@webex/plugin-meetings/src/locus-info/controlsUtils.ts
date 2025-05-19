import {isEqual} from 'lodash';
import {BREAKOUTS, MEETING_STATE} from '../constants';

const ControlsUtils: any = {};

/**
 * Controls
 * @typedef {Object} LocusControls
 * @property {Object} record
 * @property {Boolean} record.recording
 * @property {Object} record.meta
 * @property {String} record.meta.modifiedBy
 */

/**
 * parse the relevant host values that we care about: id
 * @param {LocusControls} controls
 * @returns {Object} parsedObject - parsed host or null if host was undefined
 * @returns {String} parsedObject.recordingId
 */
ControlsUtils.parse = (controls: any) => {
  const parsedControls = {...controls};

  if (controls && controls.record) {
    parsedControls.record = {
      modifiedBy: ControlsUtils.getId(controls),
      paused: controls.record.paused ? controls.record.paused : false,
      recording: controls.record.recording,
      lastModified: controls.record.meta.lastModified,
    };
  }

  if (controls && controls.meetingContainer) {
    parsedControls.meetingContainer = {
      meetingContainerUrl: controls.meetingContainer.meetingContainerUrl,
    };
  }

  if (controls && controls.transcribe) {
    parsedControls.transcribe = {
      transcribing: controls.transcribe.transcribing,
      caption: controls.transcribe.caption,
    };
  }

  if (controls && controls.manualCaptionControl) {
    parsedControls.manualCaptionControl = {
      enabled: controls.manualCaptionControl.enabled,
    };
  }

  if (controls && controls.entryExitTone) {
    parsedControls.entryExitTone = controls.entryExitTone.enabled
      ? controls.entryExitTone.mode
      : null;
  }

  if (controls && controls.video) {
    parsedControls.videoEnabled = controls.video.enabled;
  }

  if (controls?.muteOnEntry) {
    parsedControls.muteOnEntry = {enabled: controls.muteOnEntry.enabled};
  }

  if (controls?.shareControl) {
    parsedControls.shareControl = {control: controls.shareControl.control};
  }

  if (controls?.disallowUnmute) {
    parsedControls.disallowUnmute = {enabled: controls.disallowUnmute.enabled};
  }

  if (controls?.reactions) {
    parsedControls.reactions = {
      enabled: controls.reactions.enabled,
      showDisplayNameWithReactions: controls.reactions.showDisplayNameWithReactions,
    };
  }

  if (controls?.viewTheParticipantList) {
    parsedControls.viewTheParticipantList = {
      enabled: controls.viewTheParticipantList?.enabled ?? false,
      panelistEnabled: controls.viewTheParticipantList?.panelistEnabled ?? false,
      attendeeCount: controls.viewTheParticipantList?.attendeeCount ?? 0,
    };
  }

  if (controls?.raiseHand) {
    parsedControls.raiseHand = {enabled: controls.raiseHand.enabled};
  }

  if (controls?.video) {
    parsedControls.video = {enabled: controls.video.enabled};
  }

  if (controls?.webcastControl) {
    parsedControls.webcastControl = {streaming: controls.webcastControl.streaming};
  }

  if (controls?.meetingFull) {
    parsedControls.meetingFull = {
      meetingFull: controls.meetingFull?.meetingFull ?? false,
      meetingPanelistFull: controls.meetingFull?.meetingPanelistFull ?? false,
    };
  }

  if (controls?.practiceSession) {
    parsedControls.practiceSession = {
      enabled: controls.practiceSession.enabled,
    };
  }

  if (controls?.annotationControl) {
    parsedControls.annotationControl = {
      enabled: controls.annotationControl.enabled,
    };
  }

  if (controls?.rdcControl) {
    parsedControls.rdcControl = {
      enabled: controls.rdcControl.enabled,
    };
  }

  return parsedControls;
};

/**
 * parses and returns previous state vs current state and triggers the changes.
 * @param {LocusControls} oldControls previous state
 * @param {LocusControls} newControls current state
 * @returns {Object} combination of state plus the changes
 */
ControlsUtils.getControls = (oldControls: any, newControls: any) => {
  const previous = ControlsUtils.parse(oldControls);
  const current = ControlsUtils.parse(newControls);

  return {
    previous,
    current,
    updates: {
      hasMuteOnEntryChanged: current?.muteOnEntry?.enabled !== previous?.muteOnEntry?.enabled,

      hasShareControlChanged: current?.shareControl?.control !== previous?.shareControl?.control,

      hasDisallowUnmuteChanged:
        current?.disallowUnmute?.enabled !== previous?.disallowUnmute?.enabled,

      hasReactionsChanged: current?.reactions?.enabled !== previous?.reactions?.enabled,

      hasReactionDisplayNamesChanged:
        current?.reactions?.showDisplayNameWithReactions !==
        previous?.reactions?.showDisplayNameWithReactions,

      hasViewTheParticipantListChanged:
        current?.viewTheParticipantList?.enabled !== previous?.viewTheParticipantList?.enabled ||
        current?.viewTheParticipantList?.panelistEnabled !==
          previous?.viewTheParticipantList?.panelistEnabled ||
        current?.viewTheParticipantList?.attendeeCount !==
          previous?.viewTheParticipantList?.attendeeCount,

      hasRaiseHandChanged: current?.raiseHand?.enabled !== previous?.raiseHand?.enabled,

      hasVideoChanged: current?.video?.enabled !== previous?.video?.enabled,

      hasRecordingPausedChanged:
        current?.record &&
        !isEqual(previous?.record?.paused, current.record.paused) &&
        (previous?.record?.recording || current?.record?.recording), // see comments directly below

      hasRecordingChanged:
        current?.record &&
        !isEqual(previous?.record?.recording, current?.record?.recording) && // upon first join, previous?.record?.recording = undefined; thus, never going to be equal and will always return true
        (previous?.record?.recording || current?.record?.recording), // therefore, condition added to prevent false firings of #meeting:recording:stopped upon first joining a meeting

      hasMeetingContainerChanged:
        current?.meetingContainer &&
        !isEqual(
          previous?.meetingContainer?.meetingContainerUrl,
          current?.meetingContainer?.meetingContainerUrl
        ),

      hasTranscribeChanged:
        current?.transcribe &&
        !isEqual(previous?.transcribe?.transcribing, current?.transcribe?.transcribing) && // upon first join, previous?.record?.recording = undefined; thus, never going to be equal and will always return true
        (previous?.transcribe?.transcribing || current?.transcribe?.transcribing), // therefore, condition added to prevent false firings of #meeting:recording:stopped upon first joining a meeting

      hasManualCaptionChanged:
        current?.manualCaptionControl &&
        !isEqual(previous?.manualCaptionControl?.enabled, current?.manualCaptionControl?.enabled) &&
        (previous?.manualCaptionControl?.enabled || current?.manualCaptionControl?.enabled),

      hasEntryExitToneChanged: !!(
        newControls.entryExitTone &&
        !isEqual(previous?.entryExitTone, current?.entryExitTone) &&
        (previous?.entryExitTone || current?.entryExitTone)
      ),

      hasBreakoutChanged: !isEqual(previous?.breakout, current?.breakout),

      hasInterpretationChanged: !isEqual(previous?.interpretation, current?.interpretation),

      hasVideoEnabledChanged:
        newControls.video?.enabled !== undefined &&
        !isEqual(previous?.videoEnabled, current?.videoEnabled),

      hasWebcastChanged: !isEqual(
        previous?.webcastControl?.streaming,
        current?.webcastControl?.streaming
      ),

      hasMeetingFullChanged:
        !isEqual(previous?.meetingFull?.meetingFull, current?.meetingFull?.meetingFull) ||
        !isEqual(
          previous?.meetingFull?.meetingPanelistFull,
          current?.meetingFull?.meetingPanelistFull
        ),

      hasPracticeSessionEnabledChanged: !isEqual(
        !!previous?.practiceSession?.enabled,
        !!current?.practiceSession?.enabled
      ),

      hasStageViewChanged: !isEqual(previous?.videoLayout, current?.videoLayout),

      hasAnnotationControlChanged:
        current?.annotationControl?.enabled !== previous?.annotationControl?.enabled,

      hasRemoteDesktopControlChanged:
        current?.rdcControl?.enabled !== previous?.rdcControl?.enabled,
    },
  };
};

/**
 * Extract the id from the record controls object
 * @param {LocusControls} controls
 * @returns {String|null}
 */
ControlsUtils.getId = (controls: any) => {
  if (controls.record.meta) {
    return controls.record.meta.modifiedBy;
  }

  return null;
};

/**
 * check whether to replace the meeting's members or not.
 * For case joined breakout session, need replace meeting's members
 * @param {LocusControls} oldControls
 * @param {LocusControls} controls
 * @returns {Boolean}
 */
ControlsUtils.isNeedReplaceMembers = (oldControls: any, controls: any) => {
  // no breakout case
  if (!oldControls?.breakout || !controls?.breakout) {
    return false;
  }

  return (
    oldControls?.breakout?.groupId !== controls?.breakout?.groupId ||
    oldControls?.breakout?.sessionId !== controls?.breakout?.sessionId
  );
};

/**
 * determine the switch status between breakout session and main session.
 * @param {LocusInfo} oldLocus
 * @param {LocusInfo} newLocus
 * @returns {Object}
 */
ControlsUtils.getSessionSwitchStatus = (oldLocus: any, newLocus: any) => {
  const status = {isReturnToMain: false, isJoinToBreakout: false};
  // no breakout case
  if (!oldLocus.controls?.breakout || !newLocus.controls?.breakout) {
    return status;
  }

  // It is used to fix the timing issue triggered when the creator leaves session to ensure that the member list is complete
  const needUseCache = !!(
    oldLocus.self?.isCreator &&
    newLocus.participants?.length === 1 &&
    newLocus.participants?.[0].isCreator &&
    newLocus.participants?.[0].state === MEETING_STATE.STATES.JOINED &&
    newLocus.controls?.breakout?.sessionType === BREAKOUTS.SESSION_TYPES.MAIN &&
    newLocus.controls?.breakout?.groups?.length
  );

  const isReturnToMain =
    oldLocus.controls.breakout.sessionType === BREAKOUTS.SESSION_TYPES.BREAKOUT &&
    newLocus.controls.breakout.sessionType === BREAKOUTS.SESSION_TYPES.MAIN;

  status.isReturnToMain = needUseCache || isReturnToMain;
  status.isJoinToBreakout =
    oldLocus.controls.breakout.sessionType === BREAKOUTS.SESSION_TYPES.MAIN &&
    newLocus.controls.breakout.sessionType === BREAKOUTS.SESSION_TYPES.BREAKOUT;

  return status;
};

ControlsUtils.isMainSessionDTO = (locus: any) => {
  return locus?.controls?.breakout?.sessionType !== BREAKOUTS.SESSION_TYPES.BREAKOUT;
};

export default ControlsUtils;
