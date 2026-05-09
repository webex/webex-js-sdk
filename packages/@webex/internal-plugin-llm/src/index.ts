import * as WebexCore from '@webex/webex-core';
import LLMChannel, {config} from './llm';
import {DataChannelTokenType} from './llm.types';

WebexCore.registerInternalPlugin('llm', LLMChannel, {
  config,
});

export {DataChannelTokenType};
export {LLM_DEFAULT_SESSION, LLM_PRACTICE_SESSION} from './constants';
export {default} from './llm';
