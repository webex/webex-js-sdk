/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint no-undef: [0] */

var chai = require('chai');
var Client = require('../../../../src/client');
var Credentials = require('../../../../src/client/credentials');
var cloneDeep = require('lodash.clonedeep');
var Device = require('../../../../src/client/device');
var MockSpark = require('../../lib/mock-spark');
var sinon = require('sinon');

var assert = chai.assert;
chai.use(require('chai-as-promised'));

describe('Client : Auth Processor', function() {
  var deviceFixture;
  var credentialsFixture;

  var client;

  beforeEach(function() {
    credentialsFixture = cloneDeep(require('../../fixtures/credentials-valid'));
    deviceFixture = cloneDeep(require('../../fixtures/device'));

    var spark = new MockSpark({
      children: {
        credentials: Credentials,
        device: Device,
        client: Client
      }
    });
    spark.credentials.set({authorization: credentialsFixture});
    spark.device.set(deviceFixture);

    spark.config = {
      credentials: {
        oauth: {
          /* eslint camelcase: [0] */
          client_id: process.env.COMMON_IDENTITY_CLIENT_ID,
          client_secret: process.env.COMMON_IDENTITY_CLIENT_SECRET,
          redirect_uri: process.env.COMMON_IDENTITY_REDIRECT_URI,
          scope: 'webexsquare:get_conversation Identity:SCIM',
          service: process.env.COMMON_IDENTITY_SERVICE
        }
      },
      device: require('../../../../src/defaults').device,
      metrics: {
        enableMetrics: false
      }
    };

    client = spark.client;
  });

  beforeEach(function() {
    sinon.stub(client, '_request').returns(Promise.resolve({
      statusCode: 200,
      body: {},
      options: {
        headers: {}
      }
    }));
  });

  describe('#pre()', function() {
    it('reauthenticates when credentials have expired');

    it('adds a user token to Spark API requests', function() {
      var options = [{
        api: 'conversation',
        resource: 'conversations'
      },
      {
        api: 'locus',
        resource: 'devices'
      }];

      return Promise.all(options.map(function(options) {
        return client.request(options)
          .then(function() {
            assert.isDefined(options.headers.Authorization);
            assert.equal(options.headers.Authorization, client.spark.credentials.authorization.apiToken.toString());
          });
      }));
    });

    it('adds a user token to device registration requests', function() {
      var options = [{
        api: 'locus',
        resource: 'devices'
      }];

      return Promise.all(options.map(function(options) {
        return client.request(options)
          .then(function() {
            assert.isDefined(options.headers.Authorization);
            assert.equal(options.headers.Authorization, client.spark.credentials.authorization.apiToken.toString());
          });
      }));
    });

    it('does not add an auth header to token requests');

    it('does not add an auth header to GeoIP requests', function() {
      var options = {
        api: 'region',
        resource: '/'
      };

      return client.request(options)
        .then(function() {
          assert.isUndefined(options.headers.Authorization);
          assert.isUndefined(options.headers.authorization);
        });
    });

    it('does not change the auth header if one has already been specified', function() {
      var options = [{
        api: 'conversation',
        resource: 'conversations',
        headers: {
          Authorization: 'fake auth header'
        }
      }];

      return Promise.all(options.map(function(options) {
        return client.request(options)
          .then(function() {
            assert.isDefined(options.headers.Authorization);
            assert.equal(options.headers.Authorization, 'fake auth header');
          });
      }));
    });
  });

  describe('#post', function() {
    describe.skip('#onReject()', function() {
      beforeEach(function() {
        fakeweb.registerUri({
          uri: 'https://idbroker.webex.com:443/idb/oauth2/v1/access_token',
          body: credentialsFixture
        });

        fakeweb.registerUri({
          uri: 'https://locus-a.wbx2.com:443/locus/api/v1/devices',
          body: deviceFixture
        });

        fakeweb.registerUri({
          uri: 'https://conv-a.wbx2.com:443/conversatio/api/v1/conversations',
          statusCode: 401,
          body: {}
        });

        sinon.spy(client, 'authenticate');
      });

      afterEach(function() {
        client.authenticate.restore();
      });

      it.skip('recovers from 401 responses', function() {
        return client.request({
          api: 'conversation',
          resource: 'conversations'
        })
          .then(function() {
            console.log(1);
          });
      });

      it('recovers from 404 responses to the device url');
    });
  });
});
