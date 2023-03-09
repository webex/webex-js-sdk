import {assert, expect} from '@webex/test-helper-chai';
import Breakouts from '@webex/plugin-meetings/src/breakouts';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import {BREAKOUTS} from '@webex/plugin-meetings/src/constants';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import testUtils from '../../../utils/testUtils';
import BreakoutEditLockedError from "@webex/plugin-meetings/src/breakouts/edit-lock-error";

const getBOResponse = (status: string) => {
  return {
    url: 'url',
    locusUrl: 'locusUrl',
    mainGroupId: 'mainGroupId',
    mainSessionId: 'mainSessionId',
    groups: [
      {
        id: 'groupId',
        type: 'BREAKOUT',
        status,
        duration: 60000,
        durationSetting: 60000,
        delayCloseTime: 60,
        allowBackToMain: true,
        allowToJoinLater: true,
        startTime: '2023-02-01T23:08:43.200Z',
        sessions: [
          {
            name: 'Breakout Session 1',
            subConfId: 1,
            anyoneCanJoin: false,
            locusUrl: 'locusUrl',
            venueUrl: 'venueUrl',
            allowed: ['allowed id1', 'allowed id2'],
            id: 'sessionId1',
          },
          {
            name: 'Breakout Session 2',
            anyoneCanJoin: true,
            locusUrl: 'locusUrl',
            allowed: ['allowed id3', 'allowed id4'],
            id: 'sessionId2',
          },
        ],
      },
    ],
  };
};

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
      breakouts.groupId = 'groupId';
      breakouts.sessionId = 'sessionId';
      breakouts.url = 'url';
      breakouts.locusUrl = 'locusUrl';
      breakouts.breakoutServiceUrl = 'breakoutServiceUrl';
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

        breakouts.set({status: BREAKOUTS.STATUS.CLOSING});

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
        });

        breakouts.currentBreakoutSession.sessionId = 'sessionId';

        callback({
          data: {
            senderUserId: 'senderUserId',
            sentTime: 'sentTime',
            message: 'message',
          },
        });

        assert.deepEqual(message, {
          senderUserId: 'senderUserId',
          sentTime: 'sentTime',
          message: 'message',
          sessionId: 'sessionId',
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
        });
        breakouts.handleRosterUpdate = sinon.stub();

        callback({
          data: {
            locus: 'locus',
          },
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
          locusUrl: 'locusUrl',
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
          ...{[state]: true},
        });
      };

      it('works', () => {
        breakouts.set('url', 'url');

        const payload = {
          breakoutSessions: {
            active: [{sessionId: 'sessionId1'}],
            assigned: [{sessionId: 'sessionId2'}],
            allowed: [{sessionId: 'sessionId3'}],
            assignedCurrent: [{sessionId: 'sessionId4'}],
            requested: [{sessionId: 'sessionId5'}],
          },
        };

        breakouts.updateBreakoutSessions(payload);

        checkBreakout(breakouts.breakouts.get('sessionId1'), 'sessionId1', 'active');
        checkBreakout(breakouts.breakouts.get('sessionId2'), 'sessionId2', 'assigned');
        checkBreakout(breakouts.breakouts.get('sessionId3'), 'sessionId3', 'allowed');
        checkBreakout(breakouts.breakouts.get('sessionId4'), 'sessionId4', 'assignedCurrent');
        checkBreakout(breakouts.breakouts.get('sessionId5'), 'sessionId5', 'requested');
      });
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

        const locus = {controls: {breakout: {sessionId: 'sessionId'}}};

        breakouts.handleRosterUpdate(locus);
        assert.calledOnceWithExactly(breakout.parseRoster, locus);
      });
    });

    describe('#queryRosters', () => {
      it('makes the expected query', async () => {
        webex.request.returns(
          Promise.resolve({
            body: {
              rosters: [
                {
                  locus: 'locus1',
                },
                {
                  locus: 'locus2',
                },
              ],
            },
          })
        );

        breakouts.set('url', 'url');
        breakouts.set('locusUrl', 'test');

        breakouts.handleRosterUpdate = sinon.stub();

        const result = await breakouts.queryRosters();

        assert.calledOnceWithExactly(webex.request, {
          uri: 'url/roster',
          qs: {locusUrl: 'dGVzdA=='},
        });
        assert.calledTwice(breakouts.handleRosterUpdate);

        assert.deepEqual(breakouts.handleRosterUpdate.getCall(0).args, ['locus1']);
        assert.deepEqual(breakouts.handleRosterUpdate.getCall(1).args, ['locus2']);
      });

      it('logs the error if the query fails', async () => {
        const error = new Error('something went wrong');
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
        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN);
        assert.equal(breakouts.isInMainSession, true);
      });
    });

    describe('#getMainSession', () => {
      it('returns main session as expect', () => {
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
        const payload = {
          breakoutSessions: {
            active: [{sessionId: 'sessionId1'}],
          }
        }
        breakouts.updateBreakoutSessions(payload);

        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN);
        let result = breakouts.getMainSession();
        assert.equal(result.sessionId, 'sessionId');

        const payload2 = {
          breakoutSessions: {
            active: [{sessionId: 'sessionId1', sessionType: BREAKOUTS.SESSION_TYPES.MAIN}],
          }
        }
        breakouts.updateBreakoutSessions(payload2);
        breakouts.set('sessionType', 'BREAKOUT');
        result = breakouts.getMainSession();
        assert.equal(result.sessionId, 'sessionId1');
      });
      it('throw error if cannot find main session', () => {
        const fn = () => {
          breakouts.getMainSession();
        }
        expect(fn).to.throw(/no main session found/);
      });
    });

    describe('#askAllToReturn',  () => {
      it('makes the request as expected', async () => {
        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN);
        breakouts.currentBreakoutSession.sessionId = 'sessionId';
        breakouts.currentBreakoutSession.groupId = 'groupId';
        const result = await breakouts.askAllToReturn();
        assert.calledOnceWithExactly(webex.request, {
          method: 'POST',
          uri: 'url/requestMove',
          body: {
            groupId: 'groupId',
            sessionId: 'sessionId'
          }
        });
      });
    });

    describe('#breakoutServiceUrlUpdate', () => {
      it('sets the breakoutService url', () => {
        breakouts.breakoutServiceUrlUpdate('newBreakoutServiceUrl');
        assert.equal(breakouts.breakoutServiceUrl, 'newBreakoutServiceUrl/breakout/');
      });
    });

    describe('#toggleBreakout', () => {
      it('enableBreakoutSession is undefined, run enableBreakouts then toggleBreakout', async() => {
        breakouts.enableBreakoutSession = undefined;
        breakouts.enableBreakouts = sinon.stub().resolves(({body: {
          sessionId: 'sessionId',
          groupId: 'groupId',
          name: 'name',
          current: true,
          sessionType: 'sessionType',
          url: 'url'
        }}))
        breakouts.updateBreakout = sinon.stub().resolves();
        breakouts.doToggleBreakout = sinon.stub().resolves();

        await breakouts.toggleBreakout(false);
        assert.calledOnceWithExactly(breakouts.enableBreakouts);
        assert.calledOnceWithExactly(breakouts.updateBreakout, {
          sessionId: 'sessionId',
          groupId: 'groupId',
          name: 'name',
          current: true,
          sessionType: 'sessionType',
          url: 'url'
        });
        assert.calledOnceWithExactly(breakouts.doToggleBreakout, false);
      });

      it('enableBreakoutSession is exist, run toggleBreakout', async() => {
        breakouts.enableBreakoutSession = true;
        breakouts.doToggleBreakout = sinon.stub().resolves();
        await breakouts.toggleBreakout(true);
        assert.calledOnceWithExactly(breakouts.doToggleBreakout, true);
      });
    });

    describe('enableBreakouts', () => {
      it('makes the request as expected', async () => {
        const result = await breakouts.enableBreakouts();
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

    describe('#broadcast',  () => {
      it('makes the request as expected', async () => {
        breakouts.breakoutRequest.broadcast = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
        webex.request.returns(
          Promise.resolve({
            body: getBOResponse('OPEN'),
          })
        );
        await breakouts.getBreakout();
        let result = await breakouts.broadcast('hello');
        assert.calledWithExactly(breakouts.breakoutRequest.broadcast, {
          url: 'url',
          message: 'hello',
          options: undefined,
          groupId: 'groupId'
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');

        result = await breakouts.broadcast('hello', {presenters: true, cohosts: true});
        assert.calledWithExactly(breakouts.breakoutRequest.broadcast, {
          url: 'url',
          groupId: 'groupId',
          message: 'hello',
          options: {presenters: true, cohosts: true}
        });
        assert.equal(result, 'REQUEST_RETURN_VALUE')
      });

      it('throw error if no breakout group id found', () => {
        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN);
        const fn = () => {
          breakouts.broadcast('hello');
        }
        expect(fn).to.throw(/no breakout session found/);
      });
    });

    describe('#start', () => {
      it('should start breakout sessions', async () => {
        webex.request.returns(
          Promise.resolve({
            body: getBOResponse('OPEN'),
          })
        );

        breakouts.set('url', 'url');
        await breakouts.getBreakout();

        const result = await breakouts.start();
        await breakouts.start({id: 'id', someOtherParam: 'someOtherParam'});

        const arg = webex.request.getCall(1).args[0];
        const argObj1 = arg.body.groups[0];
        const argObj2 = webex.request.getCall(2).args[0].body.groups[0];

        assert.equal(arg.uri, 'url');
        assert.equal(arg.method, 'PUT');
        assert.deepEqual(argObj1, {id:'groupId', action: 'START', allowBackToMain: false, allowToJoinLater: false});
        assert.deepEqual(argObj2, {id:'id', action: 'START', allowBackToMain: false, allowToJoinLater: false, someOtherParam: 'someOtherParam'});
        assert.deepEqual(result, {body: getBOResponse('OPEN')});
      });

      it('rejects when edit lock token mismatch', async () => {
        webex.request.returns(Promise.reject({
          body: {
            "errorCode":BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
            "message":"Edit lock token mismatch"
          }
        }));

        await assert.isRejected(
          breakouts.start(),
          BreakoutEditLockedError,
          'Edit lock token mismatch'
        );

      });
    });

    describe('#end', () => {
      it('should end breakout sessions', async () => {
        webex.request.returns(
          Promise.resolve({
            body: getBOResponse('CLOSING'),
          })
        );

        breakouts.set('url', 'url');
        breakouts.set('delayCloseTime', 60);
        await breakouts.getBreakout();

        const result = await breakouts.end();
        await breakouts.end({id: 'id', someOtherParam: 'someOtherParam'});
        const arg = webex.request.getCall(1).args[0];
        const argObj1 = arg.body.groups[0];
        const argObj2 = webex.request.getCall(2).args[0].body.groups[0];

        assert.equal(arg.uri, 'url');
        assert.equal(arg.method, 'PUT');
        assert.deepEqual(argObj1, {id:'groupId', action: 'CLOSE', delayCloseTime: 60});
        assert.deepEqual(argObj2, {id:'id', action: 'CLOSE', delayCloseTime: 60, someOtherParam: 'someOtherParam'});
        assert.deepEqual(result, {body: getBOResponse('CLOSING')});
      });

      it('rejects when edit lock token mismatch', async () => {
        webex.request.returns(Promise.reject({
          body: {
            "errorCode":BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
            "message":"Edit lock token mismatch"
          }
        }));

        await assert.isRejected(
          breakouts.end(),
          BreakoutEditLockedError,
          'Edit lock token mismatch'
        );

      });
    });

    describe('#getBreakout', () => {
      it('should get breakout sessions', async () => {
        webex.request.returns(
          Promise.resolve({
            body: getBOResponse('PENDING'),
          })
        );

        breakouts.set('url', 'url');
        const result = await breakouts.getBreakout();
        await breakouts.getBreakout(true);
        const arg1 = webex.request.getCall(0).args[0];
        const arg2 = webex.request.getCall(1).args[0];

        assert.equal(arg1.uri, 'url');
        assert.equal(arg2.uri, 'url?editlock=true');
        assert.equal(arg1.method, 'GET');
        assert.deepEqual(result, {body: getBOResponse('PENDING')});
        assert.deepEqual(breakouts.groups, result.body.groups);
        assert.equal(breakouts.breakoutGroupId, 'groupId');
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

    describe('delete', () => {
      it('makes the request as expected', async () => {
        webex.request.returns(Promise.resolve({
          body: {
            groups: [{
              id : "455556a4-37cd-4baa-89bc-8730581a1cc0",
              status : "CLOSE",
              type : "BREAKOUT",
            }]
          }
        }));

        const result = await breakouts.clearSessions();
        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'url',
          body: {
            groups: [
              {
                action: BREAKOUTS.ACTION.DELETE,
              },
            ],
          }
        });

        assert.equal(breakouts.groups[0].status, "CLOSE")
      });

      it('rejects when edit lock token mismatch', async () => {
        webex.request.returns(Promise.reject({
          body: {
            "errorCode":BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
            "message":"Edit lock token mismatch"
          }
        }));

        await assert.isRejected(
          breakouts.clearSessions(),
          BreakoutEditLockedError,
          'Edit lock token mismatch'
        );

      });
    });

    describe('create', () => {
      it('response not include groups info', async () => {
        const sessions = [{'name':'session1', "anyoneCanJoin" : true}];
        const result = await breakouts.create(sessions);

        assert.equal(result, 'REQUEST_RETURN_VALUE');

      });

      it('response include groups info', async () => {
        const sessions = [{'name':'session1', "anyoneCanJoin" : true}];

        webex.request.returns(Promise.resolve({
          body: {
            groups: [{
              id : "455556a4-37cd-4baa-89bc-8730581a1cc0",
              status : "PENDING",
              type : "BREAKOUT",
            }]
          }
        }));

        const result = await breakouts.create(sessions);

        assert.equal(breakouts.groups[0].id, "455556a4-37cd-4baa-89bc-8730581a1cc0")

      });

      it('rejects when edit lock token mismatch', async () => {
        const sessions = [{'name':'session1', "anyoneCanJoin" : true}];

        webex.request.returns(Promise.reject({
          body: {
            "errorCode":BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
            "message":"Edit lock token mismatch"
          }
        }));

        await assert.isRejected(
          breakouts.create(sessions),
          BreakoutEditLockedError,
          'Edit lock token mismatch'
        );
      });
    });
  });
});
