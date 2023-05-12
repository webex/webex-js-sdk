// eslint-disable-next-line import/prefer-default-export
import Metrics from '../metrics';
import {eventType} from '../metrics/config';

const breakoutEvent: any = {};

breakoutEvent.onBreakoutMoveRequest = (eventInfo) => {
  breakoutEvent.postMoveCallAnalyzer(eventType.BREAKOUT_MOVE_REQUEST, eventInfo);
};

breakoutEvent.onBreakoutMoveResponse = (eventInfo) => {
  breakoutEvent.postMoveCallAnalyzer(eventType.BREAKOUT_MOVE_RESPONSE, eventInfo);
};

breakoutEvent.onBreakoutJoinResponse = (eventInfo) => {
  breakoutEvent.postMoveCallAnalyzer(eventType.BREAKOUT_JOIN_RESPONSE, eventInfo);
};

breakoutEvent.postMoveCallAnalyzer = (events: string, eventInfo: any) => {
  if (!eventInfo?.breakoutMoveId || !eventInfo?.meeting) {
    return;
  }
  if (!eventInfo.meeting.meetingInfo?.enableConvergedArchitecture) {
    return;
  }
  Metrics.postEvent({
    event: events,
    meetingId: eventInfo.meeting.id,
    data: {
      breakoutMoveId: eventInfo.breakoutMoveId,
      breakoutSessionId: eventInfo?.currentSession?.sessionId,
      breakoutGroupId: eventInfo?.currentSession?.groupId,
    },
  });
};

export default breakoutEvent;
