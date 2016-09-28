/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-wdm';

import {registerPlugin} from '@ciscospark/spark-core';
import MachineAccount from './machine-account';
import config from './config';

registerPlugin(`machineAccount`, MachineAccount, {
  config
});

export {default as default} from './machine-account';
