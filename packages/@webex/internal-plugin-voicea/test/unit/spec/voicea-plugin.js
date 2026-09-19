import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import LLMChannel from '@webex/internal-plugin-llm';

import {VoiceaPlugin} from '@webex/internal-plugin-voicea/src/voicea-plugin';
import {VoiceaChannel} from '@webex/internal-plugin-voicea/src/voicea';

/**
 * Creates a mock LLM channel for testing
 * @returns {Object} Mock channel
 */
function createMockLLMChannel() {
  return {
    isConnected: sinon.stub().returns(true),
    getSocket: sinon.stub().returns({}),
    getBinding: sinon.stub().returns('binding'),
    getDatachannelUrl: sinon.stub().returns('datachannelUrl'),
    getLocusUrl: sinon.stub().returns('locusUrl'),
    isDataChannelTokenEnabled: sinon.stub().resolves(true),
    on: sinon.stub(),
    off: sinon.stub(),
  };
}

describe('plugin-voicea', () => {
  describe('VoiceaPlugin', () => {
    let webex;
    let plugin;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
          llm: LLMChannel,
        },
      });

      plugin = new VoiceaPlugin({}, {parent: webex});
    });

    afterEach(() => sinon.restore());

    describe('#createChannel', () => {
      it('creates a new VoiceaChannel instance', () => {
        const mockLLMChannel = createMockLLMChannel();

        const channel = plugin.createChannel(mockLLMChannel);

        assert.instanceOf(channel, VoiceaChannel);
      });

      it('creates a new VoiceaChannel instance without llmChannel', () => {
        const channel = plugin.createChannel();

        assert.instanceOf(channel, VoiceaChannel);
      });

      it('creates a new VoiceaChannel instance with undefined llmChannel', () => {
        const channel = plugin.createChannel(undefined);

        assert.instanceOf(channel, VoiceaChannel);
      });

      it('creates independent channels for multiple calls', () => {
        const mockLLMChannel1 = createMockLLMChannel();
        const mockLLMChannel2 = createMockLLMChannel();

        const channel1 = plugin.createChannel(mockLLMChannel1);
        const channel2 = plugin.createChannel(mockLLMChannel2);

        assert.notStrictEqual(channel1, channel2);
      });
    });

    describe('namespace', () => {
      it('has the correct namespace', () => {
        assert.equal(plugin.namespace, 'voicea');
      });
    });
  });
});
