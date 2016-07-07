/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

// Service Dependencies
require('../encryption');
require('../user');
require('../conversation');

// Extending conversation
require('./decrypter');
require('./encrypter');
require('./normalizer');

var TeamService = require('./team');
var Spark = require('../../../spark-core');
Spark.registerService('team', TeamService);
module.exports = TeamService;
