/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var KMS = require('../../../../../../src/client/services/encryption/kms/kms');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');

var assert = chai.assert;
chai.use(chaiAsPromised);

describe('Services', function() {
  describe('Encryption', function() {
    describe('KMS', function() {
      var kms;
      beforeEach(function() {
        var client = {
          logger: {
            error: sinon.spy(),
            warn: sinon.spy(),
            log: sinon.spy(),
            info: sinon.spy(),
            debug: sinon.spy()
          }
        };

        var config = {
        };

        kms = new KMS({
          client: client,
          config: config
        });
      });

      describe('#createUnboundKeys()', function() {
        it('requires a `count` option', function() {
          return assert.isRejected(kms.createUnboundKeys(), /`options.count` is required/);
        });
      });

      describe('#retrieveKeys()', function() {
        it('requires a `uri` option', function() {
          return assert.isRejected(kms.retrieveKeys(), /`options.uri` is required/);
        });
      });

      describe('#_getAuthorization', function() {
        it('does not include a type string', function() {
          kms.parent = {
            credentials: {
              authorization: {
                toString: function() {
                  return 'Bearer ACCESSTOKEN';
                }
              },
              getAuthorization: function() {
                return Promise.resolve(this.authorization);
              }
            }
          };

          assert.isFulfilled(kms._getAuthorization(), 'ACCESSTOKEN');
        });
      });

    });
  });
});
