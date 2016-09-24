/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import common from './common';

/**
 * @class
 * @extends CredentialsBase
 */
const Credentials = SparkPlugin.extend(common);

export default Credentials;
export {apiScope} from './common';
