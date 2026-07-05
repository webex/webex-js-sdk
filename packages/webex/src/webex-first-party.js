/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// This file reuses webex.js but swaps in the first-party authorization plugin
require('@webex/plugin-authorization-browser-first-party');

module.exports = require('./webex');
