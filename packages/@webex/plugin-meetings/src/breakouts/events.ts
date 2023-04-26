// eslint-disable-next-line import/prefer-default-export
import Metrics from '../metrics';
import {eventType} from '../metrics/config';

const breakoutEvent: any = {};

breakoutEvent.onBreakoutMoveRequest = (
  currentSession: any,
  meeting: any,
  breakoutMoveId: string
) => {
  if (!breakoutMoveId || !meeting) {
    return;
  }
  if (!meeting.meetingInfo?.enableConvergedArchitecture) {
    return;
  }
  Metrics.postEvent({
    event: eventType.BREAKOUT_MOVE_REQUEST,
    meetingId: meeting.id,
    data: {
      breakoutMoveId,
      breakoutSessionId: currentSession.sessionId,
      breakoutGroupId: currentSession.groupId,
    },
  });
};

breakoutEvent.onBreakoutMoveResponse = (
  currentSession: any,
  meeting: any,
  breakoutMoveId: string
) => {
  if (!breakoutMoveId || !meeting) {
    return;
  }
  if (!meeting.meetingInfo?.enableConvergedArchitecture) {
    return;
  }
  Metrics.postEvent({
    event: eventType.BREAKOUT_MOVE_RESPONSE,
    meetingId: meeting.id,
    data: {
      breakoutMoveId,
      breakoutSessionId: currentSession.sessionId,
      breakoutGroupId: currentSession.groupId,
    },
  });
};

breakoutEvent.onBreakoutJoinResponse = (
  currentSession: any,
  meeting: any,
  breakoutMoveId: string
) => {
  if (!breakoutMoveId || !meeting) {
    return;
  }
  if (!meeting.meetingInfo?.enableConvergedArchitecture) {
    return;
  }
  Metrics.postEvent({
    event: eventType.BREAKOUT_JOIN_RESPONSE,
    meetingId: meeting.id,
    data: {
      breakoutMoveId,
      breakoutSessionId: currentSession.sessionId,
      breakoutGroupId: currentSession.groupId,
    },
  });
};

export default breakoutEvent;
