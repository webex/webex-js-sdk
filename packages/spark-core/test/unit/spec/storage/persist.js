/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import {
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
});
