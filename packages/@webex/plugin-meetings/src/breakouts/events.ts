import {ClientEvent} from '@webex/internal-plugin-metrics';

const breakoutEvent: {
  onBreakoutMoveRequest: (eventInfo: unknown, submitClientEvent: unknown) => void;
  onBreakoutMoveResponse: (eventInfo: unknown, submitClientEvent: unknown) => void;
  onBreakoutJoinResponse: (eventInfo: unknown, submitClientEvent: unknown) => void;
  postMoveCallAnalyzer: (
    event: ClientEvent['name'],
    eventInfo: unknown,
    submitClientEvent: any
  ) => void;
} = {
  onBreakoutMoveRequest: (eventInfo, submitClientEvent) => {
    breakoutEvent.postMoveCallAnalyzer(
      'client.breakout-session.move.request',
      eventInfo,
      submitClientEvent
    );
  },
  onBreakoutMoveResponse: (eventInfo, submitClientEvent) => {
    breakoutEvent.postMoveCallAnalyzer(
      'client.breakout-session.move.response',
      eventInfo,
      submitClientEvent
    );
  },
  onBreakoutJoinResponse: (eventInfo, submitClientEvent) => {
    breakoutEvent.postMoveCallAnalyzer(
      'client.breakout-session.join.response',
      eventInfo,
      submitClientEvent
    );
  },
  postMoveCallAnalyzer: (event: ClientEvent['name'], eventInfo: any, submitClientEvent) => {
    if (!eventInfo?.breakoutMoveId || !eventInfo?.meeting) {
      return;
    }
    if (!eventInfo.meeting.meetingInfo?.enableConvergedArchitecture) {
      return;
    }
    submitClientEvent({
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
