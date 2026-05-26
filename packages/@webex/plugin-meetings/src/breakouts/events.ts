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
    if (event === 'client.breakout-session.join.response' && !eventInfo?.llmLatency) {
      return;
    }
    if (!eventInfo.meeting.meetingInfo?.enableConvergedArchitecture) {
      return;
    }

    const payload: any = {
      ...(eventInfo?.llmLatency && {llmLatency: eventInfo.llmLatency}),
      identifiers: {
        breakoutMoveId: eventInfo.breakoutMoveId,
        breakoutSessionId: eventInfo?.currentSession?.sessionId,
        breakoutGroupId: eventInfo?.currentSession?.groupId,
        ...(eventInfo?.llmWebsocketUrl && {llmWebsocketUrl: eventInfo.llmWebsocketUrl}),
      },
    };

    // eslint-disable-next-line no-console
    console.log(`[metrics] ${event}`, {
      name: event,
      payload,
      options: {
        meetingId: eventInfo.meeting.id,
        ...(eventInfo?.error && {rawError: eventInfo.error}),
      },
    });

    submitClientEvent({
      name: event,
      payload,
      options: {
        meetingId: eventInfo.meeting.id,
        ...(eventInfo?.error && {rawError: eventInfo.error}),
      },
    });
  },
};

export default breakoutEvent;
