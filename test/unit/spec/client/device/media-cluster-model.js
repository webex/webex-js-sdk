/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var MediaClusterModel = require('../../../../../src/client/device/media-cluster-model');
var sinon = require('sinon');

describe('Client', function() {
  describe('Device', function() {
    describe('MediaClusterModel', function() {
      var data = {
        id: 'cluster1',
        urls: [
          {
            url: 'http://server1/'
          },
          {
            url: 'http://server2/'
          }
        ]
      };

      var data2 = {
        id: 'cluster1',
        urls: [
          {
            url: 'http://server3/'
          }
        ]
      };

      var data3 = {
        id: 'cluster1',
        urls: [
          {
            url: 'lqt://server3/'
          }
        ]
      };

      it('sets the same urls twice', function() {
        var mcm = new MediaClusterModel();
        mcm.request = sinon.stub().returns(Promise.resolve({
          statusCode: 200
        }));
        mcm.set(data);
        assert.equal(data.id, mcm.id);
        assert.equal(data.urls.length, mcm.urls.length);
        mcm.set(data);
        assert.equal(data.id, mcm.id);
        assert.equal(data.urls.length, mcm.urls.length);
      });

      it('resets the urls', function() {
        var mcm = new MediaClusterModel();
        mcm.request = sinon.stub().returns(Promise.resolve({
          statusCode: 200
        }));
        mcm.set(data);
        assert.equal(data.id, mcm.id);
        assert.equal(data.urls.length, mcm.urls.length);
        mcm.set(data2);
        assert.equal(data2.id, mcm.id);
        assert.equal(data2.urls.length, mcm.urls.length);
      });

      it('check valid urls in a cluster', function(done) {
        var mcm = new MediaClusterModel();
        mcm.request = sinon.stub().returns(Promise.resolve({
          statusCode: 200
        }));
        mcm.set(data);
        var count = 0;
        mcm.urls.models.forEach(function(url) {
          url.on('change:reachable', function() {
            count++;
            if (count === mcm.urls.length) {
              assert.equal(data.id, mcm.id);
              assert.equal(data.urls.length, mcm.urls.length);
              assert.isTrue(mcm.reachable);
              assert.isNotNull(mcm.latency);
              done();
            }
          });
        });
      });

      it('checks non http(s) scheme urls are ignored in a cluster', function() {
        var mcm = new MediaClusterModel();
        mcm.set(data3);
        assert.equal(data3 .id, mcm.id);
        assert.equal(data3.urls.length, mcm.urls.length);
        assert.isFalse(mcm.reachable);
      });

      it('checks one invalid url in a cluster', function(done) {
        var mcm = new MediaClusterModel();
        mcm.request = sinon.stub().returns(Promise.resolve({
          statusCode: 200
        }));
        mcm.set(data);
        var count = 0;
        mcm.urls.models.forEach(function(url) {
          url.on('change:reachable', function() {
            count++;
            if (count === mcm.urls.length) {
              assert.equal(data.id, mcm.id);
              assert.equal(data.urls.length, mcm.urls.length);
              assert.isTrue(mcm.reachable);
              done();
            }
          });
        });
      });

      it('checks invalid urls in a cluster', function(done) {
        var mcm = new MediaClusterModel();
        mcm.request = sinon.stub().returns(Promise.reject({
          statusCode: 500
        }));
        mcm.set(data);
        var count = 0;
        mcm.urls.models.forEach(function(url) {
          url.on('change:reachable', function() {
            count++;
            if (count === mcm.urls.length) {
              assert.equal(data.id, mcm.id);
              assert.equal(data.urls.length, mcm.urls.length);
              assert.isFalse(mcm.reachable);
              done();
            }
          });
        });
      });
    });
  });
});
