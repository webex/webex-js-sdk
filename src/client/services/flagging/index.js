/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var FlaggingServices = require('./flagging');
var Spark = require('../../../spark-core');
Spark.registerService('flagging', FlaggingServices);
module.exports = FlaggingServices;
