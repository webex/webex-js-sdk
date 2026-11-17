/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Webex from 'webex';
// As part of npm its trying to pull all the dependencies, internal-media-core
// tries to access the winow object which causes the test to fail. Mocking the
// whole plugin-meetings package.
jest.mock('../../../../@webex/plugin-meetings', () => {
  return {
    someMethod: jest.fn(() => 'mocked value'),
  };
});
jest.mock('@webex/internal-plugin-calendar');

const mockWorker = {
  postMessage: jest.fn(),
  onmessage: jest.fn(),
};

global.Worker = jest.fn(() => mockWorker);

global.URL.createObjectURL = function (blob) {
  return 'blob:http://localhost:3000/12345';
};

describe('webex', () => {
  describe('Webex', () => {
    describe('.version', () => {
      it('exists', () => {
        assert.property(Webex, 'version');
        assert.equal(Webex.version, '0.0.0');
      });
    });

    describe('#version', () => {
      it('exists', () => {
        const webex = new Webex();

        assert.property(webex, 'version');
        assert.equal(webex.version, '0.0.0');
      });
    });

    describe('encryption.assetsBaseUrl', () => {
      it('serves assets from the page origin for unversioned builds', () => {
        const webex = Webex.init();

        assert.equal(webex.config.encryption.assetsBaseUrl, '/assets/internal-plugin-encryption/');
      });

      it('can be overridden', () => {
        const assetsBaseUrl = 'https://cdn.example.com/internal-plugin-encryption/';
        const webex = Webex.init({config: {encryption: {assetsBaseUrl}}});

        assert.equal(webex.config.encryption.assetsBaseUrl, assetsBaseUrl);
      });
    });

    describe('fedramp', () => {
      let webex;

      const fedramp = {
        hydra: 'https://api-usgov.webex.com/v1',
        u2c: 'https://u2c.gov.ciscospark.com/u2c/api/v1',
      };

      it('is set false by default', () => {
        webex = new Webex();
        assert.equal(webex.config.fedramp, false);
      });

      it('sets correct services when fedramp is true', () => {
        webex = Webex.init({
          config: {
            fedramp: true,
          },
          credentials: {
            access_token: process.env.token,
          },
        });

        assert.property(webex.config, 'fedramp');
        assert.equal(webex.config.fedramp, true);
        assert.property(webex.config.services, 'discovery');
        assert.equal(webex.config.services.discovery.hydra, fedramp.hydra);
        assert.equal(webex.config.services.discovery.u2c, fedramp.u2c);
      });
    });
  });
});

describe('Calling call queue client', () => {
  let Calling;
  let WebexCalling;
  let factory;
  let webex;
  let logger;
  let options;
  let queue;

  beforeAll(() => {
    jest.isolateModules(() => {
      jest.doMock('@webex/calling', () => ({
        __esModule: true,
        Logger: {setLogger() {}, setWebexLogger() {}, info() {}, warn() {}},
        createClient() {},
        createCallQueueClient() {},
        createCallRecordingClient() {},
      }));
      jest.doMock('@webex/internal-plugin-device', () => ({}));
      jest.doMock('@webex/internal-plugin-mercury', () => ({}));
      jest.doMock('@webex/internal-plugin-encryption', () => ({}));
      jest.doMock('@webex/plugin-logger', () => ({}));
      jest.doMock('@webex/internal-plugin-support', () => ({}));
      jest.doMock('@webex/webex-core', () => ({default: {extend: () => function Webex() {}}}));
      WebexCalling = require('@webex/calling');
      Calling = require('../../../dist/calling').default;
    });
  });

  afterAll(() => {
    [
      '@webex/calling',
      '@webex/internal-plugin-device',
      '@webex/internal-plugin-mercury',
      '@webex/internal-plugin-encryption',
      '@webex/plugin-logger',
      '@webex/internal-plugin-support',
      '@webex/webex-core',
    ].forEach((name) => jest.dontMock(name));
  });

  beforeEach(() => {
    queue = {dispose: sinon.spy(), prepareForReuse: sinon.stub().returns(true)};
    factory = sinon.stub(WebexCalling, 'createCallQueueClient').returns(queue);
    logger = {level: 'info'};
    options = {webexApiBaseUrl: 'https://integration.webexapis.com'};
    webex = {
      logger: {config: {}},
      internal: {
        device: {register: sinon.stub().resolves(), unregister: sinon.stub().resolves()},
        mercury: {connect: sinon.stub().resolves(), disconnect: sinon.stub().resolves()},
      },
    };
  });

  afterEach(() => sinon.restore());

  function config(callQueue) {
    return {
      clientConfig: {callQueue},
      callingClientConfig: {},
      callQueueClientConfig: options,
      logger,
    };
  }

  it('creates the client using the configured API origin', async () => {
    const calling = await Calling.init({webex, callingConfig: config(true)});

    assert.calledOnceWithExactly(factory, webex, logger, options);
    assert.strictEqual(calling.callQueueClient, queue);
    await calling.deregister();
    assert.calledOnce(queue.dispose);
    assert.isUndefined(calling.callQueueClient);
  });

  it('does not create a client unless enabled', async () => {
    const calling = await Calling.init({webex, callingConfig: config(false)});

    assert.notCalled(factory);
    assert.isUndefined(calling.callQueueClient);
  });

  it('continues initializing call recording when queue creation fails', async () => {
    const recording = {};
    const recordingFactory = sinon.stub(WebexCalling, 'createCallRecordingClient').returns(recording);
    const warning = sinon.spy(WebexCalling.Logger, 'warn');
    const callingConfig = config(true);
    callingConfig.clientConfig.callRecording = true;
    factory.throws(new Error('Invalid call queue configuration'));

    const calling = await Calling.init({webex, callingConfig});

    assert.calledOnceWithExactly(factory, webex, logger, options);
    assert.calledOnceWithExactly(recordingFactory, webex, logger);
    assert.isUndefined(calling.callQueueClient);
    assert.strictEqual(calling.callRecordingClient, recording);
    assert.calledOnce(warning);
  });

  it('reuses the previous client when clients are initialized again', async () => {
    const calling = await Calling.init({webex, callingConfig: config(true)});

    await calling.initializeClients();

    assert.notCalled(queue.dispose);
    assert.calledOnce(factory);
    assert.strictEqual(calling.callQueueClient, queue);
    await calling.deregister();
    assert.calledOnce(queue.dispose);
  });

  it.each(['apiBaseUrl', 'webex', 'logger', 'account'])(
    'replaces the queue client when %s changes',
    async (changed) => {
      webex.internal.device.userId = 'person-one';
      const callingConfig = config(true);
      const calling = await Calling.init({webex, callingConfig});
      const replacement = {dispose: sinon.spy()};
      factory.returns(replacement);

      if (changed === 'apiBaseUrl') options.webexApiBaseUrl = 'https://webexapis.com';
      if (changed === 'webex') calling.webex = {...webex};
      if (changed === 'logger') logger.level = 'debug';
      if (changed === 'account') webex.internal.device.userId = 'person-two';

      await calling.initializeClients();

      assert.calledOnce(queue.dispose);
      assert.calledTwice(factory);
      assert.strictEqual(calling.callQueueClient, replacement);
      await calling.deregister();
      assert.calledOnce(replacement.dispose);
    }
  );

  it('replaces the client when device identity becomes available after initialization', async () => {
    const calling = await Calling.init({webex, callingConfig: config(true)});
    const replacement = {dispose: sinon.spy(), prepareForReuse: sinon.stub().returns(true)};
    factory.returns(replacement);
    webex.internal.device.userId = 'person-one';
    webex.internal.device.orgId = 'org-one';

    await calling.initializeClients();

    assert.calledTwice(factory);
    assert.calledOnce(queue.dispose);
    assert.strictEqual(calling.callQueueClient, replacement);
  });

  it('reuses the queue client when registration completes with the same identity', async () => {
    webex.internal.device.userId = 'person-one';
    webex.internal.device.orgId = 'org-one';
    const calling = await Calling.init({webex, callingConfig: config(true)});

    await calling.register();

    assert.calledOnce(factory);
    assert.calledOnce(queue.prepareForReuse);
    assert.notCalled(queue.dispose);
    assert.strictEqual(calling.callQueueClient, queue);
  });

  it('replaces a client that has already been disposed', async () => {
    const calling = await Calling.init({webex, callingConfig: config(true)});
    const replacement = {dispose: sinon.spy(), prepareForReuse: sinon.stub().returns(true)};
    factory.returns(replacement);
    queue.prepareForReuse.returns(false);

    await calling.initializeClients();

    assert.calledOnce(queue.prepareForReuse);
    assert.calledOnce(queue.dispose);
    assert.calledTwice(factory);
    assert.strictEqual(calling.callQueueClient, replacement);
  });

  it('cleans up after readiness detection fails and continues initializing call recording', async () => {
    const recording = {};
    const recordingFactory = sinon.stub(WebexCalling, 'createCallRecordingClient').returns(recording);
    const warning = sinon.spy(WebexCalling.Logger, 'warn');
    const callingConfig = config(true);
    callingConfig.clientConfig.callRecording = true;
    const calling = await Calling.init({webex, callingConfig});
    queue.prepareForReuse.throws(new Error('Unexpected backend error'));

    await calling.initializeClients();

    assert.calledOnce(queue.dispose);
    assert.calledOnce(factory);
    assert.calledTwice(recordingFactory);
    assert.calledOnce(warning);
    assert.isUndefined(calling.callQueueClient);
    assert.strictEqual(calling.callRecordingClient, recording);
  });

  it('disposes the previous client when call queues are disabled', async () => {
    const callingConfig = config(true);
    const calling = await Calling.init({webex, callingConfig});
    callingConfig.clientConfig.callQueue = false;

    await calling.initializeClients();

    assert.calledOnce(queue.dispose);
    assert.calledOnce(factory);
    assert.isUndefined(calling.callQueueClient);
  });

  it('continues initializing call recording when queue creation fails during registration', async () => {
    const recording = {};
    const recordingFactory = sinon.stub(WebexCalling, 'createCallRecordingClient').returns(recording);
    const callingConfig = config(true);
    callingConfig.clientConfig.callRecording = true;
    const calling = await Calling.init({webex, callingConfig});
    sinon.stub(WebexCalling, 'createClient').resolves({getLines: () => ({})});
    callingConfig.clientConfig.calling = true;
    options.webexApiBaseUrl = 'https://webexapis.com';
    factory.throws(new Error('Queue initialization failed'));

    await calling.register();

    assert.calledOnce(queue.dispose);
    assert.calledTwice(recordingFactory);
    assert.isUndefined(calling.callQueueClient);
    assert.strictEqual(calling.callRecordingClient, recording);
    assert.isTrue(calling.registered);
    await calling.deregister();
  });

  it('continues initializing call recording when queue disposal fails', async () => {
    const recording = {};
    const recordingFactory = sinon.stub(WebexCalling, 'createCallRecordingClient').returns(recording);
    const callingConfig = config(true);
    callingConfig.clientConfig.callRecording = true;
    const calling = await Calling.init({webex, callingConfig});
    options.webexApiBaseUrl = 'https://webexapis.com';
    queue.dispose = sinon.stub().throws(new Error('Queue disposal failed'));

    await calling.initializeClients();

    assert.calledOnce(queue.dispose);
    assert.calledTwice(recordingFactory);
    assert.isUndefined(calling.callQueueClient);
    assert.strictEqual(calling.callRecordingClient, recording);
  });

  it('deregisters the queue and Calling clients after registration', async () => {
    const calling = await Calling.init({webex, callingConfig: config(false)});
    const line = {getStatus: sinon.stub().returns('active'), deregister: sinon.spy()};
    sinon.stub(WebexCalling, 'createClient').resolves({getLines: () => ({line})});
    calling.callingConfig.clientConfig.calling = true;
    calling.callingConfig.clientConfig.callQueue = true;

    await calling.register();
    await calling.deregister();

    assert.calledOnce(queue.dispose);
    assert.calledOnceWithExactly(line.deregister, true);
    assert.calledOnce(webex.internal.mercury.disconnect);
    assert.calledOnce(webex.internal.device.unregister);
    assert.isFalse(calling.registered);
  });
});
