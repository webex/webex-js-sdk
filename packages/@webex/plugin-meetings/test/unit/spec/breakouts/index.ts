import {assert} from '@webex/test-helper-chai';
import Breakout from '@webex/plugin-meetings/src/breakouts/breakout';
import Breakouts from '@webex/plugin-meetings/src/breakouts';
import BreakoutCollection from '@webex/plugin-meetings/src/breakouts/collection';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import {BREAKOUTS} from '@webex/plugin-meetings/src/constants';
import sinon from "sinon";
import MockWebex from '@webex/test-helper-mock-webex';
import testUtils from '../../../utils/testUtils';


describe('plugin-meetings', () => {
  describe('Breakouts', () => {
    let webex;
    let breakouts;

    beforeEach(() => {
      // @ts-ignore
      webex = new MockWebex({});
      webex.internal.llm.on = sinon.stub();
      webex.internal.mercury.on = sinon.stub();
      breakouts = new Breakouts({}, {parent: webex});
      breakouts.locusUrl = 'locusUrl';
      breakouts.breakoutServiceUrl = 'breakoutServiceUrl';
      breakouts.url = 'url';
      webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
    });

    describe('#initialize', () => {
      it('creates Breakouts as expected', () => {
        assert.equal(breakouts.namespace, 'Meetings');
      });

      it('emits BREAKOUTS_CLOSING event when the status is CLOSING', () => {  
        let called = false;
        breakouts.listenTo(breakouts, BREAKOUTS.EVENTS.BREAKOUTS_CLOSING, () => {
          called = true;
        });

        breakouts.set('status', 'something');

        assert.isFalse(called);

        breakouts.set({'status': BREAKOUTS.STATUS.CLOSING});

        assert.isTrue(called);
      });

      it('debounces querying rosters on add', () => {
        breakouts.debouncedQueryRosters = sinon.stub();
        breakouts.breakouts.add({sessionType: 'MAIN'});

        assert.calledOnceWithExactly(breakouts.debouncedQueryRosters);
      });
    });

    describe('#listenToBroadcastMessages', () => {
      it('triggers message event when a message received', () => {
        const call = webex.internal.llm.on.getCall(0);
        const callback = call.args[1];
        
        assert.equal(call.args[0], 'event:breakout.message');

        let message;

        breakouts.listenTo(breakouts, BREAKOUTS.EVENTS.MESSAGE, (event) => {
          message = event;
        })

        breakouts.currentBreakoutSession.sessionId = 'sessionId';

        callback({
          data: {
            senderUserId: 'senderUserId',
            sentTime: 'sentTime',
            message: 'message',
          }
        });

        assert.deepEqual(message, {
          senderUserId: "senderUserId",
          sentTime: 'sentTime',
          message: 'message',
          sessionId: 'sessionId'
        });
      });
    });

    describe('#listenToBreakoutRosters', () => {
      it('triggers member update event when a roster received', () => {
        const call = webex.internal.mercury.on.getCall(0);
        const callback = call.args[1];
        
        assert.equal(call.args[0], 'event:breakout.roster');

        let called = false;

        breakouts.listenTo(breakouts, BREAKOUTS.EVENTS.MEMBERS_UPDATE, () => {
          called = true;
        })
        breakouts.handleRosterUpdate = sinon.stub();

        callback({
          data: {
            locus: 'locus'
          }
        });

        assert.isTrue(called);
        assert.calledOnceWithExactly(breakouts.handleRosterUpdate, 'locus');
      });
    });

    describe('#updateBreakout', () => {
      it('updates the current breakout session', () => {
        breakouts.updateBreakout({
          sessionId: 'sessionId',
          groupId: 'groupId',
          sessionType: 'sessionType',
          url: 'url',
          name: 'name',
          allowBackToMain: true,
          delayCloseTime: 10,
          enableBreakoutSession: true,
          startTime: 'startTime',
          status: 'active',
          locusUrl: 'locusUrl'
        });

        assert.equal(breakouts.allowBackToMain, true);
        assert.equal(breakouts.delayCloseTime, 10);
        assert.equal(breakouts.enableBreakoutSession, true);
        assert.equal(breakouts.groupId, 'groupId');
        assert.equal(breakouts.name, 'name');
        assert.equal(breakouts.sessionId, 'sessionId');
        assert.equal(breakouts.startTime, 'startTime');
        assert.equal(breakouts.status, 'active');
        assert.equal(breakouts.url, 'url');
        assert.equal(breakouts.locusUrl, 'locusUrl');

        assert.equal(breakouts.currentBreakoutSession.sessionId, 'sessionId');
        assert.equal(breakouts.currentBreakoutSession.groupId, 'groupId');
        assert.equal(breakouts.currentBreakoutSession.name, 'name');
        assert.equal(breakouts.currentBreakoutSession.current, true);
        assert.equal(breakouts.currentBreakoutSession.sessionType, 'sessionType');
        assert.equal(breakouts.currentBreakoutSession.url, 'url');
        assert.equal(breakouts.currentBreakoutSession.active, false);
        assert.equal(breakouts.currentBreakoutSession.allowed, false);
        assert.equal(breakouts.currentBreakoutSession.assigned, false);
        assert.equal(breakouts.currentBreakoutSession.assignedCurrent, false);
        assert.equal(breakouts.currentBreakoutSession.requested, false);
      });
    });

    describe('#updateBreakoutSessions', () => {

      const checkBreakout = (breakout, sessionId, state) => {
        assert.deepEqual(breakout.attributes, {
          active: false,
          allowed: false,
          assigned: false,
          assignedCurrent: false,
          current: false,
          ready: true,
          requested: false,
          url: 'url',
          sessionId,
          ...{[state]: true}
        });
      }

      it('works', () => {

        breakouts.set('url', 'url');

        const payload = {
          breakoutSessions: {
            active: [{sessionId: 'sessionId1'}],
            assigned: [{sessionId: 'sessionId2'}],
            allowed: [{sessionId: 'sessionId3'}],
            assignedCurrent: [{sessionId: 'sessionId4'}],
            requested: [{sessionId: 'sessionId5'}],
          }
        }

        breakouts.updateBreakoutSessions(payload);

        checkBreakout(breakouts.breakouts.get('sessionId1'), 'sessionId1', 'active');
        checkBreakout(breakouts.breakouts.get('sessionId2'), 'sessionId2', 'assigned');
        checkBreakout(breakouts.breakouts.get('sessionId3'), 'sessionId3', 'allowed');
        checkBreakout(breakouts.breakouts.get('sessionId4'), 'sessionId4', 'assignedCurrent');
        checkBreakout(breakouts.breakouts.get('sessionId5'), 'sessionId5', 'requested');
      })
    });

    describe('#locusUrlUpdate', () => {
      it('sets the locus url', () => {
        breakouts.locusUrlUpdate('newUrl');

        assert.equal(breakouts.locusUrl, 'newUrl');
      });
    });

    describe('#cleanUp', () => {
      it('stops listening', () => {
        breakouts.stopListening = sinon.stub();
  
        breakouts.cleanUp();
  
        assert.calledOnceWithExactly(breakouts.stopListening);
      });
    });

    describe('#handleRosterUpdate', () => {
      it('does not break if it cannot find the session', () => {
        breakouts.handleRosterUpdate({controls: {breakout: {sessionId: 'sessionId'}}});
      });

      it('calls parse roster if it can find the session', () => {
        breakouts.breakouts.add({sessionId: 'sessionId'});

        const breakout = breakouts.breakouts.models[0];
        breakout.parseRoster = sinon.stub();

        const locus = {controls: {breakout: {sessionId: 'sessionId'}}}

        breakouts.handleRosterUpdate(locus);
        assert.calledOnceWithExactly(breakout.parseRoster, locus);
      });
    });

    describe('#queryRosters', () => {
      
      it('makes the expected query', async () => {

        webex.request.returns(Promise.resolve({
          body: {
            rosters: [{
              locus: 'locus1'
            }, {
              locus: 'locus2'
            }]
          }
        }));

        breakouts.set('url', 'url');
        breakouts.set('locusUrl', 'test');

        breakouts.handleRosterUpdate = sinon.stub();

        const result = await breakouts.queryRosters();
  
        assert.calledOnceWithExactly(webex.request, {
          uri: 'url/roster',
          qs: { locusUrl: 'dGVzdA==' }
        });
        assert.calledTwice(breakouts.handleRosterUpdate);

        assert.deepEqual(breakouts.handleRosterUpdate.getCall(0).args, ['locus1']);
        assert.deepEqual(breakouts.handleRosterUpdate.getCall(1).args, ['locus2']);
      });

      it('logs the error if the query fails', async () => {
        const error = new Error('something went wrong')
        webex.request.rejects(error);
        LoggerProxy.logger.error = sinon.stub();

        breakouts.set('url', 'url');
        breakouts.set('locusUrl', 'test');

        breakouts.handleRosterUpdate = sinon.stub();

        const result = await breakouts.queryRosters();
        await testUtils.flushPromises();

        assert.calledOnceWithExactly(webex.request, {
          uri: 'url/roster',
          qs: {locusUrl: 'dGVzdA=='},
        });
        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:breakouts#queryRosters failed',
          error
        );
      });
    });

    describe('isInMainSession', () => {
      it('returns true when sessionType is MAIN', () => {
        assert.equal(breakouts.isInMainSession, false);
        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN)
        assert.equal(breakouts.isInMainSession, true);
      });
    });

    describe('#breakoutServiceUrlUpdate', () => {
      it('sets the breakoutService url', () => {
        breakouts.breakoutServiceUrlUpdate('newBreakoutServiceUrl');

        assert.equal(breakouts.breakoutServiceUrl, 'newBreakoutServiceUrl/breakout/');
      });
    });

    describe('touchBreakout', () => {
      it('makes the request as expected', async () => {
        const result = await breakouts.touchBreakout();
        breakouts.set('breakoutServiceUrl', 'breakoutServiceUrl');
        assert.calledOnceWithExactly(webex.request, {
          method: 'POST',
          uri: 'breakoutServiceUrl',
          body: {
            locusUrl: 'locusUrl'
          }
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });
    });

    describe('doToggleBreakout', () => {
      it('makes the request as expected', async () => {
        const result = await breakouts.doToggleBreakout(true);
        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'url',
          body: {
            enableBreakoutSession: true
          }
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });
    });
  });
});
