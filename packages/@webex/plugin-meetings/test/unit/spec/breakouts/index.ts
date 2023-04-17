import {assert, expect} from '@webex/test-helper-chai';
import Breakouts from '@webex/plugin-meetings/src/breakouts';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import {BREAKOUTS} from '@webex/plugin-meetings/src/constants';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import testUtils from '../../../utils/testUtils';
import BreakoutEditLockedError from '@webex/plugin-meetings/src/breakouts/edit-lock-error';

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

const getBOResponseWithEditLockInfo = (status: string, withOutToken?: boolean) => {
  return {
    url: 'url',
    locusUrl: 'locusUrl',
    mainGroupId: 'mainGroupId',
    mainSessionId: 'mainSessionId',
    editlock: {state: "LOCKED", ttl: 30, userId: "cc5d452f-04b6-4876-a4c3-28ca21982c6a", token: withOutToken ? '' : 'token1'},
    groups: [
      {
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

    describe('#isActiveBreakout', () => {
      it('return is current is breakout with active status', () => {
        assert.equal(breakouts.isActiveBreakout, false);
        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.BREAKOUT);
        assert.equal(breakouts.isActiveBreakout, false);
        breakouts.set('status', BREAKOUTS.STATUS.OPEN);
        assert.equal(breakouts.isActiveBreakout, true);
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
          locusUrl: 'locusUrl',
        });
        const payload = {
          breakoutSessions: {
            active: [{sessionId: 'sessionId1'}],
          },
        };
        breakouts.updateBreakoutSessions(payload);

        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN);
        let result = breakouts.getMainSession();
        assert.equal(result.sessionId, 'sessionId');

        const payload2 = {
          breakoutSessions: {
            active: [{sessionId: 'sessionId1', sessionType: BREAKOUTS.SESSION_TYPES.MAIN}],
          },
        };
        breakouts.updateBreakoutSessions(payload2);
        breakouts.set('sessionType', 'BREAKOUT');
        result = breakouts.getMainSession();
        assert.equal(result.sessionId, 'sessionId1');
      });
      it('throw error if cannot find main session', () => {
        const fn = () => {
          breakouts.getMainSession();
        };
        expect(fn).to.throw(/no main session found/);
      });
    });

    describe('#askAllToReturn', () => {
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
            sessionId: 'sessionId',
          },
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
      it('enableBreakoutSession is undefined, run enableBreakouts then toggleBreakout', async () => {
        breakouts.enableBreakoutSession = undefined;
        breakouts.enableBreakouts = sinon.stub().resolves({
          body: {
            sessionId: 'sessionId',
            groupId: 'groupId',
            name: 'name',
            current: true,
            sessionType: 'sessionType',
            url: 'url',
          },
        });
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
          url: 'url',
        });
        assert.calledOnceWithExactly(breakouts.doToggleBreakout, false);
      });

      it('enableBreakoutSession is exist, run toggleBreakout', async () => {
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
            locusUrl: 'locusUrl',
          },
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });
    });

    describe('#broadcast', () => {
      it('makes the request as expected', async () => {
        breakouts.breakoutRequest.broadcast = sinon
          .stub()
          .returns(Promise.resolve('REQUEST_RETURN_VALUE'));
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
          groupId: 'groupId',
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');

        result = await breakouts.broadcast('hello', {presenters: true, cohosts: true});
        assert.calledWithExactly(breakouts.breakoutRequest.broadcast, {
          url: 'url',
          groupId: 'groupId',
          message: 'hello',
          options: {presenters: true, cohosts: true},
        });
        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });

      it('throw error if no breakout group id found', () => {
        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN);
        const fn = () => {
          breakouts.broadcast('hello');
        };
        expect(fn).to.throw(/no breakout session found/);
      });
    });

    describe('#update', () => {
      it('makes the request as expected', async () => {
        breakouts.editLock = {
          token: 'token1',
        };
        const params = {
          id: 'groupId',
          sessions: [{name: 'Session 1'}],
        };
        const result = await breakouts.update(params);
        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'url',
          body: {
            editlock: {token: 'token1', refresh: true},
            groups: [params],
          },
        });
      });
      it('throw error if missing id in params', async () => {
        const params = {
          sessions: [{name: 'Session 1'}],
        };
        await breakouts.update(params).catch((error) => {
          assert.equal(error.toString(), 'Error: Missing breakout group id');
        });
      });
      it('rejects when edit lock token mismatch', async () => {
        webex.request.returns(
          Promise.reject({
            body: {
              errorCode: BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
              message: 'Edit lock token mismatch',
            },
          })
        );
        LoggerProxy.logger.info = sinon.stub();

        const params = {
          id: 'groupId',
          sessions: [{name: 'Session 1'}],
        };

        await assert.isRejected(
          breakouts.update(params),
          BreakoutEditLockedError,
          'Edit lock token mismatch'
        );
        assert.calledOnceWithExactly(
          LoggerProxy.logger.info,
          'Breakouts#update --> Edit lock token mismatch',
        );
      });

      it('rejects when edit not authorized', async () => {
        webex.request.returns(
          Promise.reject({
            body: {
              errorCode: BREAKOUTS.ERROR_CODE.EDIT_NOT_AUTHORIZED,
            },
          })
        );
        LoggerProxy.logger.info = sinon.stub();

        const params = {
          id: 'groupId',
          sessions: [{name: 'Session 1'}],
        };

        await assert.isRejected(
          breakouts.update(params),
          BreakoutEditLockedError,
          'Not authorized to interact with edit lock'
        );

        assert.calledOnceWithExactly(
          LoggerProxy.logger.info,
          'Breakouts#update --> Not authorized to interact with edit lock',
        );
      });

      it('rejects when other unknow error', async () => {
        const mockError = new Error('something wrong');
        webex.request.returns(
          Promise.reject(mockError)
        );
        LoggerProxy.logger.info = sinon.stub();

        const params = {
          id: 'groupId',
          sessions: [{name: 'Session 1'}],
        };

        await assert.isRejected(
          breakouts.update(params),
          mockError,
          'something wrong'
        );

        assert.calledOnceWithExactly(
          LoggerProxy.logger.info,
          'Breakouts#update --> something wrong',
        );
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
        assert.deepEqual(argObj1, {
          id: 'groupId',
          action: 'START',
          allowBackToMain: false,
          allowToJoinLater: false,
          duration: BREAKOUTS.DEFAULT_DURATION,
        });
        assert.deepEqual(argObj2, {
          id: 'id',
          action: 'START',
          allowBackToMain: false,
          allowToJoinLater: false,
          someOtherParam: 'someOtherParam',
          duration: BREAKOUTS.DEFAULT_DURATION,
        });
        assert.deepEqual(result, {body: getBOResponse('OPEN')});
      });

      it('rejects when edit lock token mismatch', async () => {
        webex.request.returns(
          Promise.reject({
            body: {
              errorCode: BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
              message: 'Edit lock token mismatch',
            },
          })
        );

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
        assert.deepEqual(argObj1, {id: 'groupId', action: 'CLOSE', delayCloseTime: 60});
        assert.deepEqual(argObj2, {
          id: 'id',
          action: 'CLOSE',
          delayCloseTime: 60,
          someOtherParam: 'someOtherParam',
        });
        assert.deepEqual(result, {body: getBOResponse('CLOSING')});
      });

      it('rejects when edit lock token mismatch', async () => {
        webex.request.returns(
          Promise.reject({
            body: {
              errorCode: BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
              message: 'Edit lock token mismatch',
            },
          })
        );

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

      it('should call keep alive when response with edit lock info', async () => {
        webex.request.returns(
          Promise.resolve({
            body: getBOResponseWithEditLockInfo('PENDING'),
          })
        );

        breakouts.set('url', 'url');
        breakouts.keepEditLockAlive = sinon.stub().resolves();
        const result = await breakouts.getBreakout();
        await breakouts.getBreakout(true);

        assert.calledOnceWithExactly(breakouts.keepEditLockAlive);
      });
      it('not call keep alive when response with no edit lock token', async () => {
        webex.request.returns(
          Promise.resolve({
            body: getBOResponseWithEditLockInfo('PENDING', true),
          })
        );

        breakouts.set('url', 'url');
        breakouts.keepEditLockAlive = sinon.stub().resolves();
        const result = await breakouts.getBreakout();
        await breakouts.getBreakout(true);

        assert.notCalled(breakouts.keepEditLockAlive);
      });
    });

    describe('doToggleBreakout', () => {
      it('makes the request as expected', async () => {
        breakouts.set('editLock', {
          ttl: 30,
          token: 'editToken',
          state: 'UNLOCKED',
        });
        const result = await breakouts.doToggleBreakout(true);
        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'url',
          body: {
            editlock: {
              token: 'editToken',
            },
            enableBreakoutSession: true,
          },
        });

        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });
    });

    describe('delete', () => {
      it('makes the request as expected', async () => {
        webex.request.returns(
          Promise.resolve({
            body: {
              groups: [
                {
                  id: '455556a4-37cd-4baa-89bc-8730581a1cc0',
                  status: 'CLOSE',
                  type: 'BREAKOUT',
                },
              ],
            },
          })
        );

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
          },
        });

        assert.equal(breakouts.groups[0].status, 'CLOSE');
      });

      it('rejects when edit lock token mismatch', async () => {
        webex.request.returns(
          Promise.reject({
            body: {
              errorCode: BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
              message: 'Edit lock token mismatch',
            },
          })
        );

        await assert.isRejected(
          breakouts.clearSessions(),
          BreakoutEditLockedError,
          'Edit lock token mismatch'
        );
      });
    });

    describe('create', () => {
      it('response not include groups info', async () => {
        const sessions = [{name: 'session1', anyoneCanJoin: true}];
        const result = await breakouts.create(sessions);

        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });

      it('response include groups info', async () => {
        const sessions = [{name: 'session1', anyoneCanJoin: true}];

        webex.request.returns(
          Promise.resolve({
            body: {
              groups: [
                {
                  id: '455556a4-37cd-4baa-89bc-8730581a1cc0',
                  status: 'PENDING',
                  type: 'BREAKOUT',
                },
              ],
            },
          })
        );

        const result = await breakouts.create(sessions);

        assert.equal(breakouts.groups[0].id, '455556a4-37cd-4baa-89bc-8730581a1cc0');
      });

      it('rejects when edit lock token mismatch', async () => {
        const sessions = [{name: 'session1', anyoneCanJoin: true}];

        webex.request.returns(
          Promise.reject({
            body: {
              errorCode: BREAKOUTS.ERROR_CODE.EDIT_LOCK_TOKEN_MISMATCH,
              message: 'Edit lock token mismatch',
            },
          })
        );

        await assert.isRejected(
          breakouts.create(sessions),
          BreakoutEditLockedError,
          'Edit lock token mismatch'
        );
      });
    });

    describe('enableAndLockBreakout', () => {
      it('enableBreakoutSession is true', async () => {
        breakouts.enableBreakoutSession = true;

        breakouts.lockBreakout = sinon.stub().resolves();

        breakouts.enableAndLockBreakout();

        assert.calledOnceWithExactly(breakouts.lockBreakout);
      });

      it('enableBreakoutSession is false', async () => {
        breakouts.enableBreakoutSession = false;

        breakouts.enableBreakouts = sinon.stub().resolves();

        breakouts.enableAndLockBreakout();

        assert.calledOnceWithExactly(breakouts.enableBreakouts);
      });
    });

    describe('lockBreakout', () => {
      it('lock breakout is true', async () => {
        breakouts.editLock = {
          ttl: 30,
          token: 'token',
          state: 'UNLOCKED',
        };

        breakouts.keepEditLockAlive = sinon.stub().resolves();

        breakouts.lockBreakout();

        assert.calledOnceWithExactly(breakouts.keepEditLockAlive);
      });

      it('lock breakout throw error', async () => {
        breakouts.editLock = {
          ttl: 30,
          token: '2ad57140-01b5-4bd0-a5a7-4dccdc06904c',
          state: 'LOCKED',
        };

        await expect(breakouts.lockBreakout()).to.be.rejectedWith('Breakout already locked');
      });

      it('lock breakout without editLock', async () => {
        breakouts.getBreakout = sinon.stub().resolves();

        breakouts.lockBreakout();

        assert.calledOnceWithExactly(breakouts.getBreakout, true);
      });
    });

    describe('unLockEditBreakout', () => {
      it('unLock edit breakout request as expected', async () => {
        breakouts.set('editLock', {
          ttl: 30,
          token: '2ad57140-01b5-4bd0-a5a7-4dccdc06904c',
          state: 'LOCKED',
        });

        breakouts.unLockEditBreakout();
        assert.calledOnceWithExactly(webex.request, {
          method: 'DELETE',
          uri: 'url/editlock/2ad57140-01b5-4bd0-a5a7-4dccdc06904c',
        });
      });

      it('do not call unLock if edit lock info not exist ', async () => {

        breakouts.unLockEditBreakout();
        assert.notCalled(webex.request);
      });
    });

    describe('keepEditLockAlive', () => {
      it('keep edit lock', () => {
        const clock = sinon.useFakeTimers();

        breakouts.set('editLock', {
          ttl: 30,
          token: 'token',
          state: 'UNLOCKED',
        });

        breakouts.keepEditLockAlive();
        clock.tick(15001);

        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'url/editlock/token',
        });

        clock.restore();
      });

      it('keep edit lock, ttl < 30, also using 30', () => {
        const clock = sinon.useFakeTimers();

        breakouts.set('editLock', {
          ttl: 20,
          token: 'token',
          state: 'UNLOCKED',
        });

        breakouts.keepEditLockAlive();
        clock.tick(15001);

        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'url/editlock/token',
        });

        clock.restore();
      });

      it('keep edit lock, ttl > 30, using the ttl', () => {
        const clock = sinon.useFakeTimers();

        breakouts.set('editLock', {
          ttl: 50,
          token: 'token',
          state: 'UNLOCKED',
        });

        breakouts.keepEditLockAlive();
        clock.tick(24099);

        assert.notCalled(webex.request);

        clock.restore();
      });

      it('keep edit lock, throw error, clearInterval', async () => {
        breakouts._clearEditLockInfo = sinon.stub();

        const error = new Error('something went wrong');
        webex.request.rejects(error);

        const clock = sinon.useFakeTimers();

        breakouts.set('editLock', {
          ttl: 30,
          token: 'token',
          state: 'UNLOCKED',
        });

        breakouts.keepEditLockAlive();
        clock.tick(15001);

        await testUtils.flushPromises();

        assert.calledOnceWithExactly(breakouts._clearEditLockInfo);

        clock.restore();
      });

      it('keep edit lock, do not call until reached ttl', () => {
        const clock = sinon.useFakeTimers();

        breakouts.set('editLock', {
          ttl: 30,
          token: 'token',
          state: 'UNLOCKED',
        });

        breakouts.keepEditLockAlive();
        clock.tick(14999);

        assert.notCalled(webex.request);

        clock.tick(1);
        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'url/editlock/token',
        });

        clock.restore();
      });

      it('clear interval first if previous one is in work', () => {
        breakouts.set('editLock', {
          ttl: 30,
          token: 'token',
        });
        const clock = sinon.useFakeTimers();
        window.clearInterval = sinon.stub();
        breakouts.keepEditLockAlive();
        const firstIntervalID = breakouts.intervalID;
        breakouts.keepEditLockAlive();

        assert.calledWithExactly(window.clearInterval, firstIntervalID);
        clock.restore();
      });
    });

    describe('#assign', () => {
      it('assign members and emails to a breakout session', async () => {
        breakouts.assign = sinon.stub().returns(Promise.resolve('ASSIGN_RETURN_VALUE'));
        const params = [
          {id: 'sessionId', memberIds: ['111'], emails: ['111@cisco.com'], anyone: true},
        ];
        const result = await breakouts.assign(params);
        assert.calledOnceWithExactly(breakouts.assign, params);
        assert.equal(result, 'ASSIGN_RETURN_VALUE');
      });
      it('assign only members to a breakout session', async () => {
        breakouts.assign = sinon.stub().returns(Promise.resolve('ASSIGN_RETURN_VALUE'));
        const params = [{id: 'sessionId', memberIds: ['111']}];
        const result = await breakouts.assign(params);
        assert.calledOnceWithExactly(breakouts.assign, params);
        assert.equal(result, 'ASSIGN_RETURN_VALUE');
      });
      it('assign only emails to a breakout session', async () => {
        breakouts.assign = sinon.stub().returns(Promise.resolve('ASSIGN_RETURN_VALUE'));
        const params = [{id: 'sessionId', emails: ['111@cisco.com']}];
        const result = await breakouts.assign(params);
        assert.calledOnceWithExactly(breakouts.assign, params);
        assert.equal(result, 'ASSIGN_RETURN_VALUE');
      });
    });

    describe('queryPreAssignments', () => {
      it('makes the expected query', async () => {
        webex.request.returns(
          Promise.resolve({
            body: {
              "groups": [
                {
                  "sessions": [
                    {
                      "name": "Breakout session 1",
                      "assignedEmails": [
                        "a@a.com",
                        "b@b.com",
                        "jial2@cisco.com"
                      ],
                      "anyoneCanJoin": false
                    },
                    {
                      "name": "Breakout session 2",
                      "anyoneCanJoin": false
                    },
                    {
                      "name": "Breakout session 3",
                      "assignedEmails": [
                        "c@c.com"
                      ],
                      "anyoneCanJoin": false
                    }
                  ],
                  "unassignedInvitees": {
                    "emails": [
                      "d@d.com"
                    ]
                  },
                  "type": "BREAKOUT"
                }
              ]
            }
          })
        );
        breakouts.shouldFetchPreassignments = false;
        const result = await breakouts.queryPreAssignments();
        const arg = webex.request.getCall(0).args[0];
        assert.equal(arg.uri, 'url/preassignments');
        assert.equal(breakouts.groups[0].unassignedInvitees.emails[0],'d@d.com');
        assert.equal(breakouts.groups[0].sessions[0].name,'Breakout session 1');
        assert.equal(breakouts.groups[0].sessions[0].anyoneCanJoin,false);
        assert.equal(breakouts.groups[0].sessions[0].assignedEmails.toString(), ["a@a.com", "b@b.com", "jial2@cisco.com"].toString());
        assert.equal(breakouts.groups[0].sessions[1].name,'Breakout session 2');
        assert.equal(breakouts.groups[0].sessions[1].anyoneCanJoin,false);
        assert.equal(breakouts.groups[0].sessions[1].assignedEmails, undefined);
        assert.equal(breakouts.groups[0].sessions[2].name,'Breakout session 3');
        assert.equal(breakouts.groups[0].sessions[2].anyoneCanJoin,false);
        assert.equal(breakouts.groups[0].sessions[2].assignedEmails[0], 'c@c.com');
        assert.equal(breakouts.groups[0].unassignedInvitees.emails[0],'d@d.com');
        assert.equal(breakouts.groups[0].type,'BREAKOUT');
        assert.equal(breakouts.shouldFetchPreassignments, true);
      });

      it('rejects when no pre-assignments created for this meeting', async () => {
        const response = {
          statusCode: 404,
          body: {
            errorCode: 201404004,
            message: 'No pre-assignments created for this meeting'
          },
        };
        webex.request.rejects(response);
        LoggerProxy.logger.error = sinon.stub();
        const result = await breakouts.queryPreAssignments();
        await testUtils.flushPromises();
        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:breakouts#queryPreAssignments failed',
          response
        );
     });
  });

    describe('#dynamicAssign', () => {
      it('should make a PUT request with correct body and return the result', async () => {
        breakouts.dynamicAssign = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));

        const expectedBody = {
          groups: [
            {
              id: 'breakoutGroup1',
              sessions: [
                {
                  id: 'session1',
                  participants: ['participant1', 'participant2'],
                  targetState: 'JOINED',
                },
              ],
            },
          ],
          editlock: {
            token: 'abcdefg',
          },
        };

        const result = await breakouts.dynamicAssign(expectedBody);

        assert.calledOnceWithExactly(breakouts.dynamicAssign, expectedBody);
        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });
    });

  });
});
