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
  canEnableReactions?: boolean;
  canSendReactions?: boolean;
  canManageBreakout?: boolean;
  canAdmitLobbyToBreakout?: boolean;
  isBreakoutPreassignmentsEnabled?: boolean;
  canUserAskForHelp?: boolean;
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

  canEnableReactions = null;

  canSendReactions = null;

  canManageBreakout = null;

  canAdmitLobbyToBreakout = null;

  isBreakoutPreassignmentsEnabled = null;

  canUserAskForHelp = null;

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
    canEnableReactions: this.canEnableReactions,
    canSendReactions: this.canSendReactions,
    canManageBreakout: this.canManageBreakout,
    canAdmitLobbyToBreakout: this.canAdmitLobbyToBreakout,
    isBreakoutPreassignmentsEnabled: this.isBreakoutPreassignmentsEnabled,
    canUserAskForHelp: this.canUserAskForHelp,
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
