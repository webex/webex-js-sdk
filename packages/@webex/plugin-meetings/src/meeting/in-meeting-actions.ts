/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {MEETINGS} from '../constants';

/**
 * IInMeetingActions
 * Type for In-Meeting Actions
 */
interface IInMeetingActions {
  canInviteNewParticipants?: boolean | null;
  canAdmitParticipant?: boolean | null;
  canLock?: boolean | null;
  canUnlock?: boolean | null;
  canSetMuteOnEntry?: boolean | null;
  canUnsetMuteOnEntry?: boolean | null;
  canSetDisallowUnmute?: boolean | null;
  canUnsetDisallowUnmute?: boolean | null;
  canSetMuted?: boolean | null;
  canUnsetMuted?: boolean | null;
  canAssignHost?: boolean | null;
  canSetPresenter?: boolean | null;
  canUnsetPresenter?: boolean | null;
  canStartRecording?: boolean | null;
  canPauseRecording?: boolean | null;
  canResumeRecording?: boolean | null;
  canStopRecording?: boolean | null;
  canRaiseHand?: boolean | null;
  canLowerAllHands?: boolean | null;
  canLowerSomeoneElsesHand?: boolean | null;
  bothLeaveAndEndMeetingAvailable?: boolean | null;
  canEnableClosedCaption?: boolean | null;
  canStartTranscribing?: boolean | null;
  canStopTranscribing?: boolean | null;
  isClosedCaptionActive?: boolean | null;
  canStartManualCaption?: boolean | null;
  canStopManualCaption?: boolean | null;
  isManualCaptionActive?: boolean | null;
  isSaveTranscriptsEnabled?: boolean | null;
  isWebexAssistantActive?: boolean | null;
  canViewCaptionPanel?: boolean | null;
  isRealTimeTranslationEnabled?: boolean | null;
  canSelectSpokenLanguages?: boolean | null;
  waitingForOthersToJoin?: boolean | null;
  canSendReactions?: boolean | null;
  canManageBreakout?: boolean | null;
  canBroadcastMessageToBreakout?: boolean | null;
  canAdmitLobbyToBreakout?: boolean | null;
  isBreakoutPreassignmentsEnabled?: boolean | null;
  canUserAskForHelp?: boolean | null;
  canUserRenameSelfAndObserved?: boolean | null;
  canUserRenameOthers?: boolean | null;
  canMuteAll?: boolean | null;
  canUnmuteAll?: boolean | null;
  canEnableHardMute?: boolean | null;
  canDisableHardMute?: boolean | null;
  canEnableMuteOnEntry?: boolean | null;
  canDisableMuteOnEntry?: boolean | null;
  canEnableReactions?: boolean | null;
  canDisableReactions?: boolean | null;
  canEnableReactionDisplayNames?: boolean | null;
  canDisableReactionDisplayNames?: boolean | null;
  canUpdateShareControl?: boolean | null;
  canEnableViewTheParticipantsList?: boolean | null;
  canDisableViewTheParticipantsList?: boolean | null;
  canEnableRaiseHand?: boolean | null;
  canDisableRaiseHand?: boolean | null;
  canEnableVideo?: boolean | null;
  canDisableVideo?: boolean | null;
  canShareFile?: boolean | null;
  canShareApplication?: boolean | null;
  canShareCamera?: boolean | null;
  canShareDesktop?: boolean | null;
  canShareContent?: boolean | null;
  canTransferFile?: boolean | null;
  canChat?: boolean | null;
  canDoVideo?: boolean | null;
  canAnnotate?: boolean | null;
  canUseVoip?: boolean | null;
  supportHQV?: boolean | null;
  supportHDV?: boolean | null;
  canShareWhiteBoard?: boolean | null;
  enforceVirtualBackground?: boolean | null;
}

/**
 * @class InMeetingActions
 */
export default class InMeetingActions implements IInMeetingActions {
  namespace = MEETINGS;

  canInviteNewParticipants: boolean | null = null;

  canAdmitParticipant: boolean | null = null;

  canLock: boolean | null = null;

  canUnlock: boolean | null = null;

  canAssignHost: boolean | null = null;

  canStartRecording: boolean | null = null;

  canPauseRecording: boolean | null = null;

  canResumeRecording: boolean | null = null;

  canStopRecording: boolean | null = null;

  canSetMuteOnEntry: boolean | null = null;

  canSetPresenter: boolean | null = null;

  canUnsetPresenter: boolean | null = null;

  canUnsetMuteOnEntry: boolean | null = null;

  canSetDisallowUnmute: boolean | null = null;

  canUnsetDisallowUnmute: boolean | null = null;

  canSetMuted: boolean | null = null;

  canUnsetMuted: boolean | null = null;

  canRaiseHand: boolean | null = null;

  canLowerAllHands: boolean | null = null;

  canLowerSomeoneElsesHand: boolean | null = null;

  bothLeaveAndEndMeetingAvailable: boolean | null = null;

  canEnableClosedCaption: boolean | null = null;

  canStartTranscribing: boolean | null = null;

  canStopTranscribing: boolean | null = null;

  isClosedCaptionActive: boolean | null = null;

  canStartManualCaption: boolean | null = null;

  canStopManualCaption: boolean | null = null;

  isManualCaptionActive: boolean | null = null;

  isSaveTranscriptsEnabled: boolean | null = null;

  isWebexAssistantActive: boolean | null = null;

  canViewCaptionPanel: boolean | null = null;

  isRealTimeTranslationEnabled: boolean | null = null;

  canSelectSpokenLanguages: boolean | null = null;

  waitingForOthersToJoin: boolean | null = null;

  canSendReactions: boolean | null = null;

  canManageBreakout: boolean | null = null;

  canBroadcastMessageToBreakout: boolean | null = null;

  canAdmitLobbyToBreakout: boolean | null = null;

  isBreakoutPreassignmentsEnabled: boolean | null = null;

  canUserAskForHelp: boolean | null = null;

  canUserRenameSelfAndObserved: boolean | null = null;

  canUserRenameOthers: boolean | null = null;

  canMuteAll: boolean | null = null;

  canUnmuteAll: boolean | null = null;

  canEnableHardMute: boolean | null = null;

  canDisableHardMute: boolean | null = null;

  canEnableMuteOnEntry: boolean | null = null;

  canDisableMuteOnEntry: boolean | null = null;

  canEnableReactions: boolean | null = null;

  canDisableReactions: boolean | null = null;

  canEnableReactionDisplayNames: boolean | null = null;

  canDisableReactionDisplayNames: boolean | null = null;

  canUpdateShareControl: boolean | null = null;

  canEnableViewTheParticipantsList: boolean | null = null;

  canDisableViewTheParticipantsList: boolean | null = null;

  canEnableRaiseHand: boolean | null = null;

  canDisableRaiseHand: boolean | null = null;

  canEnableVideo: boolean | null = null;

  canDisableVideo: boolean | null = null;

  canShareFile: boolean | null = null;

  canShareApplication: boolean | null = null;

  canShareCamera: boolean | null = null;

  canShareDesktop: boolean | null = null;

  canShareContent: boolean | null = null;

  canTransferFile: boolean | null = null;

  canChat: boolean | null = null;

  canDoVideo: boolean | null = null;

  canAnnotate: boolean | null = null;

  canUseVoip: boolean | null = null;

  supportHQV: boolean | null = null;

  enforceVirtualBackground: boolean | null = null;

  supportHDV: boolean | null = null;

  canShareWhiteBoard: boolean | null = null;

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
    canStartManualCaption: this.canStartManualCaption,
    canStopManualCaption: this.canStopManualCaption,
    isManualCaptionActive: this.isManualCaptionActive,
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
    canChat: this.canChat,
    canDoVideo: this.canDoVideo,
    canAnnotate: this.canAnnotate,
    canUseVoip: this.canUseVoip,
    enforceVirtualBackground: this.enforceVirtualBackground,
    supportHQV: this.supportHQV,
    supportHDV: this.supportHDV,
    canShareWhiteBoard: this.canShareWhiteBoard,
  });

  /**
   *
   * @param actions
   * @returns
   */

  set = (actions: Partial<IInMeetingActions>) => {
    const old: IInMeetingActions = this.get();

    let changed = false;

    Object.keys(old).forEach((actionKey) => {
      const key = actionKey as keyof IInMeetingActions;
      const actionValue = actions[key];

      if (actionValue !== undefined && actionValue !== old[key]) {
        changed = true;
        this[key] = actionValue;
      }
    });

    return changed;
  };
}
