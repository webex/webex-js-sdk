/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@webex/webex-core';

import Teams from './teams';

registerPlugin('teams', Teams);

export default Teams;
