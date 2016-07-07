/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var landingparty = require('../../../lib/landingparty');
var sinon = require('sinon');

describe('Client', function() {
  describe('Services', function() {
    describe('Encryption', function() {
      describe('KMS', function() {
        this.timeout(30000);
        var party = {
          spock: true
        };

        before(function beamDown() {
          return landingparty.beamDown(party);
        });

        describe('#ping()', function() {
          it('sends a ping to the KMS', function() {
            return party.spock.spark.encryption.kms.ping();
          });
        });

        describe('ecdhe negotiation timeouts', function() {
          var redshirt;
          before(function() {
            return landingparty.beamDownRedshirt({createClient: true})
              .then(function(rs) {
                redshirt = rs;
              });
          });

          after(function() {
            if (redshirt) {
              return landingparty.killRedshirt(redshirt)
                .catch(function(reason) {
                  console.warn('failed to delete redshirt', reason);
                });
            }
          });

          it('handles late ecdhe response', function() {
            // Set the timeout too short to succeed.
            redshirt.spark.config.encryption.kmsInitialTimeout = 100;
            sinon.spy(redshirt.spark.encryption.kms, '_prepareECDHERequest');
            return redshirt.spark.encryption.kms.ping()
              .then(function() {
                assert.isAbove(redshirt.spark.encryption.kms._prepareECDHERequest.callCount, 1, 'If this assertion failed with "expected 1 to be above 1", then we\'ve achieved amazing performance gains in cloudapps and managed to do an ecdhe exchange in less than 100ms. Please update this test accordingly');
              });
          });
        });

        describe('#createUnboundKeys()', function() {
          it('requests unbound keys from the KMS', function() {
            return party.spock.spark.encryption.kms.createUnboundKeys({count: 2})
              .then(function(keys) {
                assert.lengthOf(keys, 2);
                assert.isString(keys[0].keyUrl);
                assert.isObject(keys[0].keyValue);
                assert.isString(keys[1].keyUrl);
                assert.isObject(keys[1].keyValue);
              });
          });
        });

        describe('#retrieveKey()', function() {
          it('retrieves a specific key', function() {
            return party.spock.spark.encryption.kms.createUnboundKeys({count: 1})
              .then(function(keys) {
                assert.lengthOf(keys, 1);
                return party.spock.spark.encryption.kms.retrieveKeys({uri: keys[0].keyUrl})
                  .then(function(key) {
                    assert.isString(key.keyUrl);
                    assert.isObject(key.keyValue);
                    assert.equal(key.keyUrl, keys[0].keyUrl);
                  });
              });
          });

          it('retrieves all keys bound to a specific resource');
          it('retrieves a subset of keys bound to a specific resource');
        });

      });
    });
  });
});
