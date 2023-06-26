// eslint-disable-next-line import/prefer-default-export
import {ClientEvent, NewMetrics} from '@webex/internal-plugin-metrics';

const breakoutEvent: {
  onBreakoutMoveRequest: (eventInfo: any) => void;
  onBreakoutMoveResponse: (eventInfo: any) => void;
  onBreakoutJoinResponse: (eventInfo: any) => void;
  postMoveCallAnalyzer: (event: ClientEvent['name'], eventInfo: any) => void;
} = {
  onBreakoutMoveRequest: (eventInfo) => {
    breakoutEvent.postMoveCallAnalyzer('client.breakout-session.move.request', eventInfo);
  },
  onBreakoutMoveResponse: (eventInfo) => {
    breakoutEvent.postMoveCallAnalyzer('client.breakout-session.move.response', eventInfo);
  },
  onBreakoutJoinResponse: (eventInfo) => {
    breakoutEvent.postMoveCallAnalyzer('client.breakout-session.join.response', eventInfo);
  },
  postMoveCallAnalyzer: (event: ClientEvent['name'], eventInfo: any) => {
    if (!eventInfo?.breakoutMoveId || !eventInfo?.meeting) {
      return;
    }
    if (!eventInfo.meeting.meetingInfo?.enableConvergedArchitecture) {
      return;
    }
    NewMetrics.submitClientEvent({
      name: event,
      payload: {
        identifiers: {
          breakoutMoveId: eventInfo.breakoutMoveId,
          breakoutSessionId: eventInfo?.currentSession?.sessionId,
          breakoutGroupId: eventInfo?.currentSession?.groupId,
        },
      },
      options: {meetingId: eventInfo.meeting.id},
    });
  },
};

export default breakoutEvent;
