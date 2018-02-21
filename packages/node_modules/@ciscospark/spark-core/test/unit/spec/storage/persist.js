/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import {
  persist,
  SparkPlugin
} from '@ciscospark/spark-core';

describe('spark-core', () => {
  describe('@persist', () => {
    it('writes the identified value into the store when the value changes', () => {
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
        }
      });

      const spark = new MockSpark({
        children: {
          mockChild: MockChild
        }
      });

      spark.internal.mockChild.test = true;

      return new Promise((resolve) => setTimeout(resolve, 1))
        .then(() => {
          assert.isTrue(spark.boundedStorage.data.MockChild['@'].test);
          spark.internal.mockChild.test = true;
          return new Promise((resolve) => setTimeout(resolve, 1));
        })
        .then(() => {
          assert.isTrue(spark.boundedStorage.data.MockChild['@'].test);
        });
    });
  });
});
