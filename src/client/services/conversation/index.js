/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

require('../encryption');
require('../user');
var ConversationService = require('./conversation');
var Spark = require('../../../spark-core');
Spark.registerService('conversation', ConversationService);
module.exports = ConversationService;
