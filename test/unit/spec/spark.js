/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var clone = require('lodash.clone');
var Spark = require('../../../src');
var sinon = require('sinon');

var assert = chai.assert;

describe('Spark', function() {
  var spark;

  var config;
  var deviceFixture;
  var credentialsFixture;

  beforeEach(function() {
    credentialsFixture = clone(require('../fixtures/credentials-valid'));
    deviceFixture = clone(require('../fixtures/device'));
    config = {
      credentials: credentialsFixture,
      device: deviceFixture,
      config: {
        trackingIdPrefix: 'spark-js-sdk',
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
        metrics: {
          enableMetrics: false
        }
      }
    };

    spark = new Spark(config);
  });

  describe('#listening', function() {
    it('proxies to #mercury.listening', function() {
      assert.isFalse(spark.mercury.listening, 'Mercury is not listening');
      assert.isFalse(spark.listening, 'Spark is not listening when Mercury is not listening');
      spark.mercury.connected = true;
      assert.isTrue(spark.mercury.listening, 'Mercury is listening');
      assert.isTrue(spark.listening, 'Spark is listening when Mercury is listening');
    });
  });

  describe('#trackingId', function() {
    it('proxies to #client.trackingId', function() {
      assert.property(spark, 'trackingId');
      var sparkTrackingIdBase = spark.trackingId.split('_')[1];
      var clientTrackingIdBase = spark.client.trackingId.split('_')[1];
      assert.equal(sparkTrackingIdBase, clientTrackingIdBase);
      assert.isTrue(spark.trackingId.startsWith(spark.config.trackingIdPrefix));
    });

    it('generates trackingid with specified prefix and suffix', function() {
      var prefix = 'ITCLIENT';
      var suffix = 'imi:true';
      var newConfig = clone(config);
      newConfig.config.trackingIdPrefix = prefix;
      newConfig.config.trackingIdSuffix = suffix;
      spark = new Spark(newConfig);
      assert.isTrue(spark.trackingId.startsWith(prefix));
      assert.isTrue(spark.trackingId.endsWith(suffix));
    });
  });

  describe('#version', function() {
    it('exists', function() {
      assert.property(Spark, 'version');
    });
  });

  describe('.version', function() {
    it('exists', function() {
      assert.property(Spark, 'version');
    });
  });

  describe('#authenticate()', function() {
    it('proxies to #credentials.authenticate()', function() {
      sinon.stub(spark.credentials, 'authenticate').returns(Promise.resolve());
      sinon.stub(spark.device, 'refresh').returns(Promise.resolve({}));

      assert.notCalled(spark.credentials.authenticate);
      return spark.authenticate()
        .then(function() {
          assert.calledOnce(spark.credentials.authenticate);
        });
    });

    it('allows only one inflight request', function() {
      sinon.stub(spark.credentials, 'authenticate').returns(Promise.resolve());
      sinon.stub(spark.device, 'refresh').returns(Promise.resolve({}));

      var p1 = spark.authenticate();
      assert.instanceOf(p1, Promise);
      var p2 = spark.authenticate();
      assert.instanceOf(p2, Promise);
      assert.equal(p1, p2);
    });
  });

  describe('#request()', function() {
    it('proxies to #client.request()', function() {
      sinon.stub(spark.client, 'request').returns(Promise.resolve({statusCode: 200}));
      assert.notCalled(spark.client.request);
      return spark.request()
        .then(function() {
          assert.calledOnce(spark.client.request);
        });
    });

    it('allows only one inflight request', function() {
      sinon.stub(spark.client, 'request').returns(Promise.resolve());
      var p1 = spark.request();
      assert.instanceOf(p1, Promise);
      var p2 = spark.request();
      assert.instanceOf(p2, Promise);
      assert.equal(p1, p2);
    });
  });

  describe('#serialize', function() {
    it('excludes every property except #credentials and #device', function() {
      var s = spark.serialize();
      assert.property(s, 'device');
      assert.property(s, 'credentials');
      assert.lengthOf(Object.keys(s), 2);
    });
  });

  describe('#listening', function() {
    it('is false when the socket is closed', function() {
      assert.isFalse(spark.listening);
      assert.isFalse(spark.mercury.listening);
    });
  });

});
