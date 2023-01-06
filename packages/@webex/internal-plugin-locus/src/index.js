/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-mercury';
import {registerInternalPlugin} from '@webex/webex-core';

import Locus from './locus';

registerInternalPlugin('locus', Locus);

export default Locus;
export {locusEventKeys as eventKeys} from './event-keys';
export {USE_INCOMING, USE_CURRENT, EQUAL, FETCH, GREATER_THAN, LESS_THAN, DESYNC} from './locus';
