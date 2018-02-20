/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-locus';
import '@ciscospark/internal-plugin-metrics';
import '@ciscospark/plugin-people';
import {registerPlugin} from '@ciscospark/spark-core';

import Phone from './phone';
import config from './config';

export default Phone;
export {events as phoneEvents} from './phone';
export {default as Call} from './call';
export {default as boolToStatus} from './bool-to-status';

// exporting for testing purposes, hence not exporting the whole thing.
export {remoteParticipant} from './state-parsers';

export {default as StatsFilter} from './stats/filter';
export {default as StatsStream} from './stats/stream';

registerPlugin('phone', Phone, {config});
