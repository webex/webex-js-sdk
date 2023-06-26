import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import breakoutEvent from "../../../../src/breakouts/events";
import { NewMetrics } from '@webex/internal-plugin-metrics';

describe('plugin-meetings', () => {
  describe('breakoutEvent', () => {
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

    });
    describe('postMoveCallAnalyzer', () => {
      it('send metric as expected', () => {
        NewMetrics.submitClientEvent = sinon.stub();
        const eventInfo = {currentSession: newSession, meeting: mockMeeting, breakoutMoveId};
        breakoutEvent.postMoveCallAnalyzer('client.breakout-session.join.response', eventInfo);
        assert.calledWithMatch(NewMetrics.submitClientEvent, {
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

    describe('onBreakoutMoveRequest', () => {
      it('send metric as expected', () => {
        breakoutEvent.postMoveCallAnalyzer = sinon.stub();
        const eventInfo = {newSession, mockMeeting, breakoutMoveId};
        breakoutEvent.onBreakoutMoveRequest(eventInfo);
        assert.calledWithMatch(breakoutEvent.postMoveCallAnalyzer, 'client.breakout-session.move.request', eventInfo);

      });
    });

    describe('onBreakoutMoveResponse', () => {
      it('send metric as expected', () => {
        breakoutEvent.postMoveCallAnalyzer = sinon.stub();
        const eventInfo = {newSession, mockMeeting, breakoutMoveId};
        breakoutEvent.onBreakoutMoveResponse(eventInfo);
        assert.calledWithMatch(breakoutEvent.postMoveCallAnalyzer, 'client.breakout-session.move.response', eventInfo);
      });
    });

    describe('onBreakoutJoinResponse', () => {
      it('send metric as expected', () => {
        breakoutEvent.postMoveCallAnalyzer = sinon.stub();
        const eventInfo = {newSession, mockMeeting, breakoutMoveId};
        breakoutEvent.onBreakoutJoinResponse(eventInfo);
        assert.calledWithMatch(breakoutEvent.postMoveCallAnalyzer, 'client.breakout-session.join.response', eventInfo);
      });
    });

  });
});
