/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@ciscospark/spark-core';

import TeamMemberships from './team-memberships';

registerPlugin('teamMemberships', TeamMemberships);

export default TeamMemberships;
