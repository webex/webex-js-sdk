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
   * Creates a VoiceaChannel bound to the given LLMChannel
   * @param {LLMChannel} llmChannel - The LLM channel to use for voicea
   * @returns {VoiceaChannel} A new VoiceaChannel instance
   */
  public createChannel(llmChannel: LLMChannel): VoiceaChannel {
    // @ts-ignore - webex is available on WebexPlugin
    return new VoiceaChannel(llmChannel, this.webex);
  }
}

export default VoiceaPlugin;
