import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import * as WebexCalling from '@webex/calling';
import Calling from '../../../dist/calling';

jest.mock('@webex/calling', () => ({
  __esModule: true,
  Logger: {setLogger() {}, setWebexLogger() {}, info() {}, warn() {}},
  createCallQueueClient() {},
  createCallRecordingClient() {},
}));
jest.mock('@webex/internal-plugin-device', () => ({}), {virtual: true});
jest.mock('@webex/internal-plugin-mercury', () => ({}), {virtual: true});
jest.mock('@webex/internal-plugin-encryption', () => ({}), {virtual: true});
jest.mock('@webex/plugin-logger', () => ({}), {virtual: true});
jest.mock('@webex/internal-plugin-support', () => ({}), {virtual: true});
jest.mock('@webex/webex-core', () => ({default: {extend: () => function Webex() {}}}));

describe('Calling call queue client', () => {
  let factory;
  let webex;
  let logger;
  let options;
  let queue;

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
