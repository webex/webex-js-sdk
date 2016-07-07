/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var BatchedRequestStore = require('../../../../src/lib/batched-request-store');
var assert = require('chai').assert;

describe('BatchedRequestStore', function() {
  var store;
  beforeEach(function() {
    store = new BatchedRequestStore();
  });

  function itRequiresAnId(method) {
    it('requires an id', function() {
      assert.throws(function() {
        store[method]();
      }, /`id` is a required parameter/);

      assert.doesNotThrow(function() {
        store[method]('some-id');
      }, /`id` is a required parameter/);
    });
  }

  function itThrowsIfNoRequestCanBeFound(method, error) {
    it('throws if no request can be found', function() {
      assert.throws(function() {
        store[method]('some-id', error);
      }, /No outstanding request for specified identifier\(s\)/);
    });
  }

  describe('#create()', function() {
    itRequiresAnId('create');

    it('adds an request to the store', function() {
      assert.throws(function() {
        store.get('some-id');
      }, /No outstanding request for specified identifier\(s\)/);
      var defer = store.create('some-id');

      var defer2 = store.get('some-id');
      assert.equal(defer2, defer);
    });

    it('throws if a request with the specifed identifier has already been added', function() {
      store.create('some-id');
      assert.throws(function() {
        store.create('some-id');
      }, /There is already an outstanding request for the specified identifier\(s\)/);
    });
  });

  describe('#fail()', function() {
    itThrowsIfNoRequestCanBeFound('fail', new Error('it failed'));

    it('rejects the specified request', function() {
      var defer = store.create('some-id');
      store.fail('some-id', new Error('it failed'));
      return assert.isRejected(defer.promise, /it failed/);
    });

    it('requires an error', function() {
      store.create('some-id');
      assert.throws(function() {
        store.fail('some-id');
      }, /`error` is a required parameter/);
    });
  });

  describe('#get()', function() {
    itRequiresAnId('get');
    itThrowsIfNoRequestCanBeFound('get');

    it('retrieves the desired request', function() {
      var defer = store.create('some-id');
      assert.equal(store.get('some-id'), defer);
    });
  });

  describe('#remove()', function() {
    itRequiresAnId('remove');

    it('removes the specified request from the store', function() {
      store.create('some-id');
      assert.isDefined(store.get('some-id'));
      store.remove('some-id');
      assert.throws(function() {
        store.get('some-id');
      }, /No outstanding request for specified identifier\(s\)/);
    });

    it('does not throw if the request cannot be found', function() {
      assert.throws(function() {
        store.get('some-id');
      }, /No outstanding request for specified identifier\(s\)/);

      assert.doesNotThrow(function() {
        store.remove('some-id');
      });
    });
  });

  describe('#succeed()', function() {
    itThrowsIfNoRequestCanBeFound('get');

    it('resolves the specified request', function() {
      var defer = store.create('some-id');
      store.succeed('some-id', 'it worked!');
      return assert.isFulfilled(defer.promise, /it worked!/);
    });

    it('requires a result', function() {
      store.create('some-id');
      assert.throws(function() {
        store.succeed('some-id');
      }, /`result` is a required parameter/);
    });
  });

  describe('#_generateIndex()', function() {
    itRequiresAnId('_generateIndex');

    it('maps a set of input parameters to an id', function() {
      // Note: this test is trivial; extended implementations will require more
      // robust tests.
      assert.equal(store._generateIndex('some-id'), 'some-id');
    });
  });

});
