// eslint-disable-next-line import/prefer-default-export
import CallAnalyzerMetrics from '@webex/internal-plugin-metrics/src/ca-metrics';
import {ClientEvent} from '@webex/internal-plugin-metrics/src/ClientEvent';
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

breakoutEvent.postMoveCallAnalyzer = (event: ClientEvent['name'], eventInfo: any) => {
  if (!eventInfo?.breakoutMoveId || !eventInfo?.meeting) {
    return;
  }
  if (!eventInfo.meeting.meetingInfo?.enableConvergedArchitecture) {
    return;
  }

  CallAnalyzerMetrics.submitClientEvent(
    event,
    {
      identifiers: {
        breakoutMoveId: eventInfo.breakoutMoveId,
        breakoutSessionId: eventInfo.breakoutSessionId,
        breakoutGroupId: eventInfo.breakoutGroupId,
      },
    },
    {meetingId: eventInfo.meeting.id}
  );
};

export default breakoutEvent;
