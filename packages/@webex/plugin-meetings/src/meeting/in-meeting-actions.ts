/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {MEETINGS} from '../constants';

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
  canStopRecording?: boolean;
  canRaiseHand?: boolean;
  canLowerAllHands?: boolean;
  canLowerSomeoneElsesHand?: boolean;
  bothLeaveAndEndMeetingAvailable?: boolean;
  canEnableClosedCaption?: boolean;
  canStartTranscribing?: boolean;
  canStopTranscribing?: boolean;
  isClosedCaptionActive?: boolean;
  isSaveTranscriptsEnabled?: boolean;
  isWebexAssistantActive?: boolean;
  canViewCaptionPanel?: boolean;
  isRealTimeTranslationEnabled?: boolean;
  canSelectSpokenLanguages?: boolean;
  waitingForOthersToJoin?: boolean;
  canSendReactions?: boolean;
  canManageBreakout?: boolean;
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
  canAnnotate?: boolean;
  canShareWhiteBoard?: boolean;
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

  isSaveTranscriptsEnabled = null;

  isWebexAssistantActive = null;

  canViewCaptionPanel = null;

  isRealTimeTranslationEnabled = null;

  canSelectSpokenLanguages = null;

  waitingForOthersToJoin = null;

  canSendReactions = null;

  canManageBreakout = null;

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

  canAnnotate = null;

  canShareWhiteBoard = null;

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
    canRaiseHand: this.canRaiseHand,
    canLowerAllHands: this.canLowerAllHands,
    canLowerSomeoneElsesHand: this.canLowerSomeoneElsesHand,
    bothLeaveAndEndMeetingAvailable: this.bothLeaveAndEndMeetingAvailable,
    canEnableClosedCaption: this.canEnableClosedCaption,
    canStartTranscribing: this.canStartTranscribing,
    canStopTranscribing: this.canStopTranscribing,
    isClosedCaptionActive: this.isClosedCaptionActive,
    isSaveTranscriptsEnabled: this.isSaveTranscriptsEnabled,
    isWebexAssistantActive: this.isWebexAssistantActive,
    canViewCaptionPanel: this.canViewCaptionPanel,
    isRealTimeTranslationEnabled: this.isRealTimeTranslationEnabled,
    canSelectSpokenLanguages: this.canSelectSpokenLanguages,
    waitingForOthersToJoin: this.waitingForOthersToJoin,
    canSendReactions: this.canSendReactions,
    canManageBreakout: this.canManageBreakout,
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
    canEnableRaiseHand: this.canEnableRaiseHand,
    canDisableRaiseHand: this.canDisableRaiseHand,
    canEnableVideo: this.canEnableVideo,
    canDisableVideo: this.canDisableVideo,
    canShareFile: this.canShareFile,
    canShareApplication: this.canShareApplication,
    canShareCamera: this.canShareCamera,
    canShareDesktop: this.canShareDesktop,
    canShareContent: this.canShareContent,
    canTransferFile: this.canTransferFile,
    canAnnotate: this.canAnnotate,
    canShareWhiteBoard: this.canShareWhiteBoard,
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
