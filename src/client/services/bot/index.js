/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var BotService = require('./bot');
var Spark = require('../../../spark-core');
Spark.registerService('bot', BotService);
module.exports = BotService;
