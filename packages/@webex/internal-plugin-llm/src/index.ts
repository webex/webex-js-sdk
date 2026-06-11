import * as WebexCore from '@webex/webex-core';
import {config} from './llm';
import {LLMPlugin} from './llm-plugin';
import {DataChannelTokenType} from './llm.types';

WebexCore.registerInternalPlugin('llm', LLMPlugin, {
  config,
});

// DataChannelTokenType and session constants are kept for backward compat
// until plugin-meetings and internal-plugin-voicea are migrated.
export {DataChannelTokenType};
export {LLM_DEFAULT_SESSION, LLM_PRACTICE_SESSION} from './constants';
export {default} from './llm';
