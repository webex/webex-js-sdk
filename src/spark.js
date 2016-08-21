/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

require('./client/services/avatar');
require('./client/services/board');
require('./client/services/bot');
require('./client/services/conversation');
require('./client/services/encryption');
require('./client/services/feature');
require('./client/services/flagging');
require('./client/services/metrics');
require('./client/services/support');
require('./client/services/search');
require('./client/services/team');
require('./client/services/mashups');
require('./client/services/user');

var Spark = require('./spark-core');

module.exports = Spark;
