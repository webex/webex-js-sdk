import {assert, expect} from '@webex/test-helper-chai';
import Breakout from '@webex/plugin-meetings/src/breakouts/breakout';
import Breakouts from '@webex/plugin-meetings/src/breakouts';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import uuid from 'uuid';
import breakoutEvent from "../../../../src/breakouts/events";
import BreakoutRequest from '../../../../src/breakouts/request';
import Members from '../../../../src/members';

describe('plugin-meetings', () => {
  describe('breakout', () => {
    let webex;
    let breakout;
    let breakouts;
    let meeting;

    beforeEach(() => {
      // @ts-ignore
      webex = new MockWebex({});
      webex.internal.llm.on = sinon.stub();
      webex.internal.mercury.on = sinon.stub();
      breakouts = new Breakouts({}, {parent: webex});
      breakout = new Breakout({}, {parent: breakouts});
      breakout.groupId = 'groupId';
      breakout.sessionId = 'sessionId';
      breakout.sessionType = 'BREAKOUT';
      breakout.url = 'url';
      breakout.collection = {
        parent: {
          meetingId: 'activeMeetingId',
        },
      };
      webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
      webex.meetings = {};
      webex.meetings.getMeetingByType = sinon.stub();
      sinon.stub(uuid, 'v4').returns('breakoutMoveId');
    });

    afterEach(() => {
      // @ts-ignore
      uuid.v4.restore();
    })

    describe('initialize', () => {
      it('creates the object correctly', () => {
        assert.instanceOf(breakout.breakoutRequest, BreakoutRequest);
      });
    });

    describe('#initMembers', () => {
      it('creates the Members instance for the breakout', () => {
        assert.equal(breakout.members, undefined);

        breakout.webex.meetings = {
          getMeetingByType: sinon.stub().returns({
            id: 'meeting-id',
          }),
        };

        breakout.initMembers();

        assert.instanceOf(breakout.members, Members);
      });
    });

    describe('#join', () => {
      it('makes the request as expected', async () => {
        const result = await breakout.join();
        assert.calledOnceWithExactly(webex.request, {
          method: 'POST',
          uri: 'url/move',
          body: {
            breakoutMoveId: 'breakoutMoveId',
            deviceUrl: undefined,
            groupId: 'groupId',
            sessionId: 'sessionId',
          },
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });

      it('send metrics as expected', async () => {
        breakout.webex.internal.device.url = 'device-url';
        breakout.webex.meetings = {
          getMeetingByType: sinon.stub().returns({
          id: 'meeting-id'
        })
        };

        const submitClientEventStub = sinon.stub(webex.internal.newMetrics.submitClientEvent, 'bind').returns(webex.internal.newMetrics.submitClientEvent);

        let onBreakoutMoveRequestStub = sinon.stub(breakoutEvent, 'onBreakoutMoveRequest');
        let onBreakoutMoveResponseStub = sinon.stub(breakoutEvent, 'onBreakoutMoveResponse');
        await breakout.join();
        assert.calledOnceWithExactly(breakoutEvent.onBreakoutMoveRequest,
          {currentSession: breakout, meeting: {id: 'meeting-id'}, breakoutMoveId: 'breakoutMoveId'},
          webex.internal.newMetrics.submitClientEvent
        );
        assert.calledOnceWithExactly(breakoutEvent.onBreakoutMoveResponse,
          {currentSession: breakout, meeting: {id: 'meeting-id'}, breakoutMoveId: 'breakoutMoveId'},
          webex.internal.newMetrics.submitClientEvent
        );

        onBreakoutMoveRequestStub.restore();
        onBreakoutMoveResponseStub.restore();
        submitClientEventStub.restore()
      });
    });

    describe('#leave', () => {
      it('throws error if in main sesson', async () => {
        breakout.set('sessionType', 'MAIN');

        const fn = () => {
          breakout.leave();
        };

        expect(fn).to.throw(/Cannot leave the main session/);
      });

      it('throws error if there is no main session', async () => {
        const fn = () => {
          breakout.leave();
        };

        expect(fn).to.throw(/Cannot leave, no main session found/);
      });

      it('joins the main session if in a breakout', async () => {
        breakout.parent.breakouts.add({
          sessionType: 'MAIN',
        });

        const mainSession = breakouts.breakouts.models[0];

        mainSession.join = sinon.stub().returns('JOIN_RETURN_VALUE');

        const result = await breakout.leave();

        assert.calledOnceWithExactly(mainSession.join);
        assert.equal(result, 'JOIN_RETURN_VALUE');
      });
    });

    describe('#askForHelp', () => {
      it('makes the request as expected', async () => {
        const result = await breakout.askForHelp();

        assert.calledOnceWithExactly(webex.request, {
          method: 'POST',
          uri: 'url/help',
          body: {
            groupId: 'groupId',
            sessionId: 'sessionId',
          },
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });
    });

    describe('#broadcast', () => {
      it('makes the request as expected', async () => {
        breakout.breakoutRequest.broadcast = sinon
          .stub()
          .returns(Promise.resolve('REQUEST_RETURN_VALUE'));
        let result = await breakout.broadcast('hello');
        assert.calledWithExactly(breakout.breakoutRequest.broadcast, {
          url: 'url',
          message: 'hello',
          options: undefined,
          groupId: 'groupId',
          sessionId: 'sessionId',
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');

        result = await breakout.broadcast('hello', {presenters: true, cohosts: true});

        assert.calledWithExactly(breakout.breakoutRequest.broadcast, {
          url: 'url',
          message: 'hello',
          options: {presenters: true, cohosts: true},
          groupId: 'groupId',
          sessionId: 'sessionId',
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });
    });

    describe('#isNeedHandleRoster', () => {
      it('return true if no sequence in locus/breakoutRosterLocus', () => {
        breakout.breakoutRosterLocus = null;
        assert.equal(breakout.isNeedHandleRoster(), true);

        breakout.breakoutRosterLocus = {sequence: {entries: [123]}};
        assert.equal(breakout.isNeedHandleRoster(null), true);

        assert.equal(breakout.isNeedHandleRoster({sequence: {entries: []}}), true);
      });
      it('return true if the locus sequence is bigger than last one', () => {
        breakout.breakoutRosterLocus = {sequence: {entries: [123]}};
        assert.equal(breakout.isNeedHandleRoster({sequence: {entries: [124]}}), true);
      });
      it('return false if the locus sequence is smaller than last one', () => {
        breakout.breakoutRosterLocus = {sequence: {entries: [123]}};
        assert.equal(breakout.isNeedHandleRoster({sequence: {entries: [122]}}), false);
      });
    });

    describe('#parseRoster', () => {
      it('calls locusParticipantsUpdate', () => {
        breakout.members = {
          locusParticipantsUpdate: sinon.stub(),
        };

        const locusData = {some: 'data'};
        const result = breakout.parseRoster(locusData);

        assert.calledOnceWithExactly(breakout.members.locusParticipantsUpdate, locusData);
        assert.equal(result, undefined);
      });
      it('not call locusParticipantsUpdate if sequence is expired', () => {
        breakout.members = {
          locusParticipantsUpdate: sinon.stub(),
        };
        breakout.isNeedHandleRoster = sinon.stub().returns(false);
        const locusData = {some: 'data'};
        breakout.parseRoster(locusData);

        assert.notCalled(breakout.members.locusParticipantsUpdate);
      });
    })
  });
});
