/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var landingparty = require('../lib/landingparty');
var sinon = require('sinon');

chai.use(chaiAsPromised);

var Credentials = require('../../../src/client/credentials/credentials');
Credentials.prototype.initiateImplicitGrant = sinon.stub().returns(Promise.reject(new Error('attempted to invoke untestable code')));
Credentials.prototype.initiateAuthorizationCodeGrant = sinon.stub().returns(Promise.reject(new Error('attempted to invoke untestable code')));

if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
  // Log the test name before each test so that it's easier to find the relevent
  // section of karma log output.
  beforeEach(function logTestnName() {
    // Add some blank lines between the tests
    console.log('****************************************************************');
    console.log(this.currentTest.fullTitle());
    console.log('****************************************************************');
  });
}

after(function recallLandingParty() {
  this.timeout(60000);
  return landingparty.beamUp();
});
