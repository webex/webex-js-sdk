import {assert, expect} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Metrics from '@webex/plugin-meetings/src/metrics';
import sinon from 'sinon';
import {eventType} from '../../../../src/metrics/config';
import breakoutEvent from "../../../../src/breakouts/events";

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
        Metrics.postEvent = sinon.stub();
        const eventInfo = {currentSession: newSession, meeting: mockMeeting, breakoutMoveId};
        breakoutEvent.postMoveCallAnalyzer(eventType.BREAKOUT_JOIN_RESPONSE, eventInfo);
        assert.calledWithMatch(Metrics.postEvent, {
          event: eventType.BREAKOUT_JOIN_RESPONSE,
          meetingId: 'activeMeetingId',
          data: {
            breakoutMoveId: 'breakoutMoveId',
            breakoutSessionId: 'sessionId',
            breakoutGroupId: 'groupId',
          },
        });
      });
    });

    describe('onBreakoutMoveRequest', () => {
      it('send metric as expected', () => {
        breakoutEvent.postMoveCallAnalyzer = sinon.stub();
        const eventInfo = {newSession, mockMeeting, breakoutMoveId};
        breakoutEvent.onBreakoutMoveRequest(eventInfo);
        assert.calledWithMatch(breakoutEvent.postMoveCallAnalyzer, eventType.BREAKOUT_MOVE_REQUEST, eventInfo);

      });
    });

    describe('onBreakoutMoveResponse', () => {
      it('send metric as expected', () => {
        breakoutEvent.postMoveCallAnalyzer = sinon.stub();
        const eventInfo = {newSession, mockMeeting, breakoutMoveId};
        breakoutEvent.onBreakoutMoveResponse(eventInfo);
        assert.calledWithMatch(breakoutEvent.postMoveCallAnalyzer, eventType.BREAKOUT_MOVE_RESPONSE, eventInfo);
      });
    });

    describe('onBreakoutJoinResponse', () => {
      it('send metric as expected', () => {
        breakoutEvent.postMoveCallAnalyzer = sinon.stub();
        const eventInfo = {newSession, mockMeeting, breakoutMoveId};
        breakoutEvent.onBreakoutJoinResponse(eventInfo);
        assert.calledWithMatch(breakoutEvent.postMoveCallAnalyzer, eventType.BREAKOUT_JOIN_RESPONSE, eventInfo);
      });
    });

  });
});
