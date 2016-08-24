/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {assert} from '@ciscospark/test-helper-chai';

export default function runAbstractStorageAdapterSpec(adapter) {
  const key = `key`;
  const namespace = `namespace`;
  const obj = {a: 1};
  const primitive = 1;
  const options = {
    logger: console
  };

  describe(`#bind()`, () => {
    // namespace and options.logger are required more to make sure we always
    // call bind correctly rather than to make sure the adapter uses them.
    it(`requires a namespace`, () => assert.isRejected(adapter.bind(), /`namespace` is required/));

    it(`requires a logger option`, () => assert.isRejected(adapter.bind(namespace), /`options.logger` is required/));

    it(`returns a db interface`, () => assert.isFulfilled(adapter.bind(namespace, options)));

    describe(`bound`, () => {
      let bound;
      before(() => adapter.bind(namespace, options)
        .then((b) => {
          bound = b;
        }));

      describe(`#put()`, () => {
        it(`puts a primitive into the store`, () => bound.put(key, primitive)
          .then(() => assert.becomes(bound.get(key), primitive)));

        it(`puts an object into the store`, () => bound.put(key, obj)
          .then(() => assert.becomes(bound.get(key), obj)));

        it(`handles concurrency`, () => Promise.all([
          bound.put(key, 1),
          bound.put(key, 2),
          bound.put(key, 3)
        ])
          .then(() => assert.becomes(bound.get(key), 3)));
      });

      describe(`#get()`, () => {
        it(`gets a primitive from the store`, () => bound.put(key, primitive)
          .then(() => assert.becomes(bound.get(key), primitive)));

        it(`gets an object from the store`, () => bound.put(key, obj)
          .then(() => assert.becomes(bound.get(key), obj)));

        it(`rejects if the key cannot be found`, () => assert.isRejected(bound.get(`notakey`)));
      });

      describe(`#del()`, () => {
        it(`removes a primitive from the store`, () => bound.put(key, primitive)
          .then(() => assert.becomes(bound.get(key), primitive))
          .then(() => assert.isFulfilled(bound.del(key)))
          .then(() => assert.isRejected(bound.get(key))));

        it(`removes an object from the store`, () => bound.put(key, obj)
          .then(() => assert.becomes(bound.get(key), obj))
          .then(() => assert.isFulfilled(bound.del(key)))
          .then(() => assert.isRejected(bound.get(key))));
      });
    });
  });
}
