/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import {
  Credentials,
  MemoryStoreAdapter,
  makeSparkStore
} from '../../..';
import lolex from 'lolex';

describe(`spark-core`, () => {
  describe(`@persist`, () => {
    let clock;
    beforeEach(() => {
      clock = lolex.install(Date.now());
    });

    afterEach(() => {
      clock.uninstall();
    });

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
          assert.equal(spark.credentials.authorization.access_token, `fake token`);
          assert.equal(spark.credentials.authorization.token_type, `Bearer`);
          clock.tick(1);
          return assert.becomes(spark.boundedStorage.get(`Credentials`, `authorization`), {
            access_token: `fake token`,
            token_type: `Bearer`
          });
        });
    });
  });
});
