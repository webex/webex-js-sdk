/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import Spark, {
  MemoryStoreAdapter,
  SparkHttpError
} from '@ciscospark/spark-core';
import makeLocalUrl from '@ciscospark/test-helper-make-local-url';

describe('spark-core', function () {
  this.timeout(30000);
  describe('Spark', () => {
    describe('#request()', () => {
      let spark;
      before(() => {
        spark = new Spark();
      });

      it('adds a tracking id to each request', () => spark.request({
        uri: makeLocalUrl('/'),
        headers: {
          authorization: false
        }
      })
        .then((res) => {
          assert.property(res.options.headers, 'trackingid');
          // pattern is "spark-js-sdk", "uuid", "sequence number" joined with
          // underscores
          assert.match(res.options.headers.trackingid, /spark-js-sdk_[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}_\d+/);
        }));

      it('adds a spark-user-agent id to each request', () => spark.request({
        uri: makeLocalUrl('/'),
        headers: {
          authorization: false
        }
      })
        .then((res) => {
          assert.property(res.options.headers, 'spark-user-agent');
        }));

      it('fails with a SparkHttpError', () => assert.isRejected(spark.request({
        uri: makeLocalUrl('/not-a-route'),
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

          assert.property(err, 'options');
          assert.property(err.options, 'body');
          assert.property(err.options.body, 'proof');
          assert.isTrue(err.options.body.proof);
        }));
    });

    describe('#logout()', () => {
      let onBeforeLogoutFailedSpy, onBeforeLogoutSpy, spark;
      beforeEach(() => {
        onBeforeLogoutSpy = sinon.stub().returns(() => Promise.resolve());
        onBeforeLogoutFailedSpy = sinon.stub().returns(() => Promise.reject());
        // FIXME there may be a bug where initializing the sdk with credentials,
        // device, etc, doesn't write those values to the store.
        spark = new Spark({
          config: {
            storage: {
              boundedAdapter: MemoryStoreAdapter.preload({
                Credentials: {
                  '@': {
                    supertoken: {
                      // eslint-disable-next-line camelcase
                      access_token: 'AT'
                    }
                  }
                }
              })
            },
            onBeforeLogout: [
              {
                plugin: 'credentials',
                fn: onBeforeLogoutSpy
              },
              {
                plugin: 'mercury',
                fn: onBeforeLogoutFailedSpy
              }
            ]
          }
        });

        sinon.spy(spark.boundedStorage, 'clear');
        sinon.spy(spark.unboundedStorage, 'clear');

        return new Promise((resolve) => spark.once('ready', resolve))
          .then(() => {
            const supertoken = spark.credentials.supertoken;
            sinon.stub(spark.credentials.supertoken, 'revoke').callsFake(() => {
              supertoken.unset('access_token');
              return Promise.resolve();
            });
          });
      });

      it('invokes onBeforeLogout handlers', () => spark.logout()
        .then(() => {
          assert.called(onBeforeLogoutSpy);
          assert.called(onBeforeLogoutFailedSpy);
        }));

      it('invalidates all tokens', () => spark.logout()
        .then(() => {
          assert.calledOnce(spark.boundedStorage.clear);
          assert.calledOnce(spark.unboundedStorage.clear);
        }));

      it('clears all stores', () => spark.boundedStorage.get('Credentials', '@')
        .then((data) => {
          assert.isDefined(data.supertoken);
          assert.equal(data.supertoken.access_token, 'AT');
          return spark.logout();
        })
        .then(() => assert.isRejected(spark.boundedStorage.get('Credentials', '@'))));

      it('executes logout actions in the correct order', () => spark.boundedStorage.get('Credentials', '@')
        .then((data) => {
          assert.isDefined(data.supertoken);
          assert.equal(data.supertoken.access_token, 'AT');
          return spark.logout();
        })
        .then(() => assert.called(onBeforeLogoutSpy))
        .then(() => {
          assert.calledOnce(spark.boundedStorage.clear);
          assert.calledOnce(spark.unboundedStorage.clear);
        })
        .then(() => assert.isRejected(spark.boundedStorage.get('Credentials', '@'))));

      it('logs out gracefully even if token does not exist', () => {
        spark.credentials.supertoken = undefined;
        return spark.logout()
          .then(() => {
            assert.called(onBeforeLogoutSpy);
            assert.called(onBeforeLogoutFailedSpy);
          })
          .then(() => {
            assert.calledOnce(spark.boundedStorage.clear);
            assert.calledOnce(spark.unboundedStorage.clear);
          });
      });
    });
  });
});
