/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AvatarService = require('./avatar');
var Spark = require('../../../spark-core');
Spark.registerService('avatar', AvatarService);
module.exports = AvatarService;
