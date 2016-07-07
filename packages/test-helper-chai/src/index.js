/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon = require('@ciscospark/test-helper-sinon');
var registerAssertions = require('./assertions');

chai.use(chaiAsPromised);
chai.use(registerAssertions);
sinon.assert.expose(chai.assert, {prefix: ''});

module.exports = chai;
