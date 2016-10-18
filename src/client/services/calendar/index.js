/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var CalendarService = require('./calendar');
var Spark = require('../../../spark-core');
Spark.registerService('calendar', CalendarService);
module.exports = CalendarService;
