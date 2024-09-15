import * as WebexCore from '@webex/webex-core';
import LLMChannel, {config} from './llm';

WebexCore.registerInternalPlugin('llm', LLMChannel, {
  config,
});

WebexCore.registerInternalPlugin('llmcc', LLMChannel, {
  skipAuth: true,
  skipAck: true,
  ...config,
});

export {default} from './llm';
