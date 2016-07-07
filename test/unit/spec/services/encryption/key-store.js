/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var cloneDeep = require('lodash.clonedeep');
var KeyStore = require('../../../../../src/client/services/encryption/key-store');

var assert = chai.assert;
chai.use(require('chai-as-promised'));

describe('Services', function() {
  describe('Encryption', function() {
    describe('KeyStore', function() {

      var keyStore;
      var boundKey1;
      var boundKey2;
      var unboundKey1;
      var unboundKey2;

      beforeEach(function() {
        keyStore = new KeyStore();

        boundKey1 = {
          keyUrl: 'http://example.com/boundKey1',
          keyValue: 'boundKey1'
        };

        boundKey2 = {
          keyUrl: 'http://example.com/boundKey2',
          keyValue: 'boundKey2'
        };

        unboundKey1 = {
          keyUrl: 'http://example.com/unboundKey1',
          keyValue: 'unboundKey1'
        };

        unboundKey2 = {
          keyUrl: 'http://example.com/unboundKey2',
          keyValue: 'unboundKey2'
        };
      });

      describe('#add()', function() {
        it('adds a bound key to the store', function() {
          return keyStore.add(boundKey1)
            .then(function() {
              return assert.becomes(keyStore.get(boundKey1.keyUrl), boundKey1);
            });
        });

        it('adds an array of bound keys to the key store', function() {
          return keyStore.add([
            boundKey1,
            boundKey2
          ])
            .then(function() {
              return Promise.all([
                assert.becomes(keyStore.get(boundKey1.keyUrl), boundKey1),
                assert.becomes(keyStore.get(boundKey2.keyUrl), boundKey2)
              ]);
            });
        });

        it('rejects a key if it appears invalid', function() {
          return Promise.all([
            assert.isRejected(keyStore.add(), /`key` does not appear to be a valid Key/),
            assert.isRejected(keyStore.add({}), /`key` does not appear to be a valid Key/)
          ]);
        });

        it('merges a key if it is already in the key store', function() {
          var boundKey1Supplement = cloneDeep(boundKey1);
          boundKey1Supplement.supplemental = 'some new value';

          return keyStore.add(boundKey1)
            .then(function() {
              return keyStore.add(boundKey1Supplement);
            })
            .then(function() {
              assert.deepEqual(boundKey1, boundKey1Supplement);
              return assert.becomes(keyStore.get(boundKey1.keyUrl), boundKey1);
            })
            .then(function() {
              return keyStore.get(boundKey1.keyUrl);
            })
            .then(function(retrievedBoundKey1) {
              // assert.becomes uses deepEqual, so we need to use equal to
              // ensure references are set up as expected
              assert.notEqual(retrievedBoundKey1, boundKey1Supplement);
            });
        });

        it('returns a resolved promise on success', function() {
          return assert.isFulfilled(keyStore.add(boundKey1));
        });
      });

      describe('#addUnused()', function() {
        it('adds an unbound key to the store', function() {
          return keyStore.addUnused(unboundKey1)
            .then(function() {
              return assert.becomes(keyStore.getUnused(), unboundKey1);
            });
        });

        it('adds an array of unbound keys to the store', function() {
          return keyStore.addUnused([
            unboundKey1,
            unboundKey2
          ])
            .then(function() {
              return assert.becomes(keyStore.getUnused(), unboundKey1);
            })
            .then(function() {
              return assert.becomes(keyStore.getUnused(), unboundKey2);
            });
        });

        it('rejects a key if it appears invalid', function() {
          return Promise.all([
            assert.isRejected(keyStore.addUnused(), /`key` does not appear to be a valid Key/),
            assert.isRejected(keyStore.addUnused({}), /`key` does not appear to be a valid Key/)
          ]);
        });

        it('does not add the same key twice', function() {
          return keyStore.addUnused(unboundKey1)
            .then(function() {
              return keyStore.addUnused(unboundKey1);
            })
            .then(function() {
              return assert.isFulfilled(keyStore.getUnused());
            })
            .then(function() {
              return assert.isRejected(keyStore.getUnused());
            });
        });

        it('returns a resolved promise on success', function() {
          return assert.isFulfilled(keyStore.addUnused(unboundKey1));
        });
      });

      describe('#clear()', function() {
        it('removes bound keys', function() {
          return keyStore.add(boundKey1)
            .then(function() {
              return assert.becomes(keyStore.get(boundKey1.keyUrl), boundKey1);
            })
            .then(function() {
              return keyStore.clear();
            })
            .then(function() {
              return assert.isRejected(keyStore.get(boundKey1.keyUrl));
            });
        });

        it('removes unbound keys', function() {
          return keyStore.addUnused(unboundKey1)
            .then(function() {
              return assert.becomes(keyStore.getUnused(), unboundKey1);
            })
            .then(function() {
              return keyStore.clear();
            })
            .then(function() {
              return assert.isRejected(keyStore.getUnused());
            });
        });

        it('returns a resolved promise', function() {
          return assert.isFulfilled(keyStore.clear());
        });
      });

      describe('#get()', function() {
        it('rejects if `keyUrl` is not defined', function() {
          return assert.isRejected(keyStore.get(), /`keyUrl` is a required parameter/);
        });

        it('rejects if `keyUrl` does not appear to be a url', function() {
          return assert.isRejected(keyStore.get('not a url'), /`keyUrl` does not appear to be a URL/);
        });

        it('resolves if the requested key is available', function() {
          return keyStore.add(boundKey1)
            .then(function() {
              return assert.becomes(keyStore.get(boundKey1.keyUrl), boundKey1);
            });
        });

        it('rejects if the key is not available', function() {
          return assert.isRejected(keyStore.get(boundKey1.keyUrl), new RegExp('No key matches "' + boundKey1.keyUrl + '"'));
        });
      });

      describe('#getUnused()', function() {
        it('resolves if a key is found', function() {
          return keyStore.addUnused(unboundKey1)
            .then(function() {
              return assert.becomes(keyStore.getUnused(), unboundKey1);
            });
        });

        it('rejects if a key is not found', function() {
          return assert.isRejected(keyStore.getUnused(), /No unused keys available/);
        });

        it('removes the retrieved unbound key from the store', function() {
          return keyStore.addUnused(unboundKey1)
            .then(function() {
              return assert.becomes(keyStore.getUnused(), unboundKey1);
            })
            .then(function() {
              return assert.isRejected(keyStore.getUnused(), /No unused keys available/);
            });
        });
      });
    });
  });
});
