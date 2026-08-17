import {WebexPlugin} from '@webex/webex-core';
import type LLMChannel from '@webex/internal-plugin-llm';

import {VoiceaChannel} from './voicea';
import {VOICEA} from './constants';

/**
 * VoiceaPlugin - factory for creating VoiceaChannel instances
 * @export
 * @class VoiceaPlugin
 */
export class VoiceaPlugin extends WebexPlugin {
  namespace = VOICEA;

  /**
   * Creates a VoiceaChannel bound to the given LLMChannel.
   *
   * Note: VoiceaChannel does not take ownership of the LLMChannel.
   * The caller retains ownership and is responsible for the LLMChannel's
   * lifecycle (connection, disconnection, cleanup).
   *
   * @param {LLMChannel} llmChannel - The LLM channel to use for voicea
   * @returns {VoiceaChannel} a new VoiceaChannel instance
   */
  public createChannel(llmChannel: LLMChannel): VoiceaChannel {
    // @ts-ignore - webex is available on WebexPlugin
    const channel = new VoiceaChannel(llmChannel, this.webex.request.bind(this.webex));

    return channel;
  }
}

export default VoiceaPlugin;
