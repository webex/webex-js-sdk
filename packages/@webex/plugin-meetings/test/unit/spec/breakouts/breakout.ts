import {assert, expect} from '@webex/test-helper-chai';
import Breakout from '@webex/plugin-meetings/src/breakouts/breakout';
import Breakouts from '@webex/plugin-meetings/src/breakouts';
import Members from '@webex/plugin-meetings/src/members';
import MockWebex from '@webex/test-helper-mock-webex';
import Metrics from '@webex/plugin-meetings/src/metrics';
import sinon from 'sinon';

describe('plugin-meetings', () => {
  describe('breakout', () => {
    let webex;
    let breakout;
    let breakouts;

    beforeEach(() => {
      // @ts-ignore
      webex = new MockWebex({});
      webex.internal.llm.on = sinon.stub();
      webex.internal.mercury.on = sinon.stub();
      breakouts = new Breakouts({}, {parent: webex});
      breakout = new Breakout({}, {parent: breakouts});
      breakout.groupId = 'groupId';
      breakout.sessionId = 'sessionId';
      breakout.url = 'url';
      breakout.collection = {
        parent: {
          meetingId: 'activeMeetingId',
        },
      };
      webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
    });

    describe('initialize', () => {
      it('creates the object correctly', () => {
        assert.instanceOf(breakout.members, Members);
      });
    });

    describe('#join', () => {
      it('makes the request as expected', async () => {
        Metrics.postEvent = sinon.stub();
        const result = await breakout.join();
        assert.calledOnceWithExactly(webex.request, {
          method: 'POST',
          uri: 'url/move',
          body: {
            groupId: 'groupId',
            sessionId: 'sessionId',
          },
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });
      it('send metrics as expected', async () => {
        Metrics.postEvent = sinon.stub();
        await breakout.join();
        assert.calledTwice(Metrics.postEvent);
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
    });
  });
});
