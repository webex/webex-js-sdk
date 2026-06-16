import * as WebexCore from '@webex/webex-core';
import LLMPlugin, {config} from './llm-plugin';
import {DataChannelTokenType} from './llm.types';

WebexCore.registerInternalPlugin('llm', LLMPlugin, {
  config,
});

export {DataChannelTokenType};
export {LLM_DEFAULT_SESSION, LLM_PRACTICE_SESSION} from './constants';
export {default} from './llm';
export {default as LLMPlugin} from './llm-plugin';
