/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';

describe('spark-core', () => {
  describe('SparkPlugin', () => {
    let spark;
    beforeEach(() => {
      spark = new MockSpark({});
    });

    /* eslint require-jsdoc: [0] */
    const MockPlugin = SparkPlugin.extend({
      namespace: 'mock'
    });

    describe('#config', () => {
      it('proxies to the namespace-appropriate part of the spark config object', () => {
        spark.config.mock = {};
        const mock = new MockPlugin({}, {parent: spark});
        assert.equal(mock.config, spark.config.mock);
      });
    });

    describe('#logger', () => {
      it('proxies to the spark.logger', () => {
        const mock = new MockPlugin({}, {parent: spark});
        assert.equal(mock.logger, spark.logger);
      });
    });

    describe('#spark', () => {
      it('returns the primary spark instance', () => {
        const mock = new MockPlugin({}, {parent: spark});
        assert.isDefined(mock.spark);
        assert.equal(mock.spark, spark);
      });
    });
  });
});
