/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const chai = require('chai');
const sinon = require('sinon');

const registerAssertions = require('./assertions');

chai.use(registerAssertions);
sinon.assert.expose(chai.assert, {prefix: ''});

module.exports = chai;
