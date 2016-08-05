/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import Spark from '../../..';

describe(`spark-core`, () => {
  describe(`@persist`, () => {
    it(`writes the identified value into the store when the value changes`, () => {
      const spark = new Spark();

      sinon.stub(spark, `request`).returns(Promise.resolve({
        body: {
          access_token: `fake token`,
          token_type: `Bearer`
        }
      }));

      return spark.authorize({code: 5})
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
    // TODO this should be tests with MockSpark
    it.skip(`prevents the method from executing until the specified value changes`, () => {
      const spark = new Spark();
      spark.credentials.set({
        authorization: {
          refresh_token_expires: Date.now() - 10000,
          refresh_token: `refresh_token`
        }
      });

      sinon.stub(spark, `request`).returns(Promise.resolve({
        body: {
          access_token: `fake token @waitForValue`,
          token_type: `Bearer`
        }
      }));

      let resolve;
      sinon.stub(spark.boundedStorage, `get`).returns(new Promise((r) => {resolve = r;}));


      const promise = spark.credentials.getAuthorization();
      assert.notCalled(spark.request);
      resolve();
      return (promise)
        .then((auth) => {
          assert.called(spark.request);
          assert.equal(auth, `Bearer fake token @waitForValue`);
        });
    });
  });
});
