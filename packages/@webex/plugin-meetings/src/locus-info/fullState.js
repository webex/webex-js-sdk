import {FULL_STATE} from '../constants';

const FullState = {};

FullState.parse = (fullState) => ({
  type: fullState.type || FULL_STATE.UNKNOWN,
  meetingState: fullState.state,
  locked: fullState.locked
});


FullState.getFullState = (oldFullState, newFullState) => {
  const previous = oldFullState && FullState.parse(oldFullState);
  const current = newFullState && FullState.parse(newFullState);

  return {
    previous,
    current,
    updates: {
      isMeetingEnded: FullState.isMeetingEnded(previous, current),
      isMeetingTerminating: FullState.isMeetingTerminating(previous, current),
      meetingTypeChangedTo: FullState.isTypeChanged(previous, current),
      meetingStateChangedTo: FullState.meetingStateChange(previous, current)
    }
  };
};

FullState.isMeetingEnded = (previous, current) => {
  if (current.state === FULL_STATE.INACTIVE && previous &&
   (previous.state === FULL_STATE.ACTIVE ||
    previous.state === FULL_STATE.INITIALIZING ||
    previous.state === FULL_STATE.TERMINATING)) {
    return true;
  }

  return false;
};

FullState.isMeetingTerminating = (previous, current) => {
  if (current.state === FULL_STATE.TERMINATING && previous &&
  (previous.state === FULL_STATE.ACTIVE ||
    previous.state === FULL_STATE.INITIALIZING)) {
    return true;
  }

  return false;
};

FullState.isTypeChanged = (previous, current) => {
  if (!previous || current.type !== previous.type) {
    return current && current.type;
  }

  return null;
};

FullState.meetingStateChange = (previous, current) => {
  if (!previous || current.meetingState !== previous.meetingState) {
    return current && current.meetingState;
  }

  return null;
};

export default FullState;
