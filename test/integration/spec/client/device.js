/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var landingparty = require('../../lib/landingparty');
var sinon = require('sinon');
var skipInNode = require('../../../lib/mocha-helpers').skipInNode;

describe('Client', function() {
  this.timeout(60000);

  describe('Device', function() {
    var redshirt;
    function ensureRedshirt() {
      beforeEach(function beamDownRedshirt() {
        return landingparty.beamDownRedshirt({createClient: true})
          .then(function(rs) {
            redshirt = rs;
          });
      });

      afterEach(function killRedshirt() {
        return landingparty.killRedshirt(redshirt);
      });
    }

    describe('#_locate()', function() {
      ensureRedshirt();

      // There's something weird about the cert on ds.ciscospark.com. It works
      // fine in a web browser, but openssl doesn't like it
      skipInNode(it)('retrieves region data', function() {
        return redshirt.spark.device._locate()
          .then(function(regionData) {
            assert.isDefined(regionData.regionCode);
            assert.isDefined(regionData.clientAddress);
          });
      });

      it('does not fail', function() {
        sinon.stub(redshirt.spark, 'request').returns(Promise.reject({
          statusCode: 0,
          body: ''
        }));

        return redshirt.spark.device._locate();
      });
    });

    describe('#register()', function() {
      ensureRedshirt();

      // There's something weird about the cert on ds.ciscospark.com. It works
      // fine in a web browser, but openssl doesn't like it
      skipInNode(it)('includes the payload from the region service', function() {
        var request = redshirt.spark.request;
        var requestStub = sinon.stub(redshirt.spark, 'request', function() {
          return request.apply(redshirt.spark, arguments);
        });

        return redshirt.spark.device.register()
          .then(function() {
            assert.isDefined(requestStub.secondCall.args[0]);
            assert.isDefined(requestStub.secondCall.args[0].body);
            assert.isDefined(requestStub.secondCall.args[0].body.regionCode);
            assert.isDefined(requestStub.secondCall.args[0].body.clientAddress);
          });
      });

      describe('if the region service fails', function() {
        beforeEach(function() {
          sinon.stub(redshirt.spark.device, '_locate').returns(Promise.resolve({
            statusCode: 0,
            body: ''
          }));
        });

        it('does not fail', function() {
          return assert.isFulfilled(redshirt.spark.device.register());
        });
      });

      describe('in embargoed countries', function() {
        beforeEach(function() {
          sinon.stub(redshirt.spark.device, '_locate').returns(Promise.resolve({
            clientAddress: '192.0.2.10',
            countryCode: 'IR'
          }));
        });

        it('fails', function() {
          return assert.isRejected(redshirt.spark.device.register(), /Service is not available in your region/);
        });

      });
    });

    describe('#refresh()', function() {
      ensureRedshirt();

      // There's something weird about the cert on ds.ciscospark.com. It works
      // fine in a web browser, but openssl doesn't like it
      skipInNode(it)('includes the payload from the region service', function() {
        var request = redshirt.spark.request;
        var requestStub = sinon.stub(redshirt.spark, 'request', function() {
          return request.apply(redshirt.spark, arguments);
        });

        return redshirt.spark.device.refresh()
          .then(function() {
            assert.isDefined(requestStub.secondCall.args[0]);
            assert.isDefined(requestStub.secondCall.args[0].body);
            assert.isDefined(requestStub.secondCall.args[0].body.regionCode);
            assert.isDefined(requestStub.secondCall.args[0].body.clientAddress);
          });
      });

      describe('if the region service fails', function() {
        beforeEach(function() {
          sinon.stub(redshirt.spark.device, '_locate').returns(Promise.resolve({
            statusCode: 0,
            body: ''
          }));
        });

        it('does not fail', function() {
          return assert.isFulfilled(redshirt.spark.device.refresh());
        });
      });

      describe('in embargoed countries', function() {
        beforeEach(function() {
          sinon.stub(redshirt.spark.device, '_locate').returns(Promise.resolve({
            clientAddress: '192.0.2.10',
            countryCode: 'IR'
          }));
        });

        it('fails', function() {
          return assert.isRejected(redshirt.spark.device.refresh(), /Service is not available in your region/);
        });
      });
    });
  });
});
