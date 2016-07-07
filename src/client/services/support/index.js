/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SupportService = require('./support');
var Spark = require('../../../spark-core');
Spark.registerService('support', SupportService);
module.exports = SupportService;
