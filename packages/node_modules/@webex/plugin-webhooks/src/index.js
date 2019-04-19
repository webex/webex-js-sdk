/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@ciscospark/spark-core';

import Webhooks from './webhooks';

registerPlugin('webhooks', Webhooks);

export default Webhooks;
