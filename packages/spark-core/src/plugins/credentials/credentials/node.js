/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import SparkPlugin from '../../../lib/spark-plugin';
import common from './common';
import {persist} from '../../../lib/storage';
/**
 * @class
 * @extends CredentialsBase
 */
const Credentials = SparkPlugin.extend(Object.assign({}, common, {
  @persist(`authorization`)
  @persist(`clientAuthorization`)
  initialize(...args) {
    return Reflect.apply(common.initialize || SparkPlugin.prototype.initialize, this, args);
  }
}));

export default Credentials;
