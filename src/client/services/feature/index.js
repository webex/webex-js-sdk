/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var FeatureService = require('./feature');
var Spark = require('../../../spark-core');
Spark.registerService('feature', FeatureService);
module.exports = FeatureService;
