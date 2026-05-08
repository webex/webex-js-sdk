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
    if (!eventInfo.meeting.meetingInfo?.enableConvergedArchitecture) {
      return;
    }

    const identifiers: Record<string, any> = {
      breakoutMoveId: eventInfo.breakoutMoveId,
      breakoutSessionId: eventInfo?.currentSession?.sessionId,
      breakoutGroupId: eventInfo?.currentSession?.groupId,
    };

    // When LLM was re-established as part of a breakout join, surface the
    // LLM latencies on this event instead of `client.llm.connect.response`
    // (which is reserved for initial join).
    if (eventInfo.llmWebsocketUrl) {
      identifiers.llmWebsocketUrl = eventInfo.llmWebsocketUrl;
    }

    const payload: Record<string, any> = {identifiers};

    if (
      eventInfo.llmTiming &&
      (eventInfo.llmTiming.clientLLMDatachannelResponseTime !== undefined ||
        eventInfo.llmTiming.clientLLMWebSocketConnectTime !== undefined)
    ) {
      payload.llmLatency = {
        clientLLMDatachannelResponseTime: eventInfo.llmTiming.clientLLMDatachannelResponseTime,
        clientLLMWebSocketConnectTime: eventInfo.llmTiming.clientLLMWebSocketConnectTime,
      };
    }

    submitClientEvent({
      name: event,
      payload,
      options: {meetingId: eventInfo.meeting.id},
    });
  },
};

export default breakoutEvent;
