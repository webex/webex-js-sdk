/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var MetricsService = require('./metrics');
var Spark = require('../../../spark-core');
Spark.registerService('metrics', MetricsService);
module.exports = MetricsService;
