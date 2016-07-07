/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

// Make sure Client doesn't do ack or ping/pong as it could disrupt test
// scenarios.
var config = require('../../../src/defaults');
require('../../../src');
config.mercury['enable-ping-pong'] = false;
config.mercury['enable-ack'] = false;

console.debug = console.debug || console.log;

// Log the test name before each test so that it's easier to find the relevent
// section of karma log output.
beforeEach(function logTestName() {
  console.log(this.currentTest.fullTitle());
});
