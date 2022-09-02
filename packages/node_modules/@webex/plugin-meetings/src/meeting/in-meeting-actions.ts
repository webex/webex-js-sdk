/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {
  MEETINGS
} from '../constants';

/**
 * @class InMeetingActions
 */
export default class InMeetingActions {
  namespace = MEETINGS;

  canInviteNewParticipants: boolean = null;
  canAdmitParticipant: boolean  = null;
  canLock: boolean = null;
  canUnlock: boolean = null;
  canAssignHost: boolean = null;
  canStartRecording: boolean = null;
  canPauseRecording: boolean = null;
  canResumeRecording: boolean = null;
  canStopRecording: boolean = null;
  canRaiseHand: boolean = null;
  canLowerAllHands: boolean = null;
  canLowerSomeoneElsesHand: boolean = null;

  get() {
    return {
      canInviteNewParticipants: this.canInviteNewParticipants,
      canAdmitParticipant: this.canAdmitParticipant,
      canLock: this.canLock,
      canUnlock: this.canUnlock,
      canAssignHost: this.canAssignHost,
      canStartRecording: this.canStartRecording,
      canPauseRecording: this.canPauseRecording,
      canResumeRecording: this.canResumeRecording,
      canStopRecording: this.canStopRecording,
      canRaiseHand: this.canRaiseHand,
      canLowerAllHands: this.canLowerAllHands,
      canLowerSomeoneElsesHand: this.canLowerSomeoneElsesHand,
    };
  }

  set(actions) {
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
  }
}
