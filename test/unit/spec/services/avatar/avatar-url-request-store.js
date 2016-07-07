/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AvatarUrlRequestStore = require('../../../../../src/client/services/avatar/avatar-url-batched-request-store');
var chai = require('chai');
var MockSpark = require('../../../lib/mock-spark');
var sinon = require('sinon');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Avatar', function() {
    describe('AvatarUrlRequestStore', function() {
      var store;
      var TIMER_DELAY = 20;
      var UUID0 = '88888888-4444-4444-4444-aaaaaaaaaaa0';

      beforeEach(function() {
        var spark = new MockSpark({
          children: {
            store: AvatarUrlRequestStore
          }
        });

        store = spark.store;

        spark.config = {
          avatar: {
            cacheExpiration: 1
          }
        };
      });

      function requireParameters(method) {
        it('requires an `id` parameter', function() {
          assert.throws(function() {
            store[method]();
          }, /`id` is a required parameter/);

          assert.doesNotThrow(function() {
            store[method](UUID0);
          }, /`id` is a required parameter/);
        });

        if (method !== 'remove') {
          it('requires a `size` parameter', function() {
            assert.throws(function() {
              store[method](UUID0);
            }, /`size` is a required parameter/);

            assert.doesNotThrow(function() {
              store[method](UUID0, 80);
            }, /`size` is a required parameter/);
          });
        }
      }

      describe('#create()', function() {
        requireParameters('create');

        it('creates a deferred object for an (id,size) pair', function() {
          var defer = store.create(UUID0, 80);
          assert.isDefined(defer);
          // assert.instanceOf(defer, Defer);
          assert.doesNotThrow(function() {
            store.get(UUID0, 80);
          }, /No outstanding request for specified identifier\(s\)/);
          assert.equal(store.get(UUID0, 80), defer);
        });

        it('fails if a deferred object already exists for an (id,size) pair', function() {
          store.create(UUID0, 80);
          assert.throws(function() {
            store.create(UUID0, 80);
          }, /There is already an outstanding request for the specified identifier\(s\)/);
        });
      });

      describe('#fail()', function() {
        it('requires an `error` parameter', function() {
          store.create(UUID0, 80);
          assert.throws(function() {
            store.fail(UUID0, 80);
          }, /`error` is a required parameter/);

          assert.doesNotThrow(function() {
            store.fail(UUID0, 80, new Error('something bad happened'));
          }, /`error` is a required parameter/);
        });

        it('rejects the deferred object for an (id,size) pair', function() {
          var defer = store.create(UUID0, 80);
          store.fail(UUID0, 80, new Error('something bad happened'));
          return assert.isRejected(defer.promise, /something bad happened/);
        });

        it('removes the deferred object for an (id,size) pair', function() {
          store.create(UUID0, 80);
          store.create(UUID0, 110);
          store.fail(UUID0, 80, new Error('something bad happened'));
          assert.throws(function() {
            store.get(UUID0, 80);
          }, /No outstanding request for specified identifier\(s\)/);
        });

        it('does not remove the object for an id if there are sizes left for that id', function() {
          store.create(UUID0, 80);
          store.create(UUID0, 110);
          store.fail(UUID0, 80, new Error('something bad happened'));
          assert.doesNotThrow(function() {
            store.get(UUID0, 110);
          });
          assert.throws(function() {
            store.get(UUID0, 80);
          }, /No outstanding request for specified identifier\(s\)/);
        });
      });

      describe('#get()', function() {
        requireParameters('get');

        it('retrieves the deferred object for an (id,size) pair', function() {
          var defer = store.create(UUID0, 80);
          assert.isDefined(defer);
          assert.equal(store.get(UUID0, 80), defer);
        });
      });

      describe('#remove()', function() {
        requireParameters('remove');

        it('removes the deferred object for an (id,size) pair', function() {
          store.create(UUID0, 80);
          store.create(UUID0, 110);

          assert.doesNotThrow(function() {
            store.get(UUID0, 80);
          });

          store.remove(UUID0, 80);
          assert.throws(function() {
            store.get(UUID0, 80);
          }, /No outstanding request for specified identifier\(s\)/);
        });

        it('removes the whole object for an id if size is not specified', function() {
          store.create(UUID0, 80);
          store.create(UUID0, 110);

          store.remove(UUID0);

          assert.throws(function() {
            store.get(UUID0, 80);
          }, /No outstanding request for specified identifier\(s\)/);
        });
      });

      describe('succeed()', function() {
        requireParameters('succeed');

        it('requires a `url` parameter', function() {
          assert.throws(function() {
            store.succeed(UUID0, 80);
          }, /`url` is a required parameter/);

          assert.doesNotThrow(function() {
            store.succeed(UUID0, 80, 'http://example.com/' + UUID0);
          }, /`url` is a required parameter/);
        });

        it('fails if no deferred object exists for a (id,size) pair', function() {
          assert.throws(function() {
            store.fail(UUID0, 80, new Error('something bad happened'));
          }, /No outstanding request for specified identifier\(s\)/);

          store.create(UUID0, 80);

          assert.doesNotThrow(function() {
            store.fail(UUID0, 80, new Error('something bad happened'));
          }, /No outstanding request for specified identifier\(s\)/);
        });

        it('resolves the deferred object for an (id,size) pair', function() {
          var defer = store.create(UUID0, 80);
          store.succeed(UUID0, 80, 'http://example.com/' + UUID0);
          return assert.becomes(defer.promise, 'http://example.com/' + UUID0);
        });

        it('sets a timer that clears a request', function() {
          store.create(UUID0, 80);
          store.succeed(UUID0, 80, 'http://example.com/' + UUID0);

          assert.doesNotThrow(function() {
            store.get(UUID0, 80);
          });

          return new Promise(function(resolve) {
            setTimeout(resolve, 2*TIMER_DELAY);
          })
            .then(function() {
              assert.throws(function() {
                store.get(UUID0, 80);
              }, /No outstanding request for specified identifier\(s\)/);
            });
        });
      });
    });
  });
});
