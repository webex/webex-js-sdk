/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {MEETINGS} from '../constants';
import ControlsOptionsUtil from '../controls-options-manager/util';

/**
 * IInMeetingActions
 * Type for In-Meeting Actions
 */
interface IInMeetingActions {
  canInviteNewParticipants?: boolean;
  canAdmitParticipant?: boolean;
  canLock?: boolean;
  canUnlock?: boolean;
  canSetMuteOnEntry?: boolean;
  canUnsetMuteOnEntry?: boolean;
  canSetDisallowUnmute?: boolean;
  canUnsetDisallowUnmute?: boolean;
  canSetMuted?: boolean;
  canUnsetMuted?: boolean;
  canAssignHost?: boolean;
  canSetPresenter?: boolean;
  canUnsetPresenter?: boolean;
  canStartRecording?: boolean;
  canPauseRecording?: boolean;
  canResumeRecording?: boolean;
  isPremiseRecordingEnabled?: boolean;
  canStopRecording?: boolean;
  canRaiseHand?: boolean;
  canLowerAllHands?: boolean;
  canLowerSomeoneElsesHand?: boolean;
  bothLeaveAndEndMeetingAvailable?: boolean;
  canEnableClosedCaption?: boolean;
  canStartTranscribing?: boolean;
  canStopTranscribing?: boolean;
  isClosedCaptionActive?: boolean;
  canStartManualCaption?: boolean;
  canStopManualCaption?: boolean;
  isLocalRecordingStarted?: boolean;
  isLocalRecordingStopped?: boolean;
  isLocalRecordingPaused?: boolean;
  isLocalStreamingStarted?: boolean;
  isLocalStreamingStopped?: boolean;

  isManualCaptionActive?: boolean;
  isSaveTranscriptsEnabled?: boolean;
  isSpokenLanguageAutoDetectionEnabled?: boolean;
  isWebexAssistantActive?: boolean;
  canViewCaptionPanel?: boolean;
  isRealTimeTranslationEnabled?: boolean;
  canSelectSpokenLanguages?: boolean;
  waitingForOthersToJoin?: boolean;
  canSendReactions?: boolean;
  canManageBreakout?: boolean;
  canStartBreakout?: boolean;
  canBroadcastMessageToBreakout?: boolean;
  canAdmitLobbyToBreakout?: boolean;
  isBreakoutPreassignmentsEnabled?: boolean;
  canUserAskForHelp?: boolean;
  canUserRenameSelfAndObserved?: boolean;
  canUserRenameOthers?: boolean;
  canMuteAll?: boolean;
  canUnmuteAll?: boolean;
  canEnableHardMute?: boolean;
  canDisableHardMute?: boolean;
  canEnableMuteOnEntry?: boolean;
  canDisableMuteOnEntry?: boolean;
  canEnableReactions?: boolean;
  canDisableReactions?: boolean;
  canEnableReactionDisplayNames?: boolean;
  canDisableReactionDisplayNames?: boolean;
  canUpdateShareControl?: boolean;
  canEnableViewTheParticipantsList?: boolean;
  canDisableViewTheParticipantsList?: boolean;
  canEnableViewTheParticipantsListPanelist?: boolean;
  canDisableViewTheParticipantsListPanelist?: boolean;
  canEnableShowAttendeeCount?: boolean;
  canDisableShowAttendeeCount?: boolean;
  canEnableRaiseHand?: boolean;
  canDisableRaiseHand?: boolean;
  canEnableVideo?: boolean;
  canDisableVideo?: boolean;
  canShareFile?: boolean;
  canShareApplication?: boolean;
  canShareCamera?: boolean;
  canShareDesktop?: boolean;
  canShareContent?: boolean;
  canTransferFile?: boolean;
  canRealtimeCloseCaption?: boolean;
  canRealtimeCloseCaptionManual?: boolean;
  canChat?: boolean;
  canDoVideo?: boolean;
  canAnnotate?: boolean;
  canUseVoip?: boolean;
  showAutoEndMeetingWarning?: boolean;
  supportHQV?: boolean;
  supportHDV?: boolean;
  canShareWhiteBoard?: boolean;
  enforceVirtualBackground?: boolean;
  canPollingAndQA?: boolean;
  canStartWebcast?: boolean;
  canStopWebcast?: boolean;
  canShowStageView?: boolean;
  canEnableStageView?: boolean;
  canDisableStageView?: boolean;
  isPracticeSessionOn?: boolean;
  isPracticeSessionOff?: boolean;
  canStartPracticeSession?: boolean;
  canStopPracticeSession?: boolean;
  requiresPostMeetingDataConsentPrompt?: boolean;
  canEnableAnnotation?: boolean;
  canDisableAnnotation?: boolean;
  canEnableRemoteDesktopControl?: boolean;
  canDisableRemoteDesktopControl?: boolean;
  canMoveToLobby?: boolean;
  canEnablePollingQA?: boolean;
  canDisablePollingQA?: boolean;
}

/**
 * @class InMeetingActions
 */
export default class InMeetingActions implements IInMeetingActions {
  namespace = MEETINGS;

  canInviteNewParticipants = null;

  canAdmitParticipant = null;

  canLock = null;

  canUnlock = null;

  canAssignHost = null;

  canStartRecording = null;

  canPauseRecording = null;

  canResumeRecording = null;

  isPremiseRecordingEnabled = null;

  canStopRecording = null;

  canSetMuteOnEntry = null;

  canSetPresenter = null;

  canUnsetPresenter = null;

  canUnsetMuteOnEntry = null;

  canSetDisallowUnmute = null;

  canUnsetDisallowUnmute = null;

  canSetMuted = null;

  canUnsetMuted = null;

  canRaiseHand = null;

  canLowerAllHands = null;

  canLowerSomeoneElsesHand = null;

  bothLeaveAndEndMeetingAvailable = null;

  canEnableClosedCaption = null;

  canStartTranscribing = null;

  canStopTranscribing = null;

  isClosedCaptionActive = null;

  canStartManualCaption = null;

  canStopManualCaption = null;

  isLocalRecordingStopped = null;

  isLocalRecordingStarted = null;

  isLocalRecordingPaused = null;

  isManualCaptionActive = null;

  isLocalStreamingStarted = null;

  isLocalStreamingStopped = null;

  isSaveTranscriptsEnabled = null;

  isSpokenLanguageAutoDetectionEnabled = null;

  isWebexAssistantActive = null;

  canViewCaptionPanel = null;

  isRealTimeTranslationEnabled = null;

  canSelectSpokenLanguages = null;

  waitingForOthersToJoin = null;

  canSendReactions = null;

  canManageBreakout = null;

  canStartBreakout = null;

  canBroadcastMessageToBreakout = null;

  canAdmitLobbyToBreakout = null;

  isBreakoutPreassignmentsEnabled = null;

  canUserAskForHelp = null;

  canUserRenameSelfAndObserved = null;

  canUserRenameOthers = null;

  canMuteAll = null;

  canUnmuteAll = null;

  canEnableHardMute = null;

  canDisableHardMute = null;

  canEnableMuteOnEntry = null;

  canDisableMuteOnEntry = null;

  canEnableReactions = null;

  canDisableReactions = null;

  canEnableReactionDisplayNames = null;

  canDisableReactionDisplayNames = null;

  canUpdateShareControl = null;

  canEnableViewTheParticipantsList = null;

  canDisableViewTheParticipantsList = null;

  canEnableViewTheParticipantsListPanelist = null;

  canDisableViewTheParticipantsListPanelist = null;

  canEnableShowAttendeeCount = null;

  canDisableShowAttendeeCount = null;

  canEnableRaiseHand = null;

  canDisableRaiseHand = null;

  canEnableVideo = null;

  canDisableVideo = null;

  canShareFile = null;

  canShareApplication = null;

  canShareCamera = null;

  canShareDesktop = null;

  canShareContent = null;

  canTransferFile = null;

  canRealtimeCloseCaption = null;

  canRealtimeCloseCaptionManual = null;

  canChat = null;

  canDoVideo = null;

  canAnnotate = null;

  canUseVoip = null;

  showAutoEndMeetingWarning = null;

  supportHQV = null;

  enforceVirtualBackground = null;

  supportHDV = null;

  canShareWhiteBoard = null;

  canPollingAndQA = null;

  canStartWebcast = null;

  canStopWebcast = null;

  canShowStageView = null;

  canEnableStageView = null;

  canDisableStageView = null;

  isPracticeSessionOn = null;

  isPracticeSessionOff = null;

  canStartPracticeSession = null;

  canStopPracticeSession = null;

  requiresPostMeetingDataConsentPrompt = null;

  canEnableAnnotation = null;

  canDisableAnnotation = null;

  canEnableRemoteDesktopControl = null;

  canDisableRemoteDesktopControl = null;

  canMoveToLobby = null;

  canEnablePollingQA = null;

  canDisablePollingQA = null;

  /**
   * Returns all meeting action options
   * @returns {Object}
   */
  get = (): IInMeetingActions => ({
    canInviteNewParticipants: this.canInviteNewParticipants,
    canAdmitParticipant: this.canAdmitParticipant,
    canLock: this.canLock,
    canUnlock: this.canUnlock,
    canAssignHost: this.canAssignHost,
    canSetMuteOnEntry: this.canSetMuteOnEntry,
    canUnsetMuteOnEntry: this.canUnsetMuteOnEntry,
    canSetDisallowUnmute: this.canSetDisallowUnmute,
    canSetMuted: this.canSetMuted,
    canUnsetMuted: this.canUnsetMuted,
    canSetPresenter: this.canSetPresenter,
    canUnsetPresenter: this.canUnsetPresenter,
    canUnsetDisallowUnmute: this.canUnsetDisallowUnmute,
    canStartRecording: this.canStartRecording,
    canPauseRecording: this.canPauseRecording,
    canResumeRecording: this.canResumeRecording,
    canStopRecording: this.canStopRecording,
    isPremiseRecordingEnabled: this.isPremiseRecordingEnabled,
    canRaiseHand: this.canRaiseHand,
    canLowerAllHands: this.canLowerAllHands,
    canLowerSomeoneElsesHand: this.canLowerSomeoneElsesHand,
    bothLeaveAndEndMeetingAvailable: this.bothLeaveAndEndMeetingAvailable,
    canEnableClosedCaption: this.canEnableClosedCaption,
    canStartTranscribing: this.canStartTranscribing,
    canStopTranscribing: this.canStopTranscribing,
    isClosedCaptionActive: this.isClosedCaptionActive,
    canStartManualCaption: this.canStartManualCaption,
    isLocalRecordingStarted: this.isLocalRecordingStarted,
    isLocalRecordingStopped: this.isLocalRecordingStopped,
    isLocalRecordingPaused: this.isLocalRecordingPaused,
    isLocalStreamingStarted: this.isLocalStreamingStarted,
    isLocalStreamingStopped: this.isLocalStreamingStopped,
    canStopManualCaption: this.canStopManualCaption,
    isManualCaptionActive: this.isManualCaptionActive,
    isSaveTranscriptsEnabled: this.isSaveTranscriptsEnabled,
    isSpokenLanguageAutoDetectionEnabled: this.isSpokenLanguageAutoDetectionEnabled,
    isWebexAssistantActive: this.isWebexAssistantActive,
    canViewCaptionPanel: this.canViewCaptionPanel,
    isRealTimeTranslationEnabled: this.isRealTimeTranslationEnabled,
    canSelectSpokenLanguages: this.canSelectSpokenLanguages,
    waitingForOthersToJoin: this.waitingForOthersToJoin,
    canSendReactions: this.canSendReactions,
    canManageBreakout: this.canManageBreakout,
    canStartBreakout: this.canStartBreakout,
    canBroadcastMessageToBreakout: this.canBroadcastMessageToBreakout,
    canAdmitLobbyToBreakout: this.canAdmitLobbyToBreakout,
    isBreakoutPreassignmentsEnabled: this.isBreakoutPreassignmentsEnabled,
    canUserAskForHelp: this.canUserAskForHelp,
    canUserRenameSelfAndObserved: this.canUserRenameSelfAndObserved,
    canUserRenameOthers: this.canUserRenameOthers,
    canMuteAll: this.canMuteAll,
    canUnmuteAll: this.canUnmuteAll,
    canEnableHardMute: this.canEnableHardMute,
    canDisableHardMute: this.canDisableHardMute,
    canEnableMuteOnEntry: this.canEnableMuteOnEntry,
    canDisableMuteOnEntry: this.canDisableMuteOnEntry,
    canEnableReactions: this.canEnableReactions,
    canDisableReactions: this.canDisableReactions,
    canEnableReactionDisplayNames: this.canEnableReactionDisplayNames,
    canDisableReactionDisplayNames: this.canDisableReactionDisplayNames,
    canUpdateShareControl: this.canUpdateShareControl,
    canEnableViewTheParticipantsList: this.canEnableViewTheParticipantsList,
    canDisableViewTheParticipantsList: this.canDisableViewTheParticipantsList,
    canEnableViewTheParticipantsListPanelist: this.canEnableViewTheParticipantsListPanelist,
    canDisableViewTheParticipantsListPanelist: this.canDisableViewTheParticipantsListPanelist,
    canEnableShowAttendeeCount: this.canEnableShowAttendeeCount,
    canDisableShowAttendeeCount: this.canDisableShowAttendeeCount,
    canEnableRaiseHand: this.canEnableRaiseHand,
    canDisableRaiseHand: this.canDisableRaiseHand,
    canEnableVideo: this.canEnableVideo,
    canDisableVideo: this.canDisableVideo,
    canShareFile: this.canShareFile,
    canShareApplication: this.canShareApplication,
    canShareCamera: this.canShareCamera,
    showAutoEndMeetingWarning: this.showAutoEndMeetingWarning,
    canShareDesktop: this.canShareDesktop,
    canShareContent: this.canShareContent,
    canTransferFile: this.canTransferFile,
    canRealtimeCloseCaption: this.canRealtimeCloseCaption,
    canRealtimeCloseCaptionManual: this.canRealtimeCloseCaptionManual,
    canChat: this.canChat,
    canDoVideo: this.canDoVideo,
    canAnnotate: this.canAnnotate,
    canUseVoip: this.canUseVoip,
    enforceVirtualBackground: this.enforceVirtualBackground,
    supportHQV: this.supportHQV,
    supportHDV: this.supportHDV,
    canShareWhiteBoard: this.canShareWhiteBoard,
    canPollingAndQA: this.canPollingAndQA,
    canStartWebcast: this.canStartWebcast,
    canStopWebcast: this.canStopWebcast,
    canShowStageView: this.canShowStageView,
    canEnableStageView: this.canEnableStageView,
    canDisableStageView: this.canDisableStageView,
    isPracticeSessionOn: this.isPracticeSessionOn,
    isPracticeSessionOff: this.isPracticeSessionOff,
    canStartPracticeSession: this.canStartPracticeSession,
    canStopPracticeSession: this.canStopPracticeSession,
    requiresPostMeetingDataConsentPrompt: this.requiresPostMeetingDataConsentPrompt,
    canEnableAnnotation: this.canEnableAnnotation,
    canDisableAnnotation: this.canDisableAnnotation,
    canEnableRemoteDesktopControl: this.canEnableRemoteDesktopControl,
    canDisableRemoteDesktopControl: this.canDisableRemoteDesktopControl,
    canMoveToLobby: this.canMoveToLobby,
    canEnablePollingQA: this.canEnablePollingQA,
    canDisablePollingQA: this.canDisablePollingQA,
  });

  /**
   *
   * @param actions
   * @returns
   */

  set = (actions: Partial<IInMeetingActions>) => {
    const old = this.get();

    let changed = false;

    Object.keys(old).forEach((actionKey) => {
      const actionValue = actions[actionKey];

      if (actionValue !== undefined && actionValue !== old[actionKey]) {
        changed = true;
        this[actionKey] = actionValue;
      }
    });

    return changed;
  };
}
