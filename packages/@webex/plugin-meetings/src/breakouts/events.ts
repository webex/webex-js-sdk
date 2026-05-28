// eslint-disable-next-line import/prefer-default-export
import {ClientEvent} from '@webex/internal-plugin-metrics';

const breakoutEvent: {
  onBreakoutMoveRequest: (eventInfo: any, submitClientEvent: any) => void;
  onBreakoutMoveResponse: (eventInfo: any, submitClientEvent: any) => void;
  onBreakoutJoinResponse: (eventInfo: any, submitClientEvent: any) => void;
  postMoveCallAnalyzer: (
    event: ClientEvent['name'],
    eventInfo: any,
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

    const {breakoutMoveId, currentSession, error, llmLatency, llmWebsocketUrl, meeting} = eventInfo;

    if (event === 'client.breakout-session.join.response' && !llmLatency) {
      return;
    }
    if (!meeting.meetingInfo?.enableConvergedArchitecture) {
      return;
    }

    const payload: any = {
      llmLatency,
      identifiers: {
        breakoutMoveId,
        breakoutSessionId: currentSession?.sessionId,
        breakoutGroupId: currentSession?.groupId,
        llmWebsocketUrl,
      },
    };

    const options: any = {
      meetingId: meeting.id,
    };

    if (error) {
      options.rawError = error;
    }

    submitClientEvent({
      name: event,
      payload,
      options,
    });
  },
};

export default breakoutEvent;
