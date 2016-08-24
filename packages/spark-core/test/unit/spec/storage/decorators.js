/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import {
  Authorization,
  Credentials,
  MemoryStoreAdapter,
  makeSparkStore
} from '../../..';

describe(`spark-core`, () => {
  describe(`@persist`, () => {
    it(`writes the identified value into the store when the value changes`, () => {
      const spark = new MockSpark({
        children: {
          credentials: Credentials
        }
      });
      spark.config.storage = {
        boundedAdapter: MemoryStoreAdapter
      };

      spark.boundedStorage = makeSparkStore(`bounded`, spark);


      spark.request.returns(Promise.resolve({
        body: {
          access_token: `fake token`,
          token_type: `Bearer`
        }
      }));

      return spark.credentials.authorize({code: 5})
        .then(() => {
          assert.calledOnce(spark.request);
          return assert.becomes(spark.boundedStorage.get(`Credentials`, `authorization`), {
            access_token: `fake token`,
            token_type: `Bearer`
          });
        });
    });
  });

  describe(`@waitForValue`, () => {
    it(`prevents the method from executing until the specified value changes`, () => {
      const spark = new MockSpark({
        children: {
          credentials: Credentials
        }
      });
      spark.credentials.set({
        authorization: new Authorization({
          refresh_token_expires: Date.now() - 10000,
          refresh_token: `refresh_token`
        })
      });

      spark.request.returns(Promise.resolve({
        body: {
          access_token: `fake token @waitForValue`,
          token_type: `Bearer`
        }
      }));

      let resolve;
      sinon.stub(spark.boundedStorage, `get`).returns(new Promise((r) => {resolve = r;}));


      const promise = spark.credentials.getAuthorization();
      assert.notCalled(spark.request);
      assert.isTrue(spark.credentials.isAuthenticated, `spark is authenticated`);
      assert.isTrue(spark.credentials.isExpired, `spark's auth is expired`);
      assert.isTrue(spark.credentials.canRefresh, `spark can refresh`);

      resolve();
      return (promise)
        .then((auth) => {
          assert.equal(auth, `Bearer fake token @waitForValue`);
          assert.called(spark.request);
        });
    });
  });
});
