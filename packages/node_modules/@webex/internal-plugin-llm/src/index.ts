import * as WebexCore from '@webex/webex-core';
import LLMChannel, {config} from './llm';

WebexCore.registerInternalPlugin('llm', LLMChannel, {
  config,
});

export {default} from './llm';
