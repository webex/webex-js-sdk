/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

require('../conversation');
require('../encryption');
var SearchService = require('./search');
var Spark = require('../../../spark-core');

Spark.registerService('search', SearchService);

module.exports = SearchService;
