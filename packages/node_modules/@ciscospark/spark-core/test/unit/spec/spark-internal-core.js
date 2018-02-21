/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import Spark, {SparkPlugin, registerInternalPlugin} from '@ciscospark/spark-core';

describe('Spark', () => {
  describe('#internal', () => {
    it('grants plugins access to their namepace config', () => {
      registerInternalPlugin('test', SparkPlugin.extend({
        namespace: 'test'
      }), {replace: true});

      const spark = new Spark({
        config: {
          test: {
            reachable: true
          }
        }
      });

      assert.isTrue(spark.internal.test.config.reachable);
      spark.config.test.reachable = false;
      assert.isFalse(spark.internal.test.config.reachable);
    });

    it('controls ready status', () => {
      registerInternalPlugin('test', SparkPlugin.extend({
        namespace: 'test',
        session: {
          ready: {
            default: false,
            type: 'boolean'
          }
        }
      }), {replace: true});

      const spark = new Spark({
        config: {
          test: {
            reachable: true
          }
        }
      });

      spark.internal.on('all', (ev) => console.info('YYY', ev, spark.credentials.ready, spark.internal.test.ready, spark.internal.ready, spark.ready));
      spark.on('all', (ev) => console.info('XXX', ev, spark.credentials.ready, spark.internal.test.ready, spark.internal.ready, spark.ready));

      const changeSpy = sinon.spy();
      spark.on('change:ready', changeSpy);

      const readySpy = sinon.spy();
      spark.on('ready', readySpy);

      assert.isFalse(spark.internal.test.ready);
      assert.isFalse(spark.internal.ready);
      assert.isFalse(spark.ready);

      return new Promise((resolve) => spark.once('loaded', resolve))
        .then(() => {
          assert.isFalse(spark.internal.test.ready);
          assert.isFalse(spark.internal.ready);
          assert.isFalse(spark.ready);
          spark.internal.test.ready = true;
          assert.isTrue(spark.internal.ready);
          assert.isTrue(spark.ready);
          assert.called(changeSpy);
          assert.called(readySpy);
        });
    });
  });
});
