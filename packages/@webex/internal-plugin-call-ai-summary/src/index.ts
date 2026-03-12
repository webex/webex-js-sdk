/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-encryption';
import {registerInternalPlugin} from '@webex/webex-core';

import AISummary from './ai-summary';
import config from './config';

registerInternalPlugin('aisummary', AISummary, {config});

export {default} from './ai-summary';
