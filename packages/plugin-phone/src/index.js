/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-locus';
import '@ciscospark/plugin-metrics';

import {registerPlugin} from '@ciscospark/spark-core';
import Phone from './phone';

registerPlugin(`phone`, Phone);

export default Phone;
export {default as Call} from './call';
