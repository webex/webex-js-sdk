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
        access_token: `fake token`,
        token_type: `Bearer`
      }));

      return spark.authorize({code: 5})
        .then(() => {
          assert.calledOnce(spark.request);
          return spark.storage._getBinding(`Credentials`)
        })
        .then((binding) => {
          console.log(binding);
          return spark.storage.get(`Credentials`, `authorization`)
            .then((d) => console.log(d));
        });
    });
  });
});
