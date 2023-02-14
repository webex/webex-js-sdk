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
        canStartRecording: null,
        canPauseRecording: null,
        canResumeRecording: null,
        canSetMuteOnEntry: null,
        canUnsetMuteOnEntry: null,
        canSetDisallowUnmute: null,
        canUnsetDisallowUnmute: null,
        canStopRecording: null,
        canRaiseHand: null,
        canLowerAllHands: null,
        canLowerSomeoneElsesHand: null,
        bothLeaveAndEndMeetingAvailable: null,
        canEnableClosedCaption: null,
        canStartTranscribing: null,
        canStopTranscribing: null,
        isClosedCaptionActive: null,
        isWebexAssistantActive: null,
        canViewCaptionPanel: null,
        isRealTimeTranslationEnabled: null,
        canSelectSpokenLanguages: null,
        waitingForOthersToJoin: null,
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
      'isWebexAssistantActive',
      'canViewCaptionPanel',
      'isRealTimeTranslationEnabled',
      'canSelectSpokenLanguages',
      'waitingForOthersToJoin',
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
