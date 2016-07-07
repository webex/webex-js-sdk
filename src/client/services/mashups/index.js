/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var MashupsService = require('./mashups');
var Spark = require('../../../spark-core');

Spark.registerService('mashups', MashupsService);

module.exports = MashupsService;
