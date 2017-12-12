/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import {
  persist,
  SparkPlugin,
  waitForValue
} from '@ciscospark/spark-core';

describe('spark-core', () => {
  describe('@waitForValue', () => {
    it('prevents the method from executing until the specified value changes', () => {
      const MockChild = SparkPlugin.extend({
        props: {
          test: {
            default: false,
            type: 'boolean'
          }
        },

        namespace: 'MockChild',

        @persist('@')
        initialize(...args) {
          return Reflect.apply(SparkPlugin.prototype.initialize, this, args);
        },

        @waitForValue('@')
        testMethod() {
          return this.spark.request()
            .then(() => {
              this.test = true;
            });
        }
      });

      const spark = new MockSpark({
        children: {
          mockChild: MockChild
        }
      });

      let resolve;
      sinon.stub(spark.boundedStorage, 'get').returns(new Promise((r) => { resolve = r; }));

      spark.request.returns(Promise.resolve({
        body: {
          access_token: 'fake token @waitForValue',
          token_type: 'Bearer'
        }
      }));

      const promise = spark.internal.mockChild.testMethod();
      assert.notCalled(spark.request);
      assert.isFalse(spark.internal.mockChild.test);

      return new Promise((resolve) => setTimeout(resolve, 1))
        .then(() => {
          assert.notCalled(spark.request);
          assert.isFalse(spark.internal.mockChild.test);
          resolve();
          return new Promise((resolve) => setTimeout(resolve, 1));
        })
        .then(promise)
        .then(() => {
          assert.isTrue(spark.internal.mockChild.test);
          assert.called(spark.request);
        });
    });
  });
});
