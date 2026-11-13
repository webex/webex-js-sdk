/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import E2eeController from '@webex/plugin-meetings/src/e2ee/E2eeController';
import MLS from '@webex/plugin-meetings/src/e2ee/mls';
import E2eeSignaling from '@webex/plugin-meetings/src/e2ee/E2eeSignaling';
import WasmLoader from '@webex/plugin-meetings/src/common/wasm-loader';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import {EVENT_TRIGGERS} from '@webex/plugin-meetings/src/constants';
import Metrics from '@webex/plugin-meetings/src/metrics';

describe('plugin-meetings', () => {
  describe('E2eeController', () => {
    let webex;
    let meeting;
    let membersById;
    let wasmLoader;
    let identityProvider;
    let getLlmChannel;
    let createController;
    let e2ee;
    let events;
    let sessionHandlers;
    let rosterStub;
    let initializeStub;
    let onStub;
    let offStub;
    let joinStub;
    let leaveStub;
    let signalingStartStub;
    let signalingStopStub;
    let sendBehavioralMetricStub;

    const OWN_DEVICE_URL = 'https://wdm.webex.com/device-1';
    const WASM_URL = '/assets/plugin-meetings/e2ee.wasm';
    const GROUP_URL = 'https://mes.webex.com/group-1';
    const LOCUS_URL = 'https://locus.webex.com/locus-1';
    const CREDENTIALS = {privateKey: new Uint8Array([1]), certChain: [new ArrayBuffer(1)]};
    const TRUST_ANCHORS = {webexCaRoots: 'ca', domainNameRoots: '', userIdentityRoots: ''};

    const emitSession = (event, payload?) => sessionHandlers[event]?.(payload);

    const makeRosterEntry = ({url, deviceType = 'WEB'}) => ({
      url,
      deviceType,
      displayName: '',
      validationResult: 0,
    });

    const MEDIA_SERVICE = makeRosterEntry({
      url: 'https://ms.webex.com/1',
      deviceType: 'MEDIA_SERVICE',
    });

    const addMediaServiceToRoster = () => {
      rosterStub.returns([MEDIA_SERVICE]);
      emitSession('rosterAdded', [MEDIA_SERVICE]);
    };

    const resetEventSpies = () => Object.values(events).forEach((spy: any) => spy.resetHistory());

    const assertSessionTornDown = () => {
      assert.calledOnce(signalingStopStub);
      assert.calledOnce(leaveStub);
      assert.deepEqual(sessionHandlers, {});
    };

    const createDeferred = () => {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return {promise, resolve, reject};
    };

    beforeEach(() => {
      sessionHandlers = {};
      membersById = {};
      initializeStub = sinon.stub(MLS.prototype, 'initialize').resolves();
      joinStub = sinon.stub(MLS.prototype, 'join');
      leaveStub = sinon.stub(MLS.prototype, 'leave');
      rosterStub = sinon.stub(MLS.prototype, 'getRoster').returns([]);
      onStub = sinon.stub(MLS.prototype, 'on').callsFake((event, handler) => {
        sessionHandlers[event] = handler;
      });
      offStub = sinon.stub(MLS.prototype, 'off').callsFake((event) => {
        delete sessionHandlers[event];
      });
      signalingStartStub = sinon.stub(E2eeSignaling.prototype, 'start');
      signalingStopStub = sinon.stub(E2eeSignaling.prototype, 'stop');
      sendBehavioralMetricStub = sinon.stub(Metrics, 'sendBehavioralMetric');

      wasmLoader = sinon.createStubInstance(WasmLoader);
      wasmLoader.get.resolves({});
      identityProvider = {
        getCredentials: sinon.stub().resolves(CREDENTIALS),
        getTrustAnchors: sinon.stub().returns(TRUST_ANCHORS),
      };
      getLlmChannel = sinon.stub().returns(undefined);
      webex = {
        config: {meetings: {enableE2ee: true, deviceType: 'WEB'}},
        internal: {
          device: {userId: 'user-1', url: OWN_DEVICE_URL},
          mercury: {on: sinon.stub(), off: sinon.stub()},
        },
        request: sinon.stub().resolves({body: ''}),
      };
      meeting = {
        correlationId: 'corr-1',
        locusInfo: {
          url: LOCUS_URL,
          info: {isV2E2EEncrypted: true, mediaEncryptionGroupUrl: GROUP_URL},
        },
        members: {
          selfId: 's1',
          membersCollection: {
            get: (id) => (id === 's1' ? {name: 'Alice'} : membersById[id]),
            getAll: () => membersById,
            getMemberByDeviceUrl: (url) =>
              Object.values(membersById).find((member: any) =>
                member.participant?.devices?.some((device) => device.url === url)
              ),
          },
          setMembersUpdateProcessor: sinon.stub(),
          reportMembersUpdated: sinon.stub(),
        },
      };
      createController = () =>
        new E2eeController({
          context: {
            correlationId: meeting.correlationId,
            getLocusInfo: () => meeting.locusInfo,
            getLlmChannel,
            members: meeting.members,
          } as any,
          webex,
          wasmLoader,
          wasmUrl: WASM_URL,
          identityProvider,
        });
      e2ee = createController();

      events = {
        securityCode: sinon.spy(),
        state: sinon.spy(),
        mediaServices: sinon.spy(),
        failure: sinon.spy(),
      };
      e2ee.on(EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED, events.securityCode);
      e2ee.on(EVENT_TRIGGERS.MEETING_E2EE_STATE_CHANGED, events.state);
      e2ee.on(EVENT_TRIGGERS.MEETING_E2EE_MEDIA_SERVICES_CHANGED, events.mediaServices);
      e2ee.on(EVENT_TRIGGERS.MEETING_E2EE_FAILURE, events.failure);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('constructor', () => {
      it('does not register a members-update processor when E2EE is disabled', () => {
        webex.config.meetings.enableE2ee = false;
        meeting.members.setMembersUpdateProcessor.resetHistory();

        createController();

        assert.notCalled(meeting.members.setMembersUpdateProcessor);
      });
    });

    describe('start', () => {
      [
        {
          when: 'E2EE is disabled in config',
          setup: () => (webex.config.meetings.enableE2ee = false),
        },
        {
          when: 'the meeting is not V2 E2E encrypted',
          setup: () => (meeting.locusInfo.info.isV2E2EEncrypted = false),
        },
        {
          when: 'there is no media-encryption group url',
          setup: () => (meeting.locusInfo.info.mediaEncryptionGroupUrl = undefined),
        },
        {when: 'there is no locus info', setup: () => (meeting.locusInfo = undefined)},
      ].forEach(({when, setup}) => {
        it(`is a no-op when ${when}`, async () => {
          setup();

          await e2ee.start();

          assert.equal(e2ee.state, 'disabled');
          assert.notCalled(identityProvider.getCredentials);
          assert.notCalled(initializeStub);
          assert.notCalled(events.state);
        });
      });

      it('initializes the session, then starts signaling, then joins', async () => {
        await e2ee.start();

        assert.calledOnceWithExactly(wasmLoader.get, WASM_URL);
        assert.calledOnceWithExactly(identityProvider.getCredentials, 'user-1');
        assert.calledOnceWithExactly(initializeStub, {
          participantId: 'user-1',
          deviceUrl: OWN_DEVICE_URL,
          deviceType: 'WEB',
          correlationId: 'corr-1',
          displayName: 'Alice',
          serviceUrl: GROUP_URL,
          credentials: CREDENTIALS,
          trustAnchors: TRUST_ANCHORS,
        });
        sinon.assert.callOrder(initializeStub, signalingStartStub, joinStub);
        assert.deepEqual(events.state.args, [[{state: 'initializing'}], [{state: 'joining'}]]);
        assert.equal(e2ee.state, 'joining');
      });

      it('uses an empty display name when the self member is unknown', async () => {
        meeting.members.selfId = 'unknown';

        await e2ee.start();

        assert.equal(initializeStub.firstCall.args[0].displayName, '');
      });

      it('gives MLS the WASM loader and a media-encryption service bound to webex.request', async () => {
        await e2ee.start();
        const session = initializeStub.firstCall.thisValue;

        wasmLoader.get.resetHistory();
        await session.loadModule();
        assert.calledOnceWithExactly(wasmLoader.get, WASM_URL);

        webex.request.resolves({body: {ok: true}});
        const response = await session.httpClient.request(`${GROUP_URL}/commit`, {a: 1});

        assert.deepEqual(response, {ok: true});
        assert.calledOnceWithExactly(webex.request, {
          method: 'POST',
          service: 'media-encryption',
          url: `${GROUP_URL}/commit`,
          body: {a: 1},
        });
        assert.equal(webex.request.firstCall.thisValue, webex);
      });

      it('connects signaling to mercury, the LLM channel of this locus and the MLS session', async () => {
        signalingStartStub.restore();
        const handleEventStub = sinon.stub(MLS.prototype, 'handleEvent');
        const setLlmConnectedBeforeJoinStub = sinon.stub(
          MLS.prototype,
          'setLlmConnectedBeforeJoin'
        );
        const llm = {
          on: sinon.stub(),
          off: sinon.stub(),
          isConnected: sinon.stub().returns(true),
          getLocusUrl: sinon.stub().returns(LOCUS_URL),
        };

        getLlmChannel.returns(llm);

        await e2ee.start();

        assert.calledOnceWithExactly(setLlmConnectedBeforeJoinStub, true);

        const [event, onMercuryEvent] = webex.internal.mercury.on.firstCall.args;

        assert.calledWith(llm.on, event, sinon.match.func);

        onMercuryEvent({data: {type: 'welcome'}});

        assert.calledOnceWithExactly(
          handleEventStub,
          sinon.match.instanceOf(Uint8Array),
          'mercury'
        );
        assert.equal(
          new TextDecoder().decode(handleEventStub.firstCall.args[0]),
          '{"type":"welcome"}'
        );
      });

      it('ignores start while a session is starting or running', async () => {
        await Promise.all([e2ee.start(), e2ee.start()]);
        await e2ee.start();

        assert.calledOnce(initializeStub);
        assert.calledOnce(joinStub);
        assert.equal(e2ee.state, 'joining');
      });

      it('can start again after stop', async () => {
        await e2ee.start();
        await e2ee.stop();

        await e2ee.start();

        assert.calledTwice(initializeStub);
        assert.calledTwice(joinStub);
        assert.equal(e2ee.state, 'joining');
      });

      describe('when stopped during startup', () => {
        it('does not create a session if stopped while loading credentials', async () => {
          const credentials = createDeferred();

          identityProvider.getCredentials.returns(credentials.promise);
          const starting = e2ee.start();

          await e2ee.stop();
          credentials.resolve(CREDENTIALS);
          await starting;

          assert.notCalled(initializeStub);
          assert.notCalled(signalingStartStub);
          assert.notCalled(joinStub);
          assert.equal(e2ee.state, 'left');
          assert.deepEqual(events.state.args, [[{state: 'initializing'}], [{state: 'left'}]]);
        });

        it('leaves the session and does not join if stopped while MLS initializes', async () => {
          const initialized = createDeferred();

          initializeStub.returns(initialized.promise);
          const starting = e2ee.start();

          await new Promise((resolve) => setImmediate(resolve));
          assert.calledOnce(initializeStub);
          await e2ee.stop();
          initialized.resolve();
          await starting;

          assert.calledOnce(initializeStub);
          assert.calledOnce(leaveStub);
          assert.deepEqual(sessionHandlers, {});
          assert.notCalled(signalingStartStub);
          assert.notCalled(joinStub);
          assert.equal(e2ee.state, 'left');
        });

        it('does not report a failure when the cancelled startup step then rejects', async () => {
          const initialized = createDeferred();

          initializeStub.returns(initialized.promise);
          const starting = e2ee.start();

          await new Promise((resolve) => setImmediate(resolve));
          assert.calledOnce(initializeStub);
          await e2ee.stop();
          initialized.reject(new Error('session left'));
          await starting;

          assert.equal(e2ee.state, 'left');
          assert.notCalled(events.failure);
          assert.notCalled(sendBehavioralMetricStub);
        });

        it('lets a new start proceed while the cancelled one is still pending', async () => {
          const firstCredentials = createDeferred();

          identityProvider.getCredentials.onFirstCall().returns(firstCredentials.promise);
          const cancelledStart = e2ee.start();

          await e2ee.stop();
          await e2ee.start();
          firstCredentials.resolve(CREDENTIALS);
          await cancelledStart;

          assert.calledOnce(initializeStub);
          assert.calledOnce(joinStub);
          assert.equal(e2ee.state, 'joining');
        });
      });

      [
        {
          when: 'the credentials cannot be fetched',
          fail: () => identityProvider.getCredentials.rejects(new Error('CA down')),
          errorMessage: 'CA down',
          sessionCreated: false,
        },
        {
          when: 'the WASM module fails to load with a non-Error value',
          fail: () => wasmLoader.get.callsFake(() => Promise.reject('boom')),
          errorMessage: 'boom',
          sessionCreated: false,
        },
        {
          when: 'the locus loses its media-encryption group url during startup',
          fail: () =>
            identityProvider.getCredentials.callsFake(async () => {
              meeting.locusInfo.info.mediaEncryptionGroupUrl = undefined;

              return CREDENTIALS;
            }),
          errorMessage: 'Meeting locus has no media encryption group URL',
          sessionCreated: false,
        },
        {
          when: 'the MLS session fails to initialize',
          fail: () => initializeStub.rejects(new Error('MLS init failed')),
          errorMessage: 'MLS init failed',
          sessionCreated: true,
        },
      ].forEach(({when, fail, errorMessage, sessionCreated}) => {
        it(`fails and reports startFailed when ${when}`, async () => {
          fail();

          await e2ee.start();

          assert.equal(e2ee.state, 'failed');
          assert.deepEqual(events.state.args, [[{state: 'initializing'}], [{state: 'failed'}]]);
          assert.calledOnceWithExactly(events.failure, {reason: 'startFailed', errorMessage});
          assert.calledOnceWithExactly(sendBehavioralMetricStub, 'js_sdk_e2ee_failure', {
            correlation_id: 'corr-1',
            state: 'failed',
            reason: 'startFailed',
            errorMessage,
          });
          assert.notCalled(signalingStartStub);
          assert.notCalled(joinStub);
          assert.equal(leaveStub.callCount, sessionCreated ? 1 : 0);
          assert.deepEqual(sessionHandlers, {});
        });
      });
    });

    describe('llmChannelChanged', () => {
      let setLlmChannelStub;

      beforeEach(() => {
        setLlmChannelStub = sinon.stub(E2eeSignaling.prototype, 'setLlmChannel');
      });

      it('is a no-op before start', () => {
        e2ee.llmChannelChanged();

        assert.notCalled(setLlmChannelStub);
      });

      it('passes the current LLM channel to signaling', async () => {
        const replacementLlm = {id: 'replacement'};

        await e2ee.start();

        getLlmChannel.returns(replacementLlm);
        e2ee.llmChannelChanged();
        getLlmChannel.returns(undefined);
        e2ee.llmChannelChanged();

        assert.deepEqual(setLlmChannelStub.args, [[replacementLlm], [undefined]]);
      });
    });

    describe('session events', () => {
      beforeEach(async () => {
        await e2ee.start();
        resetEventSpies();
      });

      it('records the security code on joinSuccess and refreshes the join state', () => {
        rosterStub.returns([makeRosterEntry({url: OWN_DEVICE_URL})]);

        emitSession('joinSuccess', {securityCode: 'SEC-1'});

        assert.equal(e2ee.getSecurityCode(), 'SEC-1');
        assert.calledOnceWithExactly(events.securityCode, {securityCode: 'SEC-1'});
        assert.equal(e2ee.state, 'joined');
      });

      it('updates the security code on securityCodeChanged', () => {
        emitSession('securityCodeChanged', {code: 'SEC-2'});

        assert.equal(e2ee.getSecurityCode(), 'SEC-2');
        assert.calledOnceWithExactly(events.securityCode, {securityCode: 'SEC-2'});
      });

      it('marks joined only once our own device url is in the roster', () => {
        rosterStub.returns([makeRosterEntry({url: 'https://wdm.webex.com/other'})]);
        emitSession('rosterAdded', []);
        assert.equal(e2ee.state, 'joining');

        rosterStub.returns([makeRosterEntry({url: OWN_DEVICE_URL})]);
        emitSession('rosterAdded', []);
        assert.equal(e2ee.state, 'joined');
        assert.calledOnceWithExactly(events.state, {state: 'joined'});
      });

      it('emits a media-services change only when their presence in the roster changes', () => {
        assert.isFalse(e2ee.hasUntrustedMediaServices);

        addMediaServiceToRoster();
        assert.isTrue(e2ee.hasUntrustedMediaServices);

        emitSession('rosterAdded', []);

        rosterStub.returns([]);
        emitSession('rosterRemoved', {urls: [MEDIA_SERVICE.url]});
        assert.isFalse(e2ee.hasUntrustedMediaServices);

        assert.deepEqual(events.mediaServices.args, [
          [{hasMediaServices: true}],
          [{hasMediaServices: false}],
        ]);
      });

      [
        {
          event: 'joinFailure',
          payload: {reason: 'join_failure'},
          state: 'failed',
          reason: 'join_failure',
          details: {},
        },
        {
          event: 'mediaEncryptionServiceFailure',
          payload: {errorCode: 78400011, message: 'not leader'},
          state: 'failed',
          reason: 'mediaEncryptionServiceFailure',
          details: {errorCode: 78400011, errorMessage: 'not leader'},
        },
        {event: 'evicted', payload: undefined, state: 'evicted', reason: 'evicted', details: {}},
      ].forEach(({event, payload, state, reason, details}) => {
        it(`tears down the session, moves to ${state} and reports a failure on ${event}`, () => {
          emitSession('joinSuccess', {securityCode: 'SEC-1'});
          resetEventSpies();

          emitSession(event, payload);

          assertSessionTornDown();
          assert.equal(e2ee.state, state);
          assert.isUndefined(e2ee.getSecurityCode());
          assert.calledOnceWithExactly(events.securityCode, {securityCode: undefined});
          assert.calledOnceWithExactly(events.state, {state});
          assert.calledOnceWithExactly(events.failure, {reason, ...details});
          assert.calledOnceWithExactly(sendBehavioralMetricStub, 'js_sdk_e2ee_failure', {
            correlation_id: 'corr-1',
            state,
            reason,
            ...details,
          });
        });

        it(`creates a fresh session when started again after ${event}`, async () => {
          const failedSession = initializeStub.firstCall.thisValue;

          emitSession(event, payload);
          resetEventSpies();

          await e2ee.start();

          assert.calledTwice(initializeStub);
          assert.notStrictEqual(initializeStub.secondCall.thisValue, failedSession);
          assert.calledTwice(joinStub);
          assert.equal(e2ee.state, 'joining');
          assert.deepEqual(events.state.args, [[{state: 'initializing'}], [{state: 'joining'}]]);
          assert.notCalled(events.failure);
        });
      });

      it('ignores start once joined', async () => {
        rosterStub.returns([makeRosterEntry({url: OWN_DEVICE_URL})]);
        emitSession('joinSuccess', {securityCode: 'SEC-1'});

        await e2ee.start();

        assert.calledOnce(initializeStub);
        assert.equal(e2ee.state, 'joined');
      });
    });

    describe('stop', () => {
      it('is a silent no-op when E2EE was never started', async () => {
        const loggerInfoStub = sinon.stub();

        // Replace the whole logger: other specs install loggers whose methods are already sinon
        // stubs, so stubbing LoggerProxy.logger.info directly fails depending on test order.
        sinon.stub(LoggerProxy, 'logger').value({...LoggerProxy.logger, info: loggerInfoStub});

        await e2ee.stop();

        assert.equal(e2ee.state, 'disabled');
        assert.notCalled(signalingStopStub);
        assert.notCalled(leaveStub);
        assert.notCalled(events.state);
        assert.notCalled(loggerInfoStub);
      });

      it('tears down the session and moves to left without reporting a failure', async () => {
        await e2ee.start();
        emitSession('joinSuccess', {securityCode: 'SEC-1'});
        resetEventSpies();

        await e2ee.stop();

        assertSessionTornDown();
        assert.equal(e2ee.state, 'left');
        assert.isUndefined(e2ee.getSecurityCode());
        assert.calledOnceWithExactly(events.securityCode, {securityCode: undefined});
        assert.calledOnceWithExactly(events.state, {state: 'left'});
        assert.notCalled(events.failure);
        assert.notCalled(sendBehavioralMetricStub);
      });

      it('reports media services gone when they were present', async () => {
        await e2ee.start();
        addMediaServiceToRoster();
        resetEventSpies();

        await e2ee.stop();

        assert.isFalse(e2ee.hasUntrustedMediaServices);
        assert.calledOnceWithExactly(events.mediaServices, {hasMediaServices: false});
      });

      it('does nothing when called again', async () => {
        await e2ee.start();
        await e2ee.stop();
        signalingStopStub.resetHistory();
        leaveStub.resetHistory();
        resetEventSpies();

        await e2ee.stop();

        assert.equal(e2ee.state, 'left');
        assert.notCalled(signalingStopStub);
        assert.notCalled(leaveStub);
        assert.notCalled(events.state);
      });

      [
        {step: 'signaling.stop', fail: () => signalingStopStub.throws(new Error('stop failed'))},
        {step: 'session.off', fail: () => offStub.throws(new Error('off failed'))},
        {step: 'session.leave', fail: () => leaveStub.throws(new Error('leave failed'))},
      ].forEach(({step, fail}) => {
        it(`still completes cleanup when ${step} throws`, async () => {
          await e2ee.start();
          addMediaServiceToRoster();
          resetEventSpies();
          fail();

          await e2ee.stop();

          assert.calledOnce(signalingStopStub);
          assert.calledOnce(leaveStub);
          assert.equal(offStub.callCount, onStub.callCount);
          assert.calledOnceWithExactly(events.mediaServices, {hasMediaServices: false});
          assert.equal(e2ee.state, 'left');
        });
      });

    });
  });
});
