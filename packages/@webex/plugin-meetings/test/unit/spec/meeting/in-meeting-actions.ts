import {assert} from '@webex/test-helper-chai';
import InMeetingActions from '@webex/plugin-meetings/src/meeting/in-meeting-actions';

describe('plugin-meetings', () => {
  describe('in-meeting-actions', () => {
    const checkValues = (actions, expected?) => {
      const expectedValues = {
        canInviteNewParticipants: null,
        canAdmitParticipant: null,
        canLock: null,
        canUnlock: null,
        canAssignHost: null,
        canSetPresenter: null,
        canUnsetPresenter: null,
        canStartRecording: null,
        canPauseRecording: null,
        canResumeRecording: null,
        canSetMuteOnEntry: null,
        canUnsetMuteOnEntry: null,
        canSetDisallowUnmute: null,
        canUnsetDisallowUnmute: null,
        canSetMuted: null,
        canUnsetMuted: null,
        canStopRecording: null,
        canRaiseHand: null,
        canLowerAllHands: null,
        canLowerSomeoneElsesHand: null,
        bothLeaveAndEndMeetingAvailable: null,
        canEnableClosedCaption: null,
        canStartTranscribing: null,
        canStopTranscribing: null,
        isClosedCaptionActive: null,
        isSaveTranscriptsEnabled: null,
        isWebexAssistantActive: null,
        canViewCaptionPanel: null,
        isRealTimeTranslationEnabled: null,
        canSelectSpokenLanguages: null,
        waitingForOthersToJoin: null,
        canSendReactions: null,
        canManageBreakout: null,
        canBroadcastMessageToBreakout: null,
        canAdmitLobbyToBreakout: null,
        canUserAskForHelp: null,
        canUserRenameSelfAndObserved: null,
        canUserRenameOthers: null,
        isBreakoutPreassignmentsEnabled: null,
        canMuteAll: null,
        canUnmuteAll: null,
        canEnableHardMute: null,
        canDisableHardMute: null,
        canEnableMuteOnEntry: null,
        canDisableMuteOnEntry: null,
        canEnableReactions: null,
        canDisableReactions: null,
        canEnableReactionDisplayNames: null,
        canDisableReactionDisplayNames: null,
        canUpdateShareControl: null,
        canEnableViewTheParticipantsList: null,
        canDisableViewTheParticipantsList: null,
        canEnableRaiseHand: null,
        canDisableRaiseHand: null,
        canEnableVideo: null,
        canDisableVideo: null,
        canShareFile: null,
        canShareApplication: null,
        canShareCamera: null,
        canShareDesktop: null,
        canShareContent: null,
        canTransferFile: null,
        canAnnotate: null,
        canShareWhiteBoard: null,
        ...expected,
      };

      // Check get retuns all the correct values at once
      assert.deepEqual(actions.get(), expectedValues);

      // Check each value individually
      Object.keys(expectedValues).forEach((key) => {
        assert.deepEqual(actions[key], expectedValues[key]);
      });
    };

    [
      'canInviteNewParticipants',
      'canAdmitParticipant',
      'canLock',
      'canUnlock',
      'canAssignHost',
      'canSetPresenter',
      'canUnsetPresenter',
      'canStartRecording',
      'canPauseRecording',
      'canResumeRecording',
      'canStopRecording',
      'canSetMuteOnEntry',
      'canUnsetMuteOnEntry',
      'canSetDisallowUnmute',
      'canUnsetDisallowUnmute',
      'canRaiseHand',
      'canLowerAllHands',
      'canLowerSomeoneElsesHand',
      'bothLeaveAndEndMeetingAvailable',
      'canEnableClosedCaption',
      'canStopTranscribing',
      'isClosedCaptionActive',
      'isSaveTranscriptsEnabled',
      'isWebexAssistantActive',
      'canViewCaptionPanel',
      'isRealTimeTranslationEnabled',
      'canSelectSpokenLanguages',
      'waitingForOthersToJoin',
      'canSendReactions',
      'canManageBreakout',
      'canBroadcastMessageToBreakout',
      'canAdmitLobbyToBreakout',
      'canUserAskForHelp',
      'canUserRenameSelfAndObserved',
      'canUserRenameOthers',
      'isBreakoutPreassignmentsEnabled',
      'canMuteAll',
      'canUnmuteAll',
      'canEnableHardMute',
      'canDisableHardMute',
      'canEnableMuteOnEntry',
      'canDisableMuteOnEntry',
      'canEnableReactions',
      'canDisableReactions',
      'canEnableReactionDisplayNames',
      'canDisableReactionDisplayNames',
      'canUpdateShareControl',
      'canEnableViewTheParticipantsList',
      'canDisableViewTheParticipantsList',
      'canEnableRaiseHand',
      'canDisableRaiseHand',
      'canEnableVideo',
      'canDisableVideo',
      'canShareFile',
      'canShareApplication',
      'canShareCamera',
      'canShareDesktop',
      'canShareContent',
      'canTransferFile',
      'canAnnotate',
      'canShareWhiteBoard',
    ].forEach((key) => {
      it(`get and set for ${key} work as expected`, () => {
        const inMeetingActions = new InMeetingActions();

        checkValues(inMeetingActions);

        let changed = inMeetingActions.set({[key]: true});

        assert.isTrue(changed);

        checkValues(inMeetingActions, {[key]: true});

        changed = inMeetingActions.set({[key]: true});

        assert.isFalse(changed);
      });
    });
  });
});
