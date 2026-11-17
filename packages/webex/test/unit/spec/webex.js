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
    queue = {dispose: sinon.spy()};
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

  it('disposes the previous client when clients are initialized again', async () => {
    const calling = await Calling.init({webex, callingConfig: config(true)});
    const replacement = {dispose: sinon.spy()};
    factory.returns(replacement);

    await calling.initializeClients();

    assert.calledOnce(queue.dispose);
    assert.strictEqual(calling.callQueueClient, replacement);
    await calling.deregister();
    assert.calledOnce(replacement.dispose);
  });

  it('continues initializing call recording when queue creation fails during registration', async () => {
    const recording = {};
    const recordingFactory = sinon.stub(WebexCalling, 'createCallRecordingClient').returns(recording);
    const callingConfig = config(true);
    callingConfig.clientConfig.callRecording = true;
    const calling = await Calling.init({webex, callingConfig});
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
    queue.dispose = sinon.stub().throws(new Error('Queue disposal failed'));

    await calling.initializeClients();

    assert.calledOnce(queue.dispose);
    assert.calledTwice(recordingFactory);
    assert.isUndefined(calling.callQueueClient);
    assert.strictEqual(calling.callRecordingClient, recording);
  });

  it('deregisters a queue-only client after registration', async () => {
    const calling = await Calling.init({webex, callingConfig: config(false)});
    calling.callingConfig.clientConfig.callQueue = true;

    await calling.register();
    await calling.deregister();

    assert.calledOnce(queue.dispose);
    assert.calledOnce(webex.internal.mercury.disconnect);
    assert.calledOnce(webex.internal.device.unregister);
    assert.isFalse(calling.registered);
  });
});
