import * as WebexCore from '@webex/webex-core';
import LLMChannel, {config} from './llm';
import {DataChannelTokenType} from './llm.types';

WebexCore.registerInternalPlugin('llm', LLMChannel, {
  config,
});

export {DataChannelTokenType};
export {default} from './llm';
