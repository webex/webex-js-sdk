/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MLS from '../../../../src/e2ee/mls';
import LoggerProxy from '../../../../src/common/logs/logger-proxy';

const flushPromises = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('plugin-meetings', () => {
  describe('MLS', () => {
    let fakeE2ee;
    let callbacks;
    let loadModule;
    let webE2eeConstructor;
    let httpClient;
    let session;

    // Replaces the whole logger: other specs install loggers whose methods are already sinon stubs,
    // so stubbing individual methods of LoggerProxy.logger fails depending on test order.
    const stubLogger = () => {
      const logger = {
        info: sinon.stub(),
        log: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub(),
        trace: sinon.stub(),
        debug: sinon.stub(),
      };

      sinon.stub(LoggerProxy, 'logger').value(logger);

      return logger;
    };

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
      webE2eeConstructor = sinon.stub().returns(fakeE2ee);
      const module = {WebE2EE: webE2eeConstructor};

      loadModule = sinon.stub().resolves(module);
      httpClient = {request: sinon.stub().resolves({result: 'ok', n: 1})};
      session = new MLS({httpClient, loadModule});
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('initialize', () => {
      it('loads the module, wires callbacks and initializes with defaults', async () => {
        await session.initialize(config);

        assert.calledOnce(loadModule);
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

      it('does not initialize a second engine when called again', async () => {
        await session.initialize(config);
        await session.initialize({...config, participantId: 'user-2'});

        // The loader may be called again, but returns the cached WASM module.
        assert.calledTwice(loadModule);
        assert.calledOnce(webE2eeConstructor);
        assert.calledOnceWithExactly(
          fakeE2ee.initialize,
          'user-1',
          'https://wdm.webex.com/device-1',
          'WEB',
          'corr-1',
          'Alice',
          'https://mes.webex.com/group-1'
        );
      });

      it('applies credentials, trust anchors, device type and custom timeouts', async () => {
        const privateKey = new Uint8Array([9]);
        const certChain = [new Uint8Array([1]), new Uint8Array([2])];

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
        assert.calledOnceWithExactly(
          fakeE2ee.setTrustAnchors,
          'ca-roots',
          '',
          '',
          new Uint8Array()
        );
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
        const baseKey = new Uint8Array([1, 2]);

        session.on('joinSuccess', spy);
        callbacks.completeTransaction('tx-1', {
          status: 'join_success',
          epoch: 3,
          base_key: baseKey,
          index: 5,
          index_bits: 8,
          sec_code: 'SEC-CODE',
          sframe_cipher_suite: 1,
          sframe_epoch_bits: 4,
        });
        // Mutate the key to verify that we emit a copy.
        baseKey.fill(0);

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

      it('emits joinFailure when the join transaction fails', () => {
        const spy = sinon.stub();

        session.on('joinFailure', spy);
        callbacks.completeTransaction('tx-1', {status: 'failure', reason: 'join_failure'});

        assert.calledOnceWithExactly(spy, {reason: 'join_failure'});
      });

      it('does not emit events to a listener after it is removed', () => {
        const spy = sinon.stub();

        session.on('evicted', spy);
        callbacks.evicted();
        session.off('evicted', spy);
        callbacks.evicted();

        assert.calledOnceWithExactly(spy, undefined);
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
          {
            url: 'd1',
            display_name: 'Bob',
            device_type: 'WEB',
            validation_result: 0,
            x509: [
              {
                result: 0,
                member_certs: [
                  {
                    primary_name: 'bob@example.com',
                    common_name: 'Bob',
                    organization_name: 'Example',
                    email_addresses: ['bob@example.com'],
                    domain_names: ['example.com'],
                    not_before: 1000,
                    not_after: 2000,
                    signature_algorithm: 'rsa-sha256',
                    public_key_algorithm: 'rsaEncryption',
                    identity_type: 2,
                    der: new Uint8Array([1, 2, 3]),
                  },
                ],
              },
            ],
          },
        ]);
        callbacks.removeRoster(['d2']);

        assert.calledOnceWithExactly(addedSpy, [
          {
            url: 'd1',
            displayName: 'Bob',
            deviceType: 'WEB',
            validationResult: 0,
            identityResults: [
              {
                result: 0,
                certificateChain: [
                  {
                    primaryName: 'bob@example.com',
                    commonName: 'Bob',
                    organizationName: 'Example',
                    emailAddresses: ['bob@example.com'],
                    domainNames: ['example.com'],
                    notBefore: 1000,
                    notAfter: 2000,
                    signatureAlgorithm: 'rsa-sha256',
                    publicKeyAlgorithm: 'rsaEncryption',
                    identityType: 2,
                    der: new Uint8Array([1, 2, 3]),
                  },
                ],
              },
            ],
          },
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
        callbacks.addRoster([]);
        callbacks.removeRoster(['d1']);
        callbacks.removeRoster(['d1']);
        assert.calledOnceWithExactly(spy, {code: 'CODE-2'});
      });
    });

    describe('http and wait routing', () => {
      beforeEach(async () => {
        await session.initialize(config);
      });

      const encodeJson = (value) => new TextEncoder().encode(JSON.stringify(value));
      const decodeJson = (bytes) => JSON.parse(new TextDecoder().decode(bytes));

      it('copies the request body before the callback returns, since the engine reuses that memory', async () => {
        const body = encodeJson({op: 'llmConnected'});

        callbacks.httpRequest({url: 'https://mes.webex.com/op', body, handlerId: 43});
        body.fill(0x7b);

        await flushPromises();

        assert.calledOnceWithExactly(httpClient.request, 'https://mes.webex.com/op', {
          op: 'llmConnected',
        });
        assert.calledOnce(fakeE2ee.completeHttpRequest);
        assert.isTrue(fakeE2ee.completeHttpRequest.firstCall.args[1]);
      });

      it('decodes the request bytes, routes the object to the client and completes with encoded response bytes', async () => {
        callbacks.httpRequest({
          url: 'https://mes.webex.com/op',
          body: encodeJson({op: 'join', epoch: 2}),
          handlerId: 42,
        });

        assert.notCalled(httpClient.request);

        await flushPromises();

        assert.calledOnceWithExactly(httpClient.request, 'https://mes.webex.com/op', {
          op: 'join',
          epoch: 2,
        });
        assert.calledOnce(fakeE2ee.completeHttpRequest);

        const [handlerId, success, body, code, message] =
          fakeE2ee.completeHttpRequest.firstCall.args;

        assert.equal(handlerId, 42);
        assert.isTrue(success);
        assert.instanceOf(body, Uint8Array);
        assert.deepEqual(decodeJson(body), {result: 'ok', n: 1});
        assert.equal(code, 0);
        assert.equal(message, '');
      });

      it('completes an undefined HTTP response as successful empty bytes', async () => {
        httpClient.request.resolves(undefined);

        callbacks.httpRequest({
          url: 'https://mes.webex.com/op',
          body: encodeJson({op: 'join'}),
          handlerId: 44,
        });

        await flushPromises();

        assert.calledOnce(httpClient.request);
        assert.calledOnce(fakeE2ee.completeHttpRequest);

        const [handlerId, success, body, code, message] =
          fakeE2ee.completeHttpRequest.firstCall.args;

        assert.equal(handlerId, 44);
        assert.isTrue(success);
        assert.deepEqual(Array.from(body), []);
        assert.equal(code, 0);
        assert.equal(message, '');
      });

      [
        {
          description: 'passes the media-encryption error code from the response body',
          error: Object.assign(new Error('nope'), {code: 503, body: {errorCode: 78400011}}),
          expectedCode: 78400011,
          expectedMessage: 'nope',
        },
        {
          description: 'passes 0 when the rejection has no response body',
          error: Object.assign(new Error('network down'), {code: 503}),
          expectedCode: 0,
          expectedMessage: 'network down',
        },
        {
          description: 'passes 0 when the response body error code is not an integer',
          error: Object.assign(new Error('odd'), {body: {errorCode: '78400011'}}),
          expectedCode: 0,
          expectedMessage: 'odd',
        },
        {
          description: 'uses a default message when the rejection has none',
          error: {body: {errorCode: 78400003}},
          expectedCode: 78400003,
          expectedMessage: 'Request failed',
        },
      ].forEach(({description, error, expectedCode, expectedMessage}) => {
        it(`completes an http request as failed when the client rejects and ${description}`, async () => {
          const warnLog = stubLogger().warn;

          httpClient.request.rejects(error);

          callbacks.httpRequest({url: 'https://mes.webex.com/op', body: encodeJson({}), handlerId: 7});

          await flushPromises();

          assert.calledOnceWithExactly(
            warnLog,
            `e2ee: MLS --> HTTP request failed (url=https://mes.webex.com/op, errorCode=${expectedCode}): ${expectedMessage}`
          );
          assert.calledOnce(fakeE2ee.completeHttpRequest);

          const [handlerId, success, body, code, message] =
            fakeE2ee.completeHttpRequest.firstCall.args;

          assert.equal(handlerId, 7);
          assert.isFalse(success);
          assert.equal(body.length, 0);
          assert.equal(code, expectedCode);
          assert.equal(message, expectedMessage);
        });
      });

      it('emits mediaEncryptionRequestFailure instead of rejecting when the engine throws on a failed completion', async () => {
        const errorLog = stubLogger().error;
        const mediaEncryptionRequestFailure = sinon.stub();
        const unhandledRejection = sinon.stub();

        process.on('unhandledRejection', unhandledRejection);
        session.on('mediaEncryptionRequestFailure', mediaEncryptionRequestFailure);
        httpClient.request.rejects(Object.assign(new Error('not leader'), {body: {errorCode: 78400011}}));
        // Emscripten surfaces a thrown C++ exception as its numeric pointer.
        fakeE2ee.completeHttpRequest.throws(12345);

        try {
          callbacks.httpRequest({url: 'https://mes.webex.com/op', body: encodeJson({}), handlerId: 7});

          await flushPromises();
          await flushPromises();
        } finally {
          process.off('unhandledRejection', unhandledRejection);
        }

        assert.calledOnce(fakeE2ee.completeHttpRequest);
        assert.calledOnce(errorLog);
        assert.match(
          errorLog.firstCall.args[0],
          /^e2ee: MLS --> engine threw while completing HTTP request \(success=false, errorCode=78400011\): /
        );
        assert.calledOnceWithExactly(mediaEncryptionRequestFailure, {errorCode: 78400011, message: 'not leader'});
        assert.notCalled(unhandledRejection);
      });

      it('emits mediaEncryptionRequestFailure without retrying completion when the engine throws on a successful completion', async () => {
        const errorLog = stubLogger().error;
        const mediaEncryptionRequestFailure = sinon.stub();

        session.on('mediaEncryptionRequestFailure', mediaEncryptionRequestFailure);
        fakeE2ee.completeHttpRequest.throws(new Error('json parse'));

        callbacks.httpRequest({url: 'https://mes.webex.com/op', body: encodeJson({}), handlerId: 7});

        await flushPromises();

        assert.calledOnce(fakeE2ee.completeHttpRequest);
        assert.isTrue(fakeE2ee.completeHttpRequest.firstCall.args[1]);
        assert.calledOnceWithExactly(
          errorLog,
          'e2ee: MLS --> engine threw while completing HTTP request (success=true, errorCode=0): Error: json parse'
        );
        assert.calledOnceWithExactly(mediaEncryptionRequestFailure, {
          errorCode: 0,
          message: 'Engine failed to process HTTP response',
        });
      });

      it('logs and completes an http request as failed when the request body is not valid JSON', async () => {
        const errorLog = stubLogger().error;

        callbacks.httpRequest({
          url: 'https://mes.webex.com/op',
          body: new TextEncoder().encode('{not json'),
          handlerId: 8,
        });

        assert.notCalled(fakeE2ee.completeHttpRequest);

        await flushPromises();

        assert.notCalled(httpClient.request);
        assert.calledOnce(errorLog);
        assert.match(
          errorLog.firstCall.args[0],
          /^e2ee: MLS --> failed to parse engine HTTP request body as JSON \(url=https:\/\/mes\.webex\.com\/op\): /
        );
        assert.calledOnce(fakeE2ee.completeHttpRequest);

        const [handlerId, success, body, code, message] =
          fakeE2ee.completeHttpRequest.firstCall.args;

        assert.equal(handlerId, 8);
        assert.isFalse(success);
        assert.equal(body.length, 0);
        assert.equal(code, 0);
        assert.match(message, /^Invalid JSON in HTTP request body: /);
      });

      it('logs and completes an http request as failed when the response cannot be serialized to JSON', async () => {
        const errorLog = stubLogger().error;

        httpClient.request.resolves({big: BigInt(1)});

        callbacks.httpRequest({url: 'https://mes.webex.com/op', body: encodeJson({}), handlerId: 9});

        await flushPromises();

        assert.calledOnceWithExactly(httpClient.request, 'https://mes.webex.com/op', {});
        assert.calledOnce(errorLog);
        assert.match(
          errorLog.firstCall.args[0],
          /^e2ee: MLS --> failed to serialize HTTP response body as JSON \(url=https:\/\/mes\.webex\.com\/op\): /
        );
        assert.calledOnce(fakeE2ee.completeHttpRequest);

        const [handlerId, success, body, code, message] =
          fakeE2ee.completeHttpRequest.firstCall.args;

        assert.equal(handlerId, 9);
        assert.isFalse(success);
        assert.equal(body.length, 0);
        assert.equal(code, 0);
        assert.match(message, /^Unserializable HTTP response body: /);
      });

      it('schedules a wait and completes it', () => {
        const setTimeoutStub = sinon.stub(global, 'setTimeout');

        callbacks.wait(1500, 11);

        assert.calledOnce(setTimeoutStub);
        assert.equal(setTimeoutStub.firstCall.args[1], 1500);
        assert.notCalled(fakeE2ee.completeWait);

        setTimeoutStub.firstCall.args[0]();

        assert.calledOnceWithExactly(fakeE2ee.completeWait, 11);
      });
    });

    describe('log routing', () => {
      beforeEach(async () => {
        await session.initialize(config);
      });

      it('maps WASM log levels to the plugin logger', () => {
        const logger = stubLogger();

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
        session.setLlmConnectedBeforeJoin(true);
        session.llmConnected();

        assert.calledOnce(fakeE2ee.join);
        assert.calledOnce(fakeE2ee.leave);
        assert.calledOnce(fakeE2ee.handle);
        assert.deepEqual(Array.from(fakeE2ee.handle.firstCall.args[0]), [1, 2, 3]);
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
