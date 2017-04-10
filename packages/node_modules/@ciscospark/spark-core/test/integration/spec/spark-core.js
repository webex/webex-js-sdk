/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import Spark, {SparkHttpError} from '../..';
import makeLocalUrl from '@ciscospark/test-helper-make-local-url';

describe(`spark-core`, function() {
  this.timeout(30000);
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
            // pattern is "spark-js-sdk", "uuid", "sequence number" joined with
            // underscores
            assert.match(res.options.headers.trackingid, /spark-js-sdk_[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}_\d+/);
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

    describe(`#logout()`, () => {
      let spark;
      beforeEach(() => {
        spark = new Spark();
        spark.mercury = {
          disconnect: sinon.spy()
        };
        spark.device = {
          unregister: sinon.stub().returns(Promise.resolve())
        };
        spark.credentials = {
          logout: sinon.stub().returns(Promise.resolve())
        };
        sinon.spy(spark.boundedStorage, `clear`);
        sinon.spy(spark.unboundedStorage, `clear`);
      });

      it(`logouts successfully if device is not registered`, () => {
        spark.device = {
          unregister: sinon.stub().returns(Promise.reject())
        };
        const promise = spark.logout();
        return assert.isFulfilled(promise)
          .then(() => {
            assert.calledOnce(spark.mercury.disconnect);
            assert.calledOnce(spark.device.unregister);
            assert.calledOnce(spark.boundedStorage.clear);
            assert.calledOnce(spark.unboundedStorage.clear);
            assert.calledOnce(spark.credentials.logout);
          });
      });

      it(`logouts successfully if mercury is not defined`, () => {
        spark.mercury = undefined;
        const promise = spark.logout();
        return assert.isFulfilled(promise)
          .then(() => {
            assert.calledOnce(spark.device.unregister);
            assert.calledOnce(spark.boundedStorage.clear);
            assert.calledOnce(spark.unboundedStorage.clear);
            assert.calledOnce(spark.credentials.logout);
          });
      });

      it(`logouts the user if user is logged in`, () => {
        const promise = spark.logout();
        return assert.isFulfilled(promise)
          .then(() => {
            assert.calledOnce(spark.mercury.disconnect);
            assert.calledOnce(spark.device.unregister);
            assert.calledOnce(spark.boundedStorage.clear);
            assert.calledOnce(spark.unboundedStorage.clear);
            assert.calledOnce(spark.credentials.logout);
          });
      });

      it(`logouts the user, but does not redirect the user`, () => {
        const promise = spark.logout({noRedirect: true});
        return assert.isFulfilled(promise)
          .then(() => {
            assert.calledOnce(spark.mercury.disconnect);
            assert.calledOnce(spark.device.unregister);
            assert.calledOnce(spark.boundedStorage.clear);
            assert.calledOnce(spark.unboundedStorage.clear);
            assert.calledOnce(spark.credentials.logout);
            assert.calledWith(spark.credentials.logout, {noRedirect: true});
          });
      });
    });
  });
});
