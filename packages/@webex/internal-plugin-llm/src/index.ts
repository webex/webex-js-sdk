import * as WebexCore from '@webex/webex-core';
import LLMPlugin, {config} from './llm-plugin';
import {DataChannelTokenType} from './llm.types';

export type {RegisterAndConnectTiming} from './llm.types';

WebexCore.registerInternalPlugin('llm', LLMPlugin, {
  config,
  onBeforeLogout() {
    return this.disconnectAll();
  },
});

export {DataChannelTokenType};
export {LLM_DEFAULT_SESSION, LLM_PRACTICE_SESSION} from './constants';
export {default} from './llm';
export {default as LLMPlugin} from './llm-plugin';
export type {ILLMChannel, ILLMPlugin} from './llm.types';
