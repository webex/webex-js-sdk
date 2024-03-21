/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@webex/webex-core';

import Webhooks from './webhooks';

registerPlugin('webhooks', Webhooks);

export default Webhooks;
