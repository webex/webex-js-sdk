/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-locus';
import '@ciscospark/plugin-metrics';

import {registerPlugin} from '@ciscospark/spark-core';
import Phone from './phone';

registerPlugin(`phone`, Phone);

export default Phone;
export {default as Call} from './call';
export {default as WebRTCMedia} from './web-rtc-media';
export {default as boolToStatus} from './bool-to-status';
