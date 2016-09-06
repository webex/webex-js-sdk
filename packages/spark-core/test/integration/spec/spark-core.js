/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {SparkHttpError, default as Spark} from '../..';
import makeLocalUrl from '@ciscospark/test-helper-make-local-url';

describe(`spark-core`, function() {
  this.timeout(20000);
  describe(`Spark`, () => {

    describe(`#request()`, () => {
      let spark;
      before(() => {
        spark = new Spark();
      });

      it(`adds a tracking id to each request`, () => {
        return spark.request({
          uri: makeLocalUrl(`/`),
          headers: {
            authorization: false
          }
        })
          .then((res) => {
            assert.property(res.options.headers, `trackingid`);
          });
      });

      it(`fails with a SparkHttpError`, () => {
        return assert.isRejected(spark.request({
          uri: makeLocalUrl(`/not-a-route`),
          headers: {
            authorization: false
          },
          body: {
            proof: true
          }
        }))
          .then((err) => {
            assert.instanceOf(err, SparkHttpError);
            assert.instanceOf(err, SparkHttpError.BadRequest);

            assert.property(err, `options`);
            assert.property(err.options, `body`);
            assert.property(err.options.body, `proof`);
            assert.isTrue(err.options.body.proof);
          });
      });
    });
  });
});
