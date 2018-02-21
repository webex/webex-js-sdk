/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import lolex from 'lolex';
import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import {Batcher} from '@ciscospark/spark-core';

function promiseTick(count) {
  let promise = Promise.resolve();
  while (count > 1) {
    promise = promise.then(() => promiseTick(1));
    count -= 1;
  }
  return promise;
}

describe('spark-core', () => {
  describe('Batcher', () => {
    let spark;
    const MockBatcher = Batcher.extend({
      namespace: 'mock',
      submitHttpRequest(payload) {
        return spark.request({
          service: 'mock',
          resource: '/batch',
          body: payload
        });
      },
      fingerprintRequest(req) {
        return Promise.resolve(req);
      },
      fingerprintResponse(res) {
        return Promise.resolve(res);
      }
    });

    const OutOfBandBatcher = MockBatcher.extend({
      handleHttpSuccess() {
        return Promise.resolve();
      },

      fingerprintRequest(req) {
        return Promise.resolve(req.id);
      },
      fingerprintResponse(res) {
        return Promise.resolve(res.id);
      }
    });

    const BATCHER_MAX_CALLS = 10;
    const BATCHER_MAX_WAIT = 5;
    const BATCHER_WAIT = 2;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          batcher: MockBatcher,
          outOfBandBatcher: OutOfBandBatcher
        }
      });

      spark.config.mock = {
        batcherMaxCalls: BATCHER_MAX_CALLS,
        batcherWait: BATCHER_WAIT,
        batcherMaxWait: BATCHER_MAX_WAIT
      };
    });

    let clock;
    beforeEach(() => {
      clock = lolex.install({now: Date.now()});
    });

    afterEach(() => {
      clock.uninstall();
    });

    describe('#request()', () => {
      it('coalesces requests made in a short time period into a single request', () => {
        const promises = [];
        spark.request.returns(Promise.resolve({body: [0, 1, 2]}));

        promises.push(spark.internal.batcher.request(0));
        assert.notCalled(spark.request);

        promises.push(spark.internal.batcher.request(1));
        assert.notCalled(spark.request);

        promises.push(spark.internal.batcher.request(2));
        assert.notCalled(spark.request);


        return promiseTick(50)
          .then(() => {
            clock.tick(1);
            assert.notCalled(spark.request);
            clock.tick(1);
            return promiseTick(50);
          })
          .then(() => {
            assert.calledOnce(spark.request);
            return Promise.all(promises);
          })
          .then((results) => {
            assert.lengthOf(results, 3);
            for (let i = 0; i < 3; i += 1) {
              assert.equal(results[i], i);
            }
            clock.tick(250);
            return promiseTick(50);
          })
          .then(() => {
            assert.calledOnce(spark.request);
          });
      });

      // This test is mostly here to make sure that unexpected failures (e.g.,
      // those cause by forgetting to wrap a return value in a Promise) don't
      // get squelched.
      it('propagates error from inside the call chain', () => {
        // This is way easier to prove if we don't need to control the clock
        clock.uninstall();
        sinon.stub(spark.internal.batcher, 'fingerprintResponse').throws(new Error('simulated failure'));
        spark.request.returns(Promise.resolve({body: [{id: 1}]}));
        return assert.isRejected(spark.internal.batcher.request({id: 1}), /simulated failure/);
      });

      describe('when the http request fails', () => {
        it('fails the whole batch', () => {
          const p1 = spark.internal.batcher.request(1);
          const p2 = spark.internal.batcher.request(2);
          // eslint-disable-next-line prefer-promise-reject-errors
          spark.request.returns(Promise.reject({statusCode: 0}));

          return promiseTick(50)
            .then(() => clock.tick(2))
            .then(() => promiseTick(50))
            .then(() => {
              assert.calledOnce(spark.request);
              return Promise.all([
                assert.isRejected(p1),
                assert.isRejected(p2)
              ]);
            });
        });
      });

      describe('when the number of request attempts exceeds a given threshold', () => {
        it('executes the batch request, regardless of the time passed', () => {
          const result = [];
          spark.request.returns(Promise.resolve({body: result}));

          const promises = [];
          // eslint-disable-next-line no-unmodified-loop-condition
          for (let i = 0; i < BATCHER_MAX_CALLS; i += 1) {
            result.push(i);
            promises.push(spark.internal.batcher.request(i));
            assert.notCalled(spark.request);
          }

          return promiseTick(50)
            .then(() => {
              assert.calledOnce(spark.request);
              return Promise.all(promises);
            })
            .then((results) => {
              assert.lengthOf(results, BATCHER_MAX_CALLS);
              // eslint-disable-next-line no-unmodified-loop-condition
              for (let i = 0; i < BATCHER_MAX_CALLS; i += 1) {
                assert.equal(results[i], i);
              }
              clock.tick(250);
              return promiseTick(50);
            })
            .then(() => {
              assert.calledOnce(spark.request);
            });
        });
      });

      describe('when the requests are requested continuously', () => {
        describe('when a configured time period is exceeded', () => {
          it('executes the batch request', () => {
            const promises = [];
            const result = [];
            // eslint-disable-next-line no-unmodified-loop-condition
            for (let i = 0; i < BATCHER_MAX_WAIT + 1; i += 1) {
              result.push(i);
            }
            spark.request.returns(Promise.resolve({body: result}));
            spark.request.onCall(1).returns(Promise.resolve({body: []}));

            return result.reduce((promise, i) => promise.then(() => {
              promises.push(spark.internal.batcher.request(i));
              clock.tick(1);
              return promiseTick(50);
            }), Promise.resolve())
              .then(() => {
                assert.calledOnce(spark.request);
                return Promise.all(promises);
              })
              .then((results) => {
                assert.lengthOf(results, BATCHER_MAX_WAIT + 1);

                // eslint-disable-next-line no-unmodified-loop-condition
                for (let i = 0; i < BATCHER_MAX_WAIT + 1; i += 1) {
                  assert.equal(results[i], i);
                }
                clock.tick(250);
                return promiseTick(50);
              })
              .then(() => {
                // This assertion is different than the other tests because
                // we've requestd enough requests that the normal debounce will
                // take over
                assert.calledTwice(spark.request);
              });
          });
        });

        describe('when the request attempts exceeds a given threshold', () => {
          it('executes the requests for the amount of max calls', () => {
            const result = [];
            spark.request.returns(Promise.resolve({body: result}));

            const promises = [];
            // eslint-disable-next-line no-unmodified-loop-condition
            for (let i = 0; i < BATCHER_MAX_CALLS * 2; i += 1) {
              result.push(i);
              promises.push(spark.internal.batcher.request(i));
            }

            return Promise.all(promises)
              .then((results) => {
                assert.calledTwice(spark.request);
                assert.lengthOf(spark.request.args[0][0].body, BATCHER_MAX_CALLS);
                assert.lengthOf(spark.request.args[1][0].body, BATCHER_MAX_CALLS);
                assert.lengthOf(results, BATCHER_MAX_CALLS * 2);
              });
          });
        });
      });

      describe('when the same request is made twice before the first one completes', () => {
        it('returns the same result', () => {
          spark.request.returns(Promise.resolve({body: [1]}));


          const p1 = spark.internal.batcher.request(1);
          const p2 = spark.internal.batcher.request(1);

          const promise = Promise.all([p1, p2]);

          return promiseTick(50)
            .then(() => {
              clock.tick(2);
              return promiseTick(50);
            })
            .then(() => {
              assert.calledOnce(spark.request);
              assert.deepEqual(spark.request.args[0][0], {
                service: 'mock',
                resource: '/batch',
                body: [1]
              });
              return promise
                .then((result) => assert.deepEqual(result, [1, 1]));
            });
        });
      });

      describe('when it\'s overridden to handle out-of-band responses', () => {
        it('resolves as expected', () => {
          sinon.spy(spark.internal.outOfBandBatcher, 'fingerprintResponse');
          const promise = spark.internal.outOfBandBatcher.request({id: 1});
          return promiseTick(50)
            .then(() => clock.tick(2))
            .then(() => {
              assert.called(spark.request);
              assert.notCalled(spark.internal.outOfBandBatcher.fingerprintResponse);
              spark.internal.outOfBandBatcher.acceptItem({id: 1, data: 2});
              return promiseTick(50);
            })
            .then(() => promise)
            .then((res) => {
              assert.deepEqual(res, {
                id: 1,
                data: 2
              });
            });
        });
      });
    });

    describe('#handleHttpError()', () => {
      it('handles a non SparkHttpError object passed', () => assert.isRejected(spark.internal.batcher.handleHttpError('simulated failure'), /simulated failure/));
    });
  });
});
