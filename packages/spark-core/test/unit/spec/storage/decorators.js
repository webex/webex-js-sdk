/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import {default as Spark} from '../../..';

describe(`spark-core`, () => {
  describe(`Decorators`, () => {
    it(`works`, () => {
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
          return assert.becomes(spark.storage.get(`Credentials`, `authorization`), {
            access_token: `fake token`,
            token_type: `Bearer`
          });
        });
    });
  });
});
