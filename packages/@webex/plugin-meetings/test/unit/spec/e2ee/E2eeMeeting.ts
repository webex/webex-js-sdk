/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import E2eeMeeting from '@webex/plugin-meetings/src/e2ee/E2eeMeeting';
import MlsGroupSession from '@webex/plugin-meetings/src/e2ee/MlsGroupSession';
import E2eeSignaling from '@webex/plugin-meetings/src/e2ee/E2eeSignaling';
import Trigger from '@webex/plugin-meetings/src/common/events/trigger-proxy';
import {EVENT_TRIGGERS} from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings', () => {
  describe('E2eeMeeting', () => {
    let webex;
    let meeting;
    let membersById;
    let wasmLoader;
    let identityProvider;
    let config;
    let e2ee;
    let sessionHandlers;
    let rosterStub;
    let initializeStub;
    let joinStub;
    let leaveStub;
    let signalingStartStub;
    let signalingStopStub;
    let triggerStub;

    const OWN_DEVICE_URL = 'https://wdm.webex.com/device-1';

    const emitSession = (event, payload) => sessionHandlers[event]?.(payload);

    const makeFakeMember = (id, deviceUrls) => ({
      id,
      participant: {devices: deviceUrls.map((url) => ({url}))},
      e2eeVerificationState: 'unknown',
      setE2eeDeviceVerifications: sinon.stub(),
      setE2eeDeviceVerification: sinon.stub().returns(true),
      removeE2eeDeviceVerification: sinon.stub().returns(true),
      getE2eeDeviceVerifications: sinon.stub().returns([]),
    });

    beforeEach(() => {
      sessionHandlers = {};
      membersById = {};
      initializeStub = sinon.stub(MlsGroupSession.prototype, 'initialize').resolves();
      joinStub = sinon.stub(MlsGroupSession.prototype, 'join');
      leaveStub = sinon.stub(MlsGroupSession.prototype, 'leave');
      rosterStub = sinon.stub(MlsGroupSession.prototype, 'getRoster').returns([]);
      sinon.stub(MlsGroupSession.prototype, 'on').callsFake((event, handler) => {
        sessionHandlers[event] = handler;
      });
      signalingStartStub = sinon.stub(E2eeSignaling.prototype, 'start');
      signalingStopStub = sinon.stub(E2eeSignaling.prototype, 'stop');
      triggerStub = sinon.stub(Trigger, 'trigger');

      wasmLoader = {
        get: sinon.stub().resolves({}),
        preload: sinon.stub().resolves(),
        isLoaded: sinon.stub().returns(true),
      };
      identityProvider = {
        getCredentials: sinon
          .stub()
          .resolves({privateKey: new Uint8Array([1]), certChain: [new ArrayBuffer(1)]}),
        getTrustAnchors: sinon
          .stub()
          .returns({webexCaRoots: 'ca', domainNameRoots: '', userIdentityRoots: ''}),
      };
      webex = {
        internal: {
          device: {userId: 'user-1', url: OWN_DEVICE_URL},
          llm: {on: sinon.stub(), off: sinon.stub(), isConnected: sinon.stub().returns(false)},
          mercury: {on: sinon.stub(), off: sinon.stub()},
        },
        request: sinon.stub().resolves({body: ''}),
      };
      meeting = {
        correlationId: 'corr-1',
        locusInfo: {
          info: {isV2E2EEncrypted: true, mediaEncryptionGroupUrl: 'https://mes.webex.com/group-1'},
        },
        members: {
          selfId: 's1',
          membersCollection: {
            get: (id) => (id === 's1' ? {name: 'Alice'} : membersById[id]),
            getAll: () => membersById,
            getMemberByDeviceUrl: (url) =>
              Object.values(membersById).find((member) =>
                member.participant?.devices?.some((device) => device.url === url)
              ),
          },
          setMembersUpdateProcessor: sinon.stub(),
          reportMembersUpdated: sinon.stub(),
        },
      };
      config = {enableE2ee: true};

      e2ee = new E2eeMeeting({meeting, webex, wasmLoader, identityProvider, config});
    });

    afterEach(() => {
      sinon.restore();
    });

    const emitted = (event) =>
      triggerStub.getCalls().filter((call) => call.args[2] === event);

    describe('start guard (required)', () => {
      it('is a no-op when E2EE is disabled in config', async () => {
        config.enableE2ee = false;

        await e2ee.start();

        assert.equal(e2ee.state, 'disabled');
        assert.notCalled(initializeStub);
      });

      it('is a no-op when the meeting is not V2 E2E encrypted', async () => {
        meeting.locusInfo.info.isV2E2EEncrypted = false;

        await e2ee.start();

        assert.equal(e2ee.state, 'disabled');
        assert.notCalled(initializeStub);
      });

      it('is a no-op when there is no media-encryption group url', async () => {
        meeting.locusInfo.info.mediaEncryptionGroupUrl = undefined;

        await e2ee.start();

        assert.equal(e2ee.state, 'disabled');
        assert.notCalled(initializeStub);
      });
    });

    describe('start (happy path)', () => {
      it('initializes the session, starts signaling, joins and moves to joining', async () => {
        await e2ee.start();

        assert.calledOnceWithExactly(identityProvider.getCredentials, 'user-1');

        const initConfig = initializeStub.firstCall.args[0];

        assert.equal(initConfig.participantId, 'user-1');
        assert.equal(initConfig.deviceUrl, OWN_DEVICE_URL);
        assert.equal(initConfig.deviceType, 'WEB');
        assert.equal(initConfig.correlationId, 'corr-1');
        assert.equal(initConfig.displayName, 'Alice');
        assert.equal(initConfig.serviceUrl, 'https://mes.webex.com/group-1');
        assert.deepEqual(initConfig.trustAnchors, {
          webexCaRoots: 'ca',
          domainNameRoots: '',
          userIdentityRoots: '',
        });

        assert.calledOnce(signalingStartStub);
        assert.calledOnce(joinStub);
        assert.equal(e2ee.state, 'joining');
      });

      it('transitions to failed and emits a failure when start throws', async () => {
        identityProvider.getCredentials.rejects(new Error('CA down'));

        await e2ee.start();

        assert.equal(e2ee.state, 'failed');
        assert.equal(emitted(EVENT_TRIGGERS.MEETING_E2EE_FAILURE).length, 1);
        assert.notCalled(joinStub);
      });
    });

    describe('session events', () => {
      beforeEach(async () => {
        await e2ee.start();
      });

      it('records the security code and emits on joinSuccess', () => {
        emitSession('joinSuccess', {securityCode: 'SEC-1'});

        assert.equal(e2ee.getSecurityCode(), 'SEC-1');
        const calls = emitted(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED);

        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].args[3], {securityCode: 'SEC-1'});
      });

      it('updates the security code on securityCodeChanged', () => {
        emitSession('securityCodeChanged', {code: 'SEC-2'});

        assert.equal(e2ee.getSecurityCode(), 'SEC-2');
        assert.equal(emitted(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED).length, 1);
      });

      it('marks joined only once our own device url is in the roster', () => {
        rosterStub.returns([{url: 'other', deviceType: 'WEB', displayName: '', validationResult: 0}]);
        emitSession('rosterAdded', []);
        assert.equal(e2ee.state, 'joining');

        rosterStub.returns([
          {url: OWN_DEVICE_URL, deviceType: 'WEB', displayName: '', validationResult: 0},
        ]);
        emitSession('rosterAdded', []);
        assert.equal(e2ee.state, 'joined');

        const stateCalls = emitted(EVENT_TRIGGERS.MEETING_E2EE_STATE_CHANGED);

        assert.deepEqual(stateCalls[stateCalls.length - 1].args[3], {state: 'joined'});
      });

      it('detects media services in the roster and emits a change', () => {
        assert.isFalse(e2ee.hasMediaServices);

        rosterStub.returns([
          {url: 'ms', deviceType: 'MEDIA_SERVICE', displayName: '', validationResult: 0},
        ]);
        emitSession('rosterAdded', []);

        assert.isTrue(e2ee.hasMediaServices);
        const calls = emitted(EVENT_TRIGGERS.MEETING_E2EE_MEDIA_SERVICES_CHANGED);

        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].args[3], {hasMediaServices: true});
      });

      it('goes to failed on joinFailure and evicted on evicted', () => {
        emitSession('joinFailure', {reason: 'join_failure'});
        assert.equal(e2ee.state, 'failed');

        emitSession('evicted');
        assert.equal(e2ee.state, 'evicted');
        assert.equal(emitted(EVENT_TRIGGERS.MEETING_E2EE_FAILURE).length, 2);
      });
    });

    describe('roster reconciliation (verification)', () => {
      const rosterEntry = {
        url: OWN_DEVICE_URL,
        deviceType: 'WEB',
        displayName: 'Alice',
        validationResult: 0,
      };
      const expectedVerification = {
        deviceUrl: OWN_DEVICE_URL,
        verified: true,
        validationResult: 0,
        displayName: 'Alice',
        deviceType: 'WEB',
      };

      // The reconciler is created in the constructor and registered as the Members processor.
      const getProcessor = () => meeting.members.setMembersUpdateProcessor.args[0][0];

      beforeEach(async () => {
        await e2ee.start();
      });

      it('registers a members-update processor on construction', () => {
        assert.calledOnce(meeting.members.setMembersUpdateProcessor);
        assert.isFunction(getProcessor());
      });

      it('stamps verification onto members changed by a Locus update (via the processor)', () => {
        // Roster arrives while no member owns the device yet, then the member appears.
        emitSession('rosterAdded', [rosterEntry]);
        const member = makeFakeMember('m1', [OWN_DEVICE_URL]);
        membersById.m1 = member;

        getProcessor()({delta: {added: [member]}});

        assert.calledWithExactly(member.setE2eeDeviceVerifications, [expectedVerification]);
        // Member-driven: Members emits members:update itself, the reconciler does not report.
        assert.notCalled(meeting.members.reportMembersUpdated);
      });

      it('reports roster-driven verification changes through Members', () => {
        const member = makeFakeMember('m1', [OWN_DEVICE_URL]);
        membersById.m1 = member;

        emitSession('rosterAdded', [rosterEntry]);

        assert.calledWithExactly(member.setE2eeDeviceVerification, OWN_DEVICE_URL, expectedVerification);
        assert.calledWith(meeting.members.reportMembersUpdated, [member]);
      });

      it('reports members cleared when their device leaves the roster', () => {
        const member = makeFakeMember('m1', [OWN_DEVICE_URL]);
        membersById.m1 = member;
        emitSession('rosterAdded', [rosterEntry]);
        meeting.members.reportMembersUpdated.resetHistory();

        emitSession('rosterRemoved', {urls: [OWN_DEVICE_URL]});

        assert.calledWith(member.removeE2eeDeviceVerification, OWN_DEVICE_URL);
        assert.calledWith(meeting.members.reportMembersUpdated, [member]);
      });
    });

    describe('stop', () => {
      it('tears down signaling and session and resets to left', async () => {
        await e2ee.start();
        emitSession('joinSuccess', {securityCode: 'SEC-1'});

        await e2ee.stop();

        assert.calledOnce(signalingStopStub);
        assert.calledOnce(leaveStub);
        assert.equal(e2ee.state, 'left');
        assert.isUndefined(e2ee.getSecurityCode());
        assert.isFalse(e2ee.hasMediaServices);
      });

      it('resets the roster on stop, clearing and reporting verified members', async () => {
        const member = makeFakeMember('m1', [OWN_DEVICE_URL]);
        membersById.m1 = member;
        await e2ee.start();
        emitSession('rosterAdded', [
          {url: OWN_DEVICE_URL, deviceType: 'WEB', displayName: 'Alice', validationResult: 0},
        ]);
        member.removeE2eeDeviceVerification.resetHistory();
        meeting.members.reportMembersUpdated.resetHistory();

        await e2ee.stop();

        assert.calledWith(member.removeE2eeDeviceVerification, OWN_DEVICE_URL);
        assert.calledWith(meeting.members.reportMembersUpdated, [member]);
      });
    });
  });
});
