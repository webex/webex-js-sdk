/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@ciscospark/spark-core';

import Memberships from './memberships';

registerPlugin('memberships', Memberships);

export default Memberships;
