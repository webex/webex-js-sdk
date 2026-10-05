/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MlsGroupSession from '@webex/plugin-meetings/src/e2ee/MlsGroupSession';
import WasmLoader from '@webex/plugin-meetings/src/common/wasm-loader';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('plugin-meetings', () => {
  describe('MlsGroupSession', () => {
    let fakeE2ee;
    let callbacks;
    let wasmLoader;
    let httpClient;
    let timers;
    let logger;
    let session;

    const config = {
      participantId: 'user-1',
      deviceUrl: 'https://wdm.webex.com/device-1',
      correlationId: 'corr-1',
      displayName: 'Alice',
      serviceUrl: 'https://mes.webex.com/group-1',
    };

    const buildFakeE2ee = () => {
      callbacks = {};
      const record = (name) =>
        sinon.stub().callsFake((cb) => {
          callbacks[name] = cb;
        });

      return {
        initialize: sinon.stub(),
        addX509Credential: sinon.stub(),
        setTrustAnchors: sinon.stub(),
        setJoinTimeout: sinon.stub(),
        setCoalesceWindow: sinon.stub(),
        join: sinon.stub(),
        leave: sinon.stub(),
        handle: sinon.stub(),
        keepAlive: sinon.stub(),
        llmConnected: sinon.stub(),
        setLlmConnectedBeforeJoin: sinon.stub(),
        securityCode: sinon.stub().returns('CODE-1'),
        roster: sinon.stub().returns([]),
        isLeader: sinon.stub().returns(false),
        completeHttpRequest: sinon.stub(),
        completeWait: sinon.stub(),
        setOnNewTransaction: record('newTransaction'),
        setOnCompleteTransaction: record('completeTransaction'),
        setOnHttpRequest: record('httpRequest'),
        setOnWait: record('wait'),
        setOnGotKey: record('gotKey'),
        setOnUseKey: record('useKey'),
        setOnLeader: record('leader'),
        setOnPurgeBefore: record('purgeBefore'),
        setOnEvicted: record('evicted'),
        setOnAddRoster: record('addRoster'),
        setOnRemoveRoster: record('removeRoster'),
        setOnE2eeVersion: record('e2eeVersion'),
        setOnMissingCommit: record('missingCommit'),
        setOnLog: record('log'),
      };
    };

    beforeEach(() => {
      fakeE2ee = buildFakeE2ee();
      const module = {WebE2EE: sinon.stub().returns(fakeE2ee)};

      wasmLoader = sinon.createStubInstance(WasmLoader);
      wasmLoader.get.resolves(module);
      wasmLoader.preload.resolves();
      wasmLoader.isLoaded.returns(true);
      httpClient = {request: sinon.stub().resolves(new Uint8Array([1, 2, 3]))};
      timers = {setTimeout: sinon.stub()};
      logger = {
        info: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
      };
      session = new MlsGroupSession({httpClient, wasmLoader, wasmUrl: '/wasm/e2ee.wasm', timers, logger});
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('initialize', () => {
      it('loads the module, wires callbacks and initializes with defaults', async () => {
        await session.initialize(config);

        assert.calledOnceWithExactly(wasmLoader.get, '/wasm/e2ee.wasm');
        assert.calledOnceWithExactly(
          fakeE2ee.initialize,
          'user-1',
          'https://wdm.webex.com/device-1',
          'WEB',
          'corr-1',
          'Alice',
          'https://mes.webex.com/group-1'
        );
        assert.calledOnceWithExactly(fakeE2ee.setJoinTimeout, 180000);
        assert.calledOnceWithExactly(fakeE2ee.setCoalesceWindow, 500);
        assert.notCalled(fakeE2ee.addX509Credential);
        assert.notCalled(fakeE2ee.setTrustAnchors);
      });

      it('applies credentials, trust anchors, device type and custom timeouts', async () => {
        const privateKey = new Uint8Array([9]);
        const certChain = [new Uint8Array([1]).buffer, new Uint8Array([2]).buffer];

        await session.initialize({
          ...config,
          deviceType: 'MAC',
          credentials: {privateKey, certChain},
          trustAnchors: {webexCaRoots: 'ca-roots'},
          joinTimeout: 5000,
          coalesceWindow: 100,
        });

        assert.calledWith(fakeE2ee.initialize, 'user-1', 'https://wdm.webex.com/device-1', 'MAC');

        const [passedKey, passedChain] = fakeE2ee.addX509Credential.firstCall.args;

        assert.equal(passedKey, privateKey);
        assert.instanceOf(passedChain[0], Uint8Array);
        assert.calledOnceWithExactly(fakeE2ee.setTrustAnchors, 'ca-roots', '', '');
        assert.calledOnceWithExactly(fakeE2ee.setJoinTimeout, 5000);
        assert.calledOnceWithExactly(fakeE2ee.setCoalesceWindow, 100);
      });
    });

    describe('engine events', () => {
      beforeEach(async () => {
        await session.initialize(config);
      });

      it('emits joinSuccess on a successful join transaction', () => {
        const spy = sinon.stub();

        session.on('joinSuccess', spy);
        callbacks.completeTransaction('tx-1', {
          status: 'join_success',
          epoch: 3,
          base_key: new Uint8Array([1, 2]),
          index: 5,
          index_bits: 8,
          sec_code: 'SEC-CODE',
          sframe_cipher_suite: 1,
          sframe_epoch_bits: 4,
        });

        assert.calledOnce(spy);
        const payload = spy.firstCall.args[0];

        assert.equal(payload.epoch, 3);
        assert.equal(payload.securityCode, 'SEC-CODE');
        assert.deepEqual(payload.sframe, {cipherSuite: 1, epochBits: 4});
        assert.deepEqual(Array.from(payload.key.baseKey), [1, 2]);
        assert.equal(payload.key.index, 5);
        assert.equal(payload.key.indexBits, 8);
        assert.isFalse(payload.key.canEncrypt);
      });

      it('emits joinFailure on a failed transaction', () => {
        const spy = sinon.stub();

        session.on('joinFailure', spy);
        callbacks.completeTransaction('tx-1', {status: 'failure', reason: 'join_failure'});

        assert.calledOnceWithExactly(spy, {reason: 'join_failure'});
      });

      it('emits newKey when the engine reports a key', () => {
        const spy = sinon.stub();

        session.on('newKey', spy);
        callbacks.gotKey({
          epoch: 7,
          base_key: new Uint8Array([4, 5]),
          index: 1,
          index_bits: 2,
          sec_code: 'x',
        });

        assert.calledOnce(spy);
        const key = spy.firstCall.args[0];

        assert.equal(key.epoch, 7);
        assert.deepEqual(Array.from(key.baseKey), [4, 5]);
        assert.isFalse(key.canEncrypt);
      });

      it('emits useKey and purgeKeys', () => {
        const useKeySpy = sinon.stub();
        const purgeSpy = sinon.stub();

        session.on('useKey', useKeySpy);
        session.on('purgeKeys', purgeSpy);
        callbacks.useKey(9);
        callbacks.purgeBefore(4);

        assert.calledOnceWithExactly(useKeySpy, {epoch: 9});
        assert.calledOnceWithExactly(purgeSpy, {epoch: 4});
      });

      it('emits rosterAdded with mapped members and rosterRemoved with urls', () => {
        const addedSpy = sinon.stub();
        const removedSpy = sinon.stub();

        session.on('rosterAdded', addedSpy);
        session.on('rosterRemoved', removedSpy);
        callbacks.addRoster([
          {url: 'd1', display_name: 'Bob', device_type: 'WEB', validation_result: 0},
        ]);
        callbacks.removeRoster(['d2']);

        assert.calledOnceWithExactly(addedSpy, [
          {url: 'd1', displayName: 'Bob', deviceType: 'WEB', validationResult: 0},
        ]);
        assert.calledOnceWithExactly(removedSpy, {urls: ['d2']});
      });

      it('emits leaderChanged, evicted and versionNegotiated', () => {
        const leaderSpy = sinon.stub();
        const evictedSpy = sinon.stub();
        const versionSpy = sinon.stub();

        session.on('leaderChanged', leaderSpy);
        session.on('evicted', evictedSpy);
        session.on('versionNegotiated', versionSpy);
        callbacks.leader();
        callbacks.evicted();
        callbacks.e2eeVersion(2);

        assert.calledOnceWithExactly(leaderSpy, {isLeader: true});
        assert.calledOnce(evictedSpy);
        assert.calledOnceWithExactly(versionSpy, {version: 2});
      });

      it('emits securityCodeChanged only when the code actually changes', () => {
        const spy = sinon.stub();

        session.on('securityCodeChanged', spy);

        // Establish the baseline security code via a successful join.
        fakeE2ee.securityCode.returns('CODE-1');
        callbacks.completeTransaction('tx', {
          status: 'join_success',
          epoch: 1,
          base_key: new Uint8Array(),
          index: 0,
          index_bits: 0,
          sec_code: 'CODE-1',
          sframe_cipher_suite: 0,
          sframe_epoch_bits: 0,
        });

        // Same as the baseline code -> no emit.
        callbacks.addRoster([]);
        assert.notCalled(spy);

        // Changed -> emit once.
        fakeE2ee.securityCode.returns('CODE-2');
        callbacks.addRoster([]);
        assert.calledOnceWithExactly(spy, {code: 'CODE-2'});
      });
    });

    describe('http and wait routing', () => {
      beforeEach(async () => {
        await session.initialize(config);
      });

      it('routes an http request to the client and completes it on success', async () => {
        callbacks.httpRequest({
          url: 'https://mes.webex.com/op',
          body: new Uint8Array([10]),
          handlerId: 42,
        });

        assert.calledOnce(httpClient.request);
        assert.equal(httpClient.request.firstCall.args[0], 'https://mes.webex.com/op');

        await flushPromises();

        const [handlerId, success, body, code, message] =
          fakeE2ee.completeHttpRequest.firstCall.args;

        assert.equal(handlerId, 42);
        assert.isTrue(success);
        assert.deepEqual(Array.from(body), [1, 2, 3]);
        assert.equal(code, 0);
        assert.equal(message, '');
      });

      it('completes an http request as failed when the client rejects', async () => {
        const error = new Error('nope');

        error.code = 503;
        httpClient.request.rejects(error);

        callbacks.httpRequest({url: 'https://mes.webex.com/op', body: new Uint8Array(), handlerId: 7});

        await flushPromises();

        const [handlerId, success, body, code, message] =
          fakeE2ee.completeHttpRequest.firstCall.args;

        assert.equal(handlerId, 7);
        assert.isFalse(success);
        assert.equal(body.length, 0);
        assert.equal(code, 503);
        assert.equal(message, 'nope');
      });

      it('schedules a wait via the injected timers and completes it', () => {
        callbacks.wait(1500, 11);

        assert.calledOnce(timers.setTimeout);
        assert.equal(timers.setTimeout.firstCall.args[1], 1500);
        assert.notCalled(fakeE2ee.completeWait);

        timers.setTimeout.firstCall.args[0]();

        assert.calledOnceWithExactly(fakeE2ee.completeWait, 11);
      });
    });

    describe('log routing', () => {
      beforeEach(async () => {
        await session.initialize(config);
      });

      it('maps WASM log levels to the logger', () => {
        // Engine LogLevel: fatal=1, error=2, warn=3, info=4, debug=5.
        callbacks.log(1, 'a fatal');
        callbacks.log(2, 'an error');
        callbacks.log(3, 'a warning');
        callbacks.log(4, 'an info');
        callbacks.log(5, 'a debug');

        assert.calledWithMatch(logger.error, 'a fatal');
        assert.calledWithMatch(logger.error, 'an error');
        assert.calledWithMatch(logger.warn, 'a warning');
        assert.calledWithMatch(logger.info, 'an info');
        assert.calledWithMatch(logger.debug, 'a debug');
      });
    });

    describe('delegating methods', () => {
      beforeEach(async () => {
        await session.initialize(config);
      });

      it('forwards lifecycle calls to the engine', () => {
        const event = new Uint8Array([1, 2, 3]);

        session.join();
        session.leave();
        session.handleEvent(event, 'llm');
        session.keepAlive();
        session.setLlmConnectedBeforeJoin(true);
        session.notifyLlmConnected();

        assert.calledOnce(fakeE2ee.join);
        assert.calledOnce(fakeE2ee.leave);
        assert.calledOnce(fakeE2ee.handle);
        assert.deepEqual(Array.from(fakeE2ee.handle.firstCall.args[0]), [1, 2, 3]);
        assert.calledOnce(fakeE2ee.keepAlive);
        assert.calledOnceWithExactly(fakeE2ee.setLlmConnectedBeforeJoin, true);
        assert.calledOnce(fakeE2ee.llmConnected);
      });

      it('exposes security code, roster and leader state', () => {
        fakeE2ee.securityCode.returns('SEC');
        fakeE2ee.isLeader.returns(true);
        fakeE2ee.roster.returns([
          {url: 'd1', display_name: 'Bob', device_type: 'WEB', validation_result: 1},
        ]);

        assert.equal(session.getSecurityCode(), 'SEC');
        assert.isTrue(session.isLeader());
        assert.deepEqual(session.getRoster(), [
          {url: 'd1', displayName: 'Bob', deviceType: 'WEB', validationResult: 1},
        ]);
      });
    });

    describe('before initialization', () => {
      it('returns empty defaults and throws on lifecycle calls', () => {
        assert.equal(session.getSecurityCode(), '');
        assert.deepEqual(session.getRoster(), []);
        assert.isFalse(session.isLeader());
        assert.throws(() => session.join(), /not initialized/);
        assert.throws(() => session.leave(), /not initialized/);
        assert.throws(() => session.handleEvent(new Uint8Array(), 'llm'), /not initialized/);
      });
    });
  });
});
