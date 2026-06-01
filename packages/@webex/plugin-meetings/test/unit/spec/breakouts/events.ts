import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import breakoutEvent from "../../../../src/breakouts/events";

describe('plugin-meetings', () => {
  describe('breakoutEvent', () => {
    const originalPostMoveCallAnalyzer = breakoutEvent.postMoveCallAnalyzer;
    let webex;
    let mockMeeting = {};
    let breakoutMoveId;
    let newSession;

    beforeEach(() => {
      // @ts-ignore
      webex = new MockWebex({});
      mockMeeting = {
        id: 'activeMeetingId',
        meetingInfo: {
          enableConvergedArchitecture: true,
        }
      };
      newSession = {
        sessionId: "sessionId",
        groupId: "groupId",
      };
      breakoutMoveId =  'breakoutMoveId';
      breakoutEvent.postMoveCallAnalyzer = originalPostMoveCallAnalyzer;

    });
    describe('postMoveCallAnalyzer', () => {
      it('send metric as expected', () => {
        const submitClientEvent = sinon.stub();
        const eventInfo = {
          currentSession: newSession,
          meeting: mockMeeting,
          breakoutMoveId,
          llmLatency: {
            clientLLMDatachannelResponseTime: 10,
            clientLLMWebSocketConnectTime: 20,
          },
          llmWebsocketUrl: 'wss://example.com/ws',
        };
        breakoutEvent.postMoveCallAnalyzer('client.breakout-session.join.response', eventInfo, submitClientEvent);
        assert.calledWithMatch(submitClientEvent, {
          name: 'client.breakout-session.join.response',
          payload: {
            llmLatency: {
              clientLLMDatachannelResponseTime: 10,
              clientLLMWebSocketConnectTime: 20,
            },
            identifiers: {
              breakoutMoveId: 'breakoutMoveId',
              breakoutSessionId: 'sessionId',
              breakoutGroupId: 'groupId',
              llmWebsocketUrl: 'wss://example.com/ws',
            },
          },
          options: {meetingId: 'activeMeetingId'},
        });
      });
    });

    describe('onBreakoutMoveRequest', () => {
      it('send metric as expected', () => {
        const submitClientEvent = sinon.stub();

        sinon.stub(submitClientEvent, 'bind').returns(webex.internal.newMetrics.submitClientEvent);

        breakoutEvent.postMoveCallAnalyzer = sinon.stub();
        const eventInfo = {newSession, mockMeeting, breakoutMoveId};
        breakoutEvent.onBreakoutMoveRequest(eventInfo, submitClientEvent);
        assert.calledWith(breakoutEvent.postMoveCallAnalyzer, 'client.breakout-session.move.request', eventInfo, submitClientEvent);

      });
    });

    describe('onBreakoutMoveResponse', () => {
      it('send metric as expected', () => {
        const submitClientEvent = sinon.stub();

        sinon.stub(submitClientEvent, 'bind').returns(webex.internal.newMetrics.submitClientEvent);

        breakoutEvent.postMoveCallAnalyzer = sinon.stub();
        const eventInfo = {newSession, mockMeeting, breakoutMoveId};
        breakoutEvent.onBreakoutMoveResponse(eventInfo, submitClientEvent);
        assert.calledWith(breakoutEvent.postMoveCallAnalyzer, 'client.breakout-session.move.response', eventInfo, submitClientEvent);
      });
    });

    describe('onBreakoutJoinResponse', () => {
      it('send metric as expected', () => {
        const submitClientEvent = sinon.stub();

        sinon.stub(submitClientEvent, 'bind').returns(webex.internal.newMetrics.submitClientEvent);

        breakoutEvent.postMoveCallAnalyzer = sinon.stub();
        const eventInfo = {
          newSession,
          mockMeeting,
          breakoutMoveId,
          llmLatency: {clientLLMDatachannelResponseTime: 10, clientLLMWebSocketConnectTime: 20},
        };
        breakoutEvent.onBreakoutJoinResponse(eventInfo, submitClientEvent);
        assert.calledWith(breakoutEvent.postMoveCallAnalyzer, 'client.breakout-session.join.response', eventInfo, submitClientEvent);
      });

      it('emits join response metric without llmLatency', () => {
        const submitClientEvent = sinon.stub();

        breakoutEvent.postMoveCallAnalyzer(
          'client.breakout-session.join.response',
          {currentSession: newSession, meeting: mockMeeting, breakoutMoveId},
          submitClientEvent
        );

        assert.calledOnceWithExactly(submitClientEvent, {
          name: 'client.breakout-session.join.response',
          payload: {
            identifiers: {
              breakoutMoveId: 'breakoutMoveId',
              breakoutSessionId: 'sessionId',
              breakoutGroupId: 'groupId',
            },
          },
          options: {meetingId: 'activeMeetingId'},
        });
      });
    });

  });
});
