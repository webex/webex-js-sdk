/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var BoardService = require('./board');
var Spark = require('../../../spark-core');
Spark.registerService('board', BoardService);
module.exports = BoardService;
