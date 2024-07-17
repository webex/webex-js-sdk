import {assert, expect} from '@webex/test-helper-chai';
import Breakouts from '@webex/plugin-meetings/src/breakouts';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import {BREAKOUTS} from '@webex/plugin-meetings/src/constants';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import testUtils from '../../../utils/testUtils';
import BreakoutEditLockedError from '@webex/plugin-meetings/src/breakouts/edit-lock-error';
import breakoutEvent from '../../../../src/breakouts/events';

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
    editlock: {
      state: 'LOCKED',
      ttl: 30,
      userId: 'cc5d452f-04b6-4876-a4c3-28ca21982c6a',
      token: withOutToken ? '' : 'token1',
    },
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
      webex.internal.llm.isConnected = sinon.stub();
      webex.internal.mercury.on = sinon.stub();
      breakouts = new Breakouts({}, {parent: webex});
      breakouts.groupId = 'groupId';
      breakouts.sessionId = 'sessionId';
      breakouts.url = 'url';
      breakouts.locusUrl = 'locusUrl';
      breakouts.breakoutServiceUrl = 'breakoutServiceUrl';
      webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
      webex.meetings = {};
      webex.meetings.getMeetingByType = sinon.stub();
    });

    describe('#initialize', () => {
      it('creates Breakouts as expected', () => {
        assert.equal(breakouts.namespace, 'Meetings');
      });

      it('emits BREAKOUTS_CLOSING event when the breakoutStatus is CLOSING', () => {
        const checkIsCalled = (prev, deps) => {
          breakouts.set(prev);
          const breakoutClosingHandler = sinon.stub();
          breakouts.listenTo(breakouts, BREAKOUTS.EVENTS.BREAKOUTS_CLOSING, breakoutClosingHandler);
          assert.notCalled(breakoutClosingHandler);
          breakouts.set(deps);
          assert.calledOnce(breakoutClosingHandler);
        }

        checkIsCalled({sessionType: BREAKOUTS.SESSION_TYPES.MAIN, groups: undefined, status: undefined}, {
          sessionType: BREAKOUTS.SESSION_TYPES.MAIN,
          groups: [{status: BREAKOUTS.STATUS.CLOSING}],
          status: undefined
        });

        checkIsCalled({sessionType: BREAKOUTS.SESSION_TYPES.MAIN, groups: [{status: BREAKOUTS.STATUS.OPEN}], status: undefined}, {
          sessionType: BREAKOUTS.SESSION_TYPES.MAIN,
          groups: [{status: BREAKOUTS.STATUS.CLOSING}],
          status: undefined
        });

        checkIsCalled({sessionType: BREAKOUTS.SESSION_TYPES.BREAKOUT, groups: undefined, status: undefined}, {
          sessionType: BREAKOUTS.SESSION_TYPES.BREAKOUT,
          groups: undefined,
          status: BREAKOUTS.STATUS.CLOSING
        });

        checkIsCalled({sessionType: BREAKOUTS.SESSION_TYPES.BREAKOUT, groups: undefined, status: BREAKOUTS.STATUS.OPEN}, {
          sessionType: BREAKOUTS.SESSION_TYPES.BREAKOUT,
          groups: undefined,
          status: BREAKOUTS.STATUS.CLOSING
        });

      });

      it('should not emits BREAKOUTS_CLOSING event when just sessionType changed from BREAKOUT to MAIN', () => {
        breakouts.set({
          sessionType: BREAKOUTS.SESSION_TYPES.BREAKOUT,
          groups: undefined,
          status: BREAKOUTS.STATUS.CLOSING
        });

        const breakoutClosingHandler = sinon.stub();
        breakouts.listenTo(breakouts, BREAKOUTS.EVENTS.BREAKOUTS_CLOSING, breakoutClosingHandler);

        breakouts.set({
          sessionType: BREAKOUTS.SESSION_TYPES.MAIN,
          groups: [{status: BREAKOUTS.STATUS.CLOSING}],
          status: undefined
        });

        assert.notCalled(breakoutClosingHandler);
      });

      it('debounces querying rosters on add', () => {
        breakouts.debouncedQueryRosters = sinon.stub();
        breakouts.breakouts.add({sessionType: 'MAIN'});

        assert.calledOnceWithExactly(breakouts.debouncedQueryRosters);
      });

      it('call triggerReturnToMainEvent correctly when requested breakout add', () => {
        breakouts.triggerReturnToMainEvent = sinon.stub();
        breakouts.breakouts.add({sessionId: 'session1', sessionType: 'MAIN'});
        assert.calledOnceWithExactly(breakouts.triggerReturnToMainEvent, breakouts.breakouts.get('session1'));
      });

      it('call triggerReturnToMainEvent correctly when breakout requestedLastModifiedTime change', () => {
        breakouts.breakouts.add({sessionId: 'session1', sessionType: 'MAIN'});
        breakouts.triggerReturnToMainEvent = sinon.stub();
        breakouts.breakouts.get('session1').set({requestedLastModifiedTime: "2023-05-09T17:16:01.000Z"});
        assert.calledOnceWithExactly(breakouts.triggerReturnToMainEvent, breakouts.breakouts.get('session1'));
      });

      it('call queryPreAssignments correctly when should query preAssignments is true', () => {
        breakouts.queryPreAssignments = sinon.stub();
        breakouts.set({
          canManageBreakouts: true,
          enableBreakoutSession: true,
          hasBreakoutPreAssignments: true,
        });
        assert.calledThrice(breakouts.queryPreAssignments);
      });
    });

    describe('#listenToCurrentSessionTypeChange', () => {
      it('triggers leave breakout event when sessionType changed from SESSION to MAIN', () => {
        const handler = sinon.stub();
        breakouts.currentBreakoutSession.set({sessionType: BREAKOUTS.SESSION_TYPES.BREAKOUT})
        breakouts.listenTo(breakouts, BREAKOUTS.EVENTS.LEAVE_BREAKOUT, handler);
        breakouts.currentBreakoutSession.set({sessionType: BREAKOUTS.SESSION_TYPES.MAIN});

        assert.calledOnceWithExactly(handler);

        breakouts.stopListening(breakouts, BREAKOUTS.EVENTS.LEAVE_BREAKOUT, handler);
      });

      it('should not triggers leave breakout event when sessionType changed from undefined to MAIN', () => {
        const handler = sinon.stub();
        breakouts.currentBreakoutSession.set({sessionType: undefined})
        breakouts.listenTo(breakouts, BREAKOUTS.EVENTS.LEAVE_BREAKOUT, handler);
        breakouts.currentBreakoutSession.set({sessionType: BREAKOUTS.SESSION_TYPES.MAIN});

        assert.notCalled(handler);

        breakouts.stopListening(breakouts, BREAKOUTS.EVENTS.LEAVE_BREAKOUT, handler);
      });

      it('should not triggers leave breakout event when sessionType changed from MAIN to SESSION', () => {
        const handler = sinon.stub();
        breakouts.currentBreakoutSession.set({sessionType: BREAKOUTS.SESSION_TYPES.MAIN})
        breakouts.listenTo(breakouts, BREAKOUTS.EVENTS.LEAVE_BREAKOUT, handler);
        breakouts.currentBreakoutSession.set({sessionType: BREAKOUTS.SESSION_TYPES.BREAKOUT});

        assert.notCalled(handler);

        breakouts.stopListening(breakouts, BREAKOUTS.EVENTS.LEAVE_BREAKOUT, handler);
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

    describe('#listenToBreakoutHelp', () => {
      it('triggers ask for help event when a help received', () => {
        const call = webex.internal.mercury.on.getCall(1);
        const callback = call.args[1];

        assert.equal(call.args[0], 'event:breakout.help');

        let data;

        breakouts.listenTo(breakouts, BREAKOUTS.EVENTS.ASK_FOR_HELP, (eventData) => {
          data = eventData;
        });

        callback({
          data: {
            participant: 'participant',
            sessionId: 'sessionId'
          },
        });

        assert.deepEqual(data, {
          participant: 'participant',
          sessionId: 'sessionId',
        });
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

      it('update the startTime correctly when no attribute startTime exists on params', () => {
        breakouts.updateBreakout({
          startTime: "startTime"
        })
        assert.equal(breakouts.startTime, 'startTime');

        breakouts.updateBreakout({})
        assert.equal(breakouts.startTime, undefined);
      });

      it('update the status correctly when no attribute status exists on params', () => {
        breakouts.updateBreakout({
          status: 'CLOSING'
        })
        assert.equal(breakouts.status, 'CLOSING');

        breakouts.updateBreakout({})
        assert.equal(breakouts.status, undefined);
      });

      it('call clearBreakouts if current breakout is not in-progress', () => {
        breakouts.clearBreakouts = sinon.stub();
        breakouts.updateBreakout({status: 'CLOSED'})
        assert.calledOnce(breakouts.clearBreakouts);
      });

      it('updates the current breakout session, call onBreakoutJoinResponse when session changed', () => {
        breakouts.webex.meetings = {
          getMeetingByType: sinon.stub().returns({
            id: 'meeting-id'
          })
        };
        const onBreakoutJoinResponseSpy = sinon.stub(breakoutEvent,'onBreakoutJoinResponse')
        breakouts.currentBreakoutSession.sessionId = "sessionId-old";
        breakouts.updateBreakout({
          sessionId: 'sessionId-new',
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
          breakoutMoveId: 'breakoutMoveId',
        });

        assert.calledOnce(onBreakoutJoinResponseSpy);

        onBreakoutJoinResponseSpy.restore()

      });

      it('updates the current breakout session, not call onBreakoutJoinResponse when session no changed', () => {
        breakouts.webex.meetings = {
          getMeetingByType: sinon.stub().returns({
            id: 'meeting-id'
          })
        };
        const onBreakoutJoinResponseSpy = sinon.stub(breakoutEvent, 'onBreakoutJoinResponse');
        breakouts.currentBreakoutSession.sessionId = "sessionId";
        breakouts.currentBreakoutSession.groupId = "groupId";
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
          breakoutMoveId: 'breakoutMoveId',
        });

        assert.notCalled(onBreakoutJoinResponseSpy);
        onBreakoutJoinResponseSpy.restore()

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
        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN);
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

      it('set requestedLastModifiedTime correctly', () => {
        const payload = {
          breakoutSessions: {
            assigned: [{sessionId: 'sessionId1'}],
            requested: [{sessionId: 'sessionId2', modifiedAt: "2023-05-09T17:16:01.000Z"}],
          },
        };

        breakouts.updateBreakoutSessions(payload);
        assert.equal(breakouts.breakouts.get('sessionId1').requestedLastModifiedTime, undefined)
        assert.equal(breakouts.breakouts.get('sessionId2').requestedLastModifiedTime, "2023-05-09T17:16:01.000Z")
      });

      it('not update breakout sessions when breakouts is closing', () => {
        breakouts.set('status', 'CLOSING');
        breakouts.breakouts.set = sinon.stub();
        breakouts.updateBreakoutSessions({breakoutSessions: {}});
        assert.notCalled(breakouts.breakouts.set);
      });
    });

    describe('#locusUrlUpdate', () => {
      it('sets the locus url', () => {
        breakouts.locusUrlUpdate('newUrl');
        assert.equal(breakouts.locusUrl, 'newUrl');
      });
    });

    describe('#listenToBroadcastMessages', () => {
      it('do not subscribe message if llm not connected', () => {
        webex.internal.llm.isConnected = sinon.stub().returns(false);
        breakouts.listenTo = sinon.stub();
        breakouts.locusUrlUpdate('newUrl');
        assert.equal(breakouts.locusUrl, 'newUrl');
        assert.notCalled(breakouts.listenTo);
      });

      it('do not subscribe message if already done', () => {
        webex.internal.llm.isConnected = sinon.stub().returns(true);
        breakouts.hasSubscribedToMessage = true;
        breakouts.listenTo = sinon.stub();
        breakouts.locusUrlUpdate('newUrl');
        assert.equal(breakouts.locusUrl, 'newUrl');
        assert.notCalled(breakouts.listenTo);
      });

      it('triggers message event when a message received', () => {
        webex.internal.llm.isConnected = sinon.stub().returns(true);
        breakouts.locusUrlUpdate('newUrl');
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

    describe('#updateCanManageBreakouts', () => {
      it('update canManageBreakouts', () => {
        breakouts.updateCanManageBreakouts(true);

        assert.equal(breakouts.canManageBreakouts, true);

        breakouts.updateCanManageBreakouts(false);

        assert.equal(breakouts.canManageBreakouts, false);
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

    describe('#breakoutGroupId', () => {
      it('return empty breakout group id for managing breakouts if no data', () => {
        assert.equal(breakouts.breakoutGroupId, '');
        breakouts.set('manageGroups', []);
        assert.equal(breakouts.breakoutGroupId, '');
        breakouts.set('manageGroups', [{name: 'test'}]);
        assert.equal(breakouts.breakoutGroupId, undefined);
      });
      it('return the group id if has id in manageGroups', () => {
        breakouts.set('manageGroups', [{id: 'groupId1'}]);
        assert.equal(breakouts.breakoutGroupId, 'groupId1');
      });
      it('return empty group id if group status is CLOSED', () => {
        breakouts.set('manageGroups', [{id: 'groupId1', status: 'CLOSED'}]);
        assert.equal(breakouts.breakoutGroupId, '');
      });
    });

    describe('#shouldQueryPreAssignments', () => {
      it('returns should query preAssignments depends on status', () => {
        assert.equal(breakouts.shouldQueryPreAssignments, false);
        breakouts.set('canManageBreakouts', true);
        assert.equal(breakouts.shouldQueryPreAssignments, false);
        breakouts.set('enableBreakoutSession', true);
        assert.equal(breakouts.shouldQueryPreAssignments, false);
        breakouts.set('hasBreakoutPreAssignments', true);
        assert.equal(breakouts.shouldQueryPreAssignments, true);
      });
    });

    describe('#breakoutStatus', () => {
      it('return status from groups with session type', () => {
        breakouts.set('groups', [{status: "OPEN"}]);
        breakouts.set('status', "CLOSED");
        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN);

        assert.equal(breakouts.breakoutStatus, "OPEN")

        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.BREAKOUT);

        assert.equal(breakouts.breakoutStatus, "CLOSED")
      });
    });

    describe('#_setManageGroups', () => {
      it('do nothing if breakout info is empty', () => {
        breakouts._setManageGroups();
        assert.equal(breakouts.manageGroups, undefined);
        breakouts._setManageGroups({body: null});
        assert.equal(breakouts.manageGroups, undefined);
        breakouts._setManageGroups({body: {groups: null}});
        assert.equal(breakouts.manageGroups, undefined);
      });
      it('set the groups into manageGroups if has groups in side breakout info', () => {
        breakouts._setManageGroups({body: {groups: [{id: 'groupId1'}]}});
        assert.deepEqual(breakouts.manageGroups, [{id: 'groupId1'}]);
      });
    });

    describe('#isBreakoutInProgress', () => {
      it('return breakout is in progress depends on the status(groups/breakouts)', () => {
        breakouts.set('groups', [{status: 'CLOSING'}]);

        assert.equal(breakouts.isBreakoutInProgress(), true)

        breakouts.set('groups', undefined);
        breakouts.set('status', 'OPEN');

        assert.equal(breakouts.isBreakoutInProgress(), true);

        breakouts.set('groups', [{status: 'CLOSED'}]);

        assert.equal(breakouts.isBreakoutInProgress(), false);

        breakouts.set('groups', undefined);
        breakouts.set('status', 'CLOSED');

        assert.equal(breakouts.isBreakoutInProgress(), false);

        breakouts.set('status', undefined);

        assert.equal(breakouts.isBreakoutInProgress(), false);
      });
    });

    describe('#isBreakoutIClosing', () => {
      it('return breakout is closing depends the status(groups/breakouts)', () => {
        breakouts.set('groups', [{status: 'CLOSING'}]);

        assert.equal(breakouts.isBreakoutIClosing(), true);

        breakouts.set('groups', undefined);
        breakouts.set('status', 'CLOSING');

        assert.equal(breakouts.isBreakoutIClosing(), true);

        breakouts.set('status', undefined);

        assert.equal(breakouts.isBreakoutIClosing(), false);

        breakouts.set('groups', [{status: 'OPEN'}]);

        assert.equal(breakouts.isBreakoutIClosing(), false);
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

    describe('#clearBreakouts', () => {
      it('call reset to clear breakouts', () => {
        breakouts.set('breakouts', [{id: 'session1'}]);
        breakouts.breakouts.reset = sinon.stub();
        breakouts.clearBreakouts();
        assert.calledWith(breakouts.breakouts.reset);
      });

      it('do nothing if breakouts already is empty', () => {
        breakouts.set('breakouts', []);
        breakouts.breakouts.reset = sinon.stub();
        breakouts.clearBreakouts();
        assert.notCalled(breakouts.breakouts.reset);
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

        breakouts.set('sessionType', BREAKOUTS.SESSION_TYPES.MAIN);
        breakouts.updateBreakoutSessions(payload);
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
      const mockEnableResponse = {
        body: {
          sessionId: 'sessionId',
          groupId: 'groupId',
          name: 'name',
          current: true,
          sessionType: 'sessionType',
          url: 'url',
        },
      };
      it('enableBreakoutSession is undefined, run enableBreakouts then toggleBreakout', async () => {
        breakouts.enableBreakoutSession = undefined;
        breakouts.enableBreakouts = sinon.stub().resolves(mockEnableResponse);
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

      it('first time enable breakouts, call updateBreakout to set initial params', async () => {
        breakouts.enableBreakoutSession = undefined;
        breakouts.enableBreakouts = sinon.stub().resolves(mockEnableResponse);
        breakouts.updateBreakout = sinon.stub().resolves();
        breakouts.doToggleBreakout = sinon.stub();

        await breakouts.toggleBreakout(true);
        assert.calledOnceWithExactly(breakouts.updateBreakout, {
          sessionId: 'sessionId',
          groupId: 'groupId',
          name: 'name',
          current: true,
          sessionType: 'sessionType',
          url: 'url',
        });

        assert.notCalled(breakouts.doToggleBreakout);
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
        const mockedReturnBody = getBOResponse('OPEN');
        webex.request.returns(
          Promise.resolve({
            body: mockedReturnBody,
          })
        );
        breakouts.editLock = {
          token: 'token1',
        };
        const params = {
          id: 'groupId',
          sessions: [{name: 'Session 1'}],
        };
        breakouts._setManageGroups = sinon.stub();
        const result = await breakouts.update(params);
        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'url',
          body: {
            editlock: {token: 'token1', refresh: true},
            groups: [params],
          },
        });
        assert.calledOnceWithExactly(breakouts._setManageGroups, {
          body: mockedReturnBody,
        });
      });
      it('makes the request as expected when unlockEdit is true', async () => {
        breakouts.editLock = {
          token: 'token1',
        };
        const params = {
          id: 'groupId',
          sessions: [{name: 'Session 1'}],
        };
        breakouts._clearEditLockInfo = sinon.stub();
        const result = await breakouts.update(params, true);
        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'url',
          body: {
            editlock: {token: 'token1', refresh: false},
            groups: [params],
          },
        });
        assert.calledOnceWithExactly(breakouts._clearEditLockInfo);
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
          'Breakouts#update --> Edit lock token mismatch'
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
          'Breakouts#update --> Not authorized to interact with edit lock'
        );
      });

      it('rejects when other unknow error', async () => {
        const mockError = new Error('something wrong');
        webex.request.returns(Promise.reject(mockError));
        LoggerProxy.logger.info = sinon.stub();

        const params = {
          id: 'groupId',
          sessions: [{name: 'Session 1'}],
        };

        await assert.isRejected(breakouts.update(params), mockError, 'something wrong');

        assert.calledOnceWithExactly(
          LoggerProxy.logger.info,
          'Breakouts#update --> something wrong'
        );
      });
    });

    describe('#start', () => {
      it('should start breakout sessions', async () => {
        const mockedReturnBody = getBOResponse('OPEN');
        webex.request.returns(
          Promise.resolve({
            body: mockedReturnBody,
          })
        );

        breakouts.set('url', 'url');
        await breakouts.getBreakout();

        const result = await breakouts.start();
        breakouts._setManageGroups = sinon.stub();
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
        });
        assert.deepEqual(argObj2, {
          id: 'id',
          action: 'START',
          allowBackToMain: false,
          allowToJoinLater: false,
          someOtherParam: 'someOtherParam',
        });
        assert.deepEqual(result, {body: mockedReturnBody});
        assert.calledWithExactly(breakouts._setManageGroups, {body: mockedReturnBody})
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

        breakouts._setManageGroups = sinon.stub();
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
        assert.calledOnceWithExactly(breakouts._setManageGroups, {body: getBOResponse('CLOSING')});
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

        breakouts._setManageGroups = sinon.stub();
        await breakouts.getBreakout(true);
        const arg1 = webex.request.getCall(0).args[0];
        const arg2 = webex.request.getCall(1).args[0];

        assert.equal(arg1.uri, 'url');
        assert.equal(arg2.uri, 'url?editlock=true');
        assert.equal(arg1.method, 'GET');
        assert.deepEqual(result, {body: getBOResponse('PENDING')});
        assert.deepEqual(breakouts.manageGroups, result.body.groups);
        assert.equal(breakouts.breakoutGroupId, 'groupId');
        assert.calledOnceWithExactly(breakouts._setManageGroups, {body: getBOResponse('PENDING')});
      });

      it('breakoutGroupId should be empty if it is CLOSED group', async () => {
        webex.request.returns(
          Promise.resolve({
            body: getBOResponse('CLOSED'),
          })
        );

        breakouts.set('url', 'url');
        await breakouts.getBreakout();

        assert.equal(breakouts.breakoutGroupId, '');
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

        breakouts._setManageGroups = sinon.stub();
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

        assert.calledOnceWithExactly(breakouts._setManageGroups, {
          body: {
            groups: [
              {
                id: '455556a4-37cd-4baa-89bc-8730581a1cc0',
                status: 'CLOSE',
                type: 'BREAKOUT',
              },
            ],
          },
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
        const result = await breakouts.create({sessions});

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

        const result = await breakouts.create({sessions});

        assert.equal(breakouts.manageGroups[0].id, '455556a4-37cd-4baa-89bc-8730581a1cc0');
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
          breakouts.create({sessions}),
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

    describe('hasBreakoutLocked', () => {
      it('has breakout locked is true', async () => {
        breakouts.editLock = {
          ttl: 30,
          token: 'token',
          state: 'LOCKED',
        };

        assert.equal(breakouts.hasBreakoutLocked(), true);
      });

      it('breakout locked by others', async () => {
        breakouts.editLock = {
          ttl: 30,
          token: '',
          state: 'LOCKED',
        };

        assert.equal(breakouts.hasBreakoutLocked(), false);
      });

      it('breakout not locked', async () => {
        breakouts.editLock = {
          ttl: 30,
          token: '',
          state: 'UNLOCKED',
        };

        assert.equal(breakouts.hasBreakoutLocked(), false);
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

      it('called with editlock', async () => {
        breakouts.request = sinon.stub().returns(Promise.resolve('ASSIGN_RETURN_VALUE'));
        breakouts.editLock = {
          token: 'token1',
        };
        const params = [{id: 'sessionId', emails: ['111@cisco.com'], memberIds: []}];
        await breakouts.assign(params);
        const args = breakouts.request.getCall(0).args[0];
        expect(args).to.be.an('object', {
          method: 'PUT',
          uri: 'url',
          body: {
            editlock: {token: 'token1', refresh: true},
            groups: {
              id: 'sessionId',
              sessions: [
                {
                  id: 'sessionId',
                  assigned: [],
                  assignedEmails: ['111@cisco.com'],
                  anyoneCanJoin: false,
                },
              ],
            },
          },
        });
      });
    });

    describe('#queryPreAssignments', () => {
      it('makes the expected query', async () => {
        const mockPreAssignments = [
            {
              sessions: [
                {
                  name: 'Breakout session 1',
                  assignedEmails: ['aa@aa.com', 'bb@bb.com', 'cc@cc.com'],
                  anyoneCanJoin: false,
                },
                {
                  name: 'Breakout session 2',
                  anyoneCanJoin: false,
                },
                {
                  name: 'Breakout session 3',
                  assignedEmails: ['cc@cc.com'],
                  anyoneCanJoin: false,
                },
              ],
              unassignedInvitees: {
                emails: ['dd@dd.com'],
              },
              type: 'BREAKOUT',
            },
          ];
        webex.request.returns(
          Promise.resolve({
            body: {
              groups: mockPreAssignments,
            },
          })
        );
        breakouts.set('locusUrl', 'test');

        await breakouts.queryPreAssignments();
        assert.calledOnceWithExactly(webex.request, {
          uri: 'url/preassignments',
          qs: {
            locusUrl: 'dGVzdA==',
          }
        });

        assert.deepEqual(breakouts.preAssignments, mockPreAssignments);
      });

      it('rejects when no pre-assignments created for this meeting', async () => {
        const response = {
          statusCode: 404,
          body: {
            errorCode: 201404004,
            message: 'No pre-assignments created for this meeting',
          },
        };
        webex.request.rejects(response);
        LoggerProxy.logger.error = sinon.stub();
        const result = await breakouts.queryPreAssignments({enableBreakoutSession: true, hasBreakoutPreAssignments: true});
        await testUtils.flushPromises();
        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:breakouts#queryPreAssignments failed',
          response
        );
      });

      it('fail when no correct params',  () => {

        assert.deepEqual(breakouts.queryPreAssignments(undefined), undefined);

        assert.deepEqual(breakouts.queryPreAssignments({}), undefined);

        assert.deepEqual(breakouts.queryPreAssignments({ enableBreakoutSession: true, hasBreakoutPreAssignments: false }), undefined);

        assert.deepEqual(breakouts.queryPreAssignments({ enableBreakoutSession: false, hasBreakoutPreAssignments: true }), undefined);

        assert.deepEqual(breakouts.queryPreAssignments({ enableBreakoutSession: false, hasBreakoutPreAssignments: false }), undefined);

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

    describe('#triggerReturnToMainEvent', () => {
      const checkTrigger = ({breakout, shouldTrigger}) => {
        breakouts.trigger = sinon.stub();
        breakouts.triggerReturnToMainEvent(breakout);
        if (shouldTrigger) {
          assert.calledOnceWithExactly(breakouts.trigger, BREAKOUTS.EVENTS.ASK_RETURN_TO_MAIN);
        } else {
          assert.notCalled(breakouts.trigger);
        }
      }
      it('should trigger ASK_RETURN_TO_MAIN event correctly', () => {
        const breakout = {
          isMain: true,
          requested: true
        };
        checkTrigger({breakout, shouldTrigger: true})
      });

      it('should not trigger ASK_RETURN_TO_MAIN event when sessionType is not MAIN', () => {
        const breakout = {
          isMain: false,
          requested: true
        };
        checkTrigger({breakout, shouldTrigger: false});
      });

      it('should not trigger ASK_RETURN_TO_MAIN event when session is not requested', () => {
        const breakout = {
          isMain: true,
          requested: false
        };
        checkTrigger({breakout, shouldTrigger: false})
      });
    });
  });
});
