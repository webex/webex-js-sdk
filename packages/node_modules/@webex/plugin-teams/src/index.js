/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@ciscospark/spark-core';

import Teams from './teams';

registerPlugin('teams', Teams);

export default Teams;
