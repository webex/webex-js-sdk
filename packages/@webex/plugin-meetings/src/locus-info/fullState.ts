import {FULL_STATE} from '../constants';

const FullState: any = {};

FullState.parse = (fullState: Record<string, any>) => ({
  type: fullState.type || FULL_STATE.UNKNOWN,
  meetingState: fullState.state,
  locked: fullState.locked,
});

FullState.getFullState = (oldFullState: unknown, newFullState: unknown) => {
  const previous = oldFullState && FullState.parse(oldFullState);
  const current = newFullState && FullState.parse(newFullState);

  return {
    previous,
    current,
    updates: {
      isMeetingEnded: FullState.isMeetingEnded(previous, current),
      isMeetingTerminating: FullState.isMeetingTerminating(previous, current),
      meetingTypeChangedTo: FullState.isTypeChanged(previous, current),
      meetingStateChangedTo: FullState.meetingStateChange(previous, current),
    },
  };
};

FullState.isMeetingEnded = (previous: Record<string, any>, current: Record<string, any>) => {
  if (
    current.state === FULL_STATE.INACTIVE &&
    previous &&
    (previous.state === FULL_STATE.ACTIVE ||
      previous.state === FULL_STATE.INITIALIZING ||
      previous.state === FULL_STATE.TERMINATING)
  ) {
    return true;
  }

  return false;
};

FullState.isMeetingTerminating = (previous: Record<string, any>, current: Record<string, any>) => {
  if (
    current.state === FULL_STATE.TERMINATING &&
    previous &&
    (previous.state === FULL_STATE.ACTIVE || previous.state === FULL_STATE.INITIALIZING)
  ) {
    return true;
  }

  return false;
};

FullState.isTypeChanged = (previous: Record<string, any>, current: Record<string, any>) => {
  if (!previous || current.type !== previous.type) {
    return current && current.type;
  }

  return null;
};

FullState.meetingStateChange = (previous: Record<string, any>, current: Record<string, any>) => {
  if (!previous || current.meetingState !== previous.meetingState) {
    return current && current.meetingState;
  }

  return null;
};

export default FullState;
