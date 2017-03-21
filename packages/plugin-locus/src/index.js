/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/plugin-mercury';
import {registerPlugin} from '@ciscospark/spark-core';
import Locus from './locus';

registerPlugin(`locus`, Locus);

export default Locus;
export {locusEventKeys as eventKeys} from './event-keys';
export {USE_INCOMING, USE_CURRENT, EQUAL, FETCH} from './locus';
