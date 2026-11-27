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

      it('preserves the merged U2C seed when fedramp is true', () => {
        const u2c = Webex.init().config.services.discovery.u2c;

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
        assert.equal(webex.config.services.discovery.u2c, u2c);
        assert.equal(webex.internal.services.get('u2c', 'discovery'), u2c);
      });

      it.each([fedramp.u2c, 'https://u2c.svc.webexgov.us/u2c/api/v1'])(
        'preserves the configured FedRAMP U2C URL %s',
        (u2c) => {
          webex = Webex.init({config: {fedramp: true, services: {discovery: {u2c}}}});

          assert.equal(webex.config.services.discovery.hydra, fedramp.hydra);
          assert.equal(webex.config.services.discovery.u2c, u2c);
          assert.equal(webex.internal.services.get('u2c', 'discovery'), u2c);
        }
      );
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
    factory = sinon.stub(WebexCalling, 'createCallQueueClient').callsFake(
      (instance, configLogger, configOptions, previous, enabled) => {
        if (enabled) return queue;
        previous?.dispose();

        return undefined;
      }
    );
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

    assert.calledOnceWithExactly(factory, webex, logger, options, undefined, true);
    assert.strictEqual(calling.callQueueClient, queue);
    await calling.deregister();
    assert.notCalled(queue.dispose);
    assert.strictEqual(calling.callQueueClient, queue);
  });

  it('does not create a client unless enabled', async () => {
    const calling = await Calling.init({webex, callingConfig: config(false)});

    assert.calledOnceWithExactly(factory, webex, logger, options, undefined, false);
    assert.isUndefined(calling.callQueueClient);
  });

  it('continues initializing call recording when queue creation fails', async () => {
    const recording = {};
    const recordingFactory = sinon.stub(WebexCalling, 'createCallRecordingClient').returns(recording);
    const callingConfig = config(true);
    callingConfig.clientConfig.callRecording = true;
    factory.returns(undefined);

    const calling = await Calling.init({webex, callingConfig});

    assert.calledOnceWithExactly(factory, webex, logger, options, undefined, true);
    assert.calledOnceWithExactly(recordingFactory, webex, logger);
    assert.isUndefined(calling.callQueueClient);
    assert.strictEqual(calling.callRecordingClient, recording);
  });

  it('passes the previous client to the queue factory when initialized again', async () => {
    const calling = await Calling.init({webex, callingConfig: config(true)});

    await calling.initializeClients();

    assert.calledTwice(factory);
    assert.calledWithExactly(factory.secondCall, webex, logger, options, queue, true);
    assert.notCalled(queue.dispose);
    assert.strictEqual(calling.callQueueClient, queue);
  });

  it('disposes the previous client when call queues are disabled', async () => {
    const callingConfig = config(true);
    const calling = await Calling.init({webex, callingConfig});
    callingConfig.clientConfig.callQueue = false;

    await calling.initializeClients();

    assert.calledOnce(queue.dispose);
    assert.calledTwice(factory);
    assert.calledWithExactly(factory.secondCall, webex, logger, options, queue, false);
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
    factory.callsFake((instance, configLogger, configOptions, previous) => {
      previous?.dispose();

      return undefined;
    });

    await calling.register();

    assert.calledTwice(factory);
    assert.calledWithExactly(factory.secondCall, webex, logger, options, queue, true);
    assert.calledOnce(queue.dispose);
    assert.calledTwice(recordingFactory);
    assert.isUndefined(calling.callQueueClient);
    assert.strictEqual(calling.callRecordingClient, recording);
    assert.isTrue(calling.registered);
    await calling.deregister();
  });

  it('deregisters active Calling lines after registration', async () => {
    const calling = await Calling.init({webex, callingConfig: config(false)});
    const line = {getStatus: sinon.stub().returns('active'), deregister: sinon.spy()};
    sinon.stub(WebexCalling, 'createClient').resolves({getLines: () => ({line})});
    calling.callingConfig.clientConfig.calling = true;
    calling.callingConfig.clientConfig.callQueue = true;

    await calling.register();
    await calling.deregister();

    assert.notCalled(queue.dispose);
    assert.calledOnceWithExactly(line.deregister, true);
    assert.calledOnce(webex.internal.mercury.disconnect);
    assert.calledOnce(webex.internal.device.unregister);
    assert.isFalse(calling.registered);
  });

  it('passes the retained queue client to the factory when registering again', async () => {
    const calling = await Calling.init({webex, callingConfig: config(true)});
    sinon.stub(WebexCalling, 'createClient').resolves({getLines: () => ({})});
    calling.callingConfig.clientConfig.calling = true;

    await calling.register();
    await calling.deregister();
    await calling.register();

    assert.calledThrice(factory);
    assert.calledWithExactly(factory.thirdCall, webex, logger, options, queue, true);
    assert.notCalled(queue.dispose);
    assert.strictEqual(calling.callQueueClient, queue);
  });
});
