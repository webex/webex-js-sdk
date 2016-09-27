/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {oneFlight} from '@ciscospark/common';
import SparkPlugin from '../../../lib/spark-plugin';
import common from './common';
import {persist, waitForValue} from '../../../lib/storage';

/**
 * @class
 * @extends CredentialsBase
 */
const Credentials = SparkPlugin.extend(Object.assign({}, common, {
  @oneFlight
  @waitForValue(`authorization`)
  authorize(...args) {
    return Reflect.apply(common.authorize, this, args);
  },

  @persist(`authorization`)
  @persist(`clientAuthorization`)
  initialize(...args) {
    return Reflect.apply(SparkPlugin.prototype.initialize, this, args);
  }
}));

export default Credentials;
