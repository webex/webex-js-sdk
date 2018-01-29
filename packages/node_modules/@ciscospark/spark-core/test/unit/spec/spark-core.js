/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import Spark, {
  MemoryStoreAdapter,
  registerPlugin,
  SparkPlugin
} from '@ciscospark/spark-core';
import {set} from 'lodash';
import {version} from '@ciscospark/spark-core/package';

describe('Spark', () => {
  let spark;
  beforeEach(() => {
    spark = new Spark();
  });

  describe('#logger', () => {
    it('exists', () => {
      assert.property(spark, 'logger');
      assert.doesNotThrow(() => {
        spark.logger.log('test');
      });
    });
  });

  describe('.version', () => {
    it('exists', () => {
      assert.property(Spark, 'version');
      assert.equal(Spark.version, version);
    });
  });

  describe('#version', () => {
    it('exists', () => {
      assert.property(spark, 'version');
      assert.equal(spark.version, version);
    });
  });

  describe('#credentials', () => {
    describe('#version', () => {
      it('exists', () => {
        assert.property(spark, 'credentials');
        assert.property(spark.credentials, 'version');
        assert.equal(spark.credentials.version, version);
      });
    });
  });

  describe('#initialize()', () => {
    it('initializes without arguments', () => {
      let spark;
      assert.doesNotThrow(() => {
        spark = new Spark();
      });
      assert.isFalse(spark.canAuthorize);
      assert.property(spark, 'credentials');
      assert.property(spark, 'canAuthorize');
      assert.property(spark.credentials, 'canAuthorize');
      assert.isFalse(spark.credentials.canAuthorize);
      assert.isFalse(spark.canAuthorize);
    });

    [
      'data',
      'data.access_token',
      'data.supertoken',
      'data.supertoken.access_token',
      'data.authorization',
      'data.authorization.supertoken',
      'data.authorization.supertoken.access_token',
      'data.credentials',
      'data.credentials.access_token',
      'data.credentials.supertoken',
      'data.credentials.supertoken.access_token',
      'data.credentials.authorization',
      'data.credentials.authorization.access_token',
      'data.credentials.authorization.supertoken',
      'data.credentials.authorization.supertoken.access_token'
    ].reduce((acc, path) => acc.concat(['ST', 'Bearer ST'].map((str) => {
      const obj = {
        msg: `accepts token string "${str}" at path "${path.split('.').slice(1).join('.')}"`
      };
      set(obj, path, str);
      return obj;
    })), [])
      .forEach(({msg, data}) => {
        it(msg, () => {
          const spark = new Spark(data);
          assert.isTrue(spark.credentials.canAuthorize);
          assert.equal(spark.credentials.supertoken.access_token, 'ST');
          assert.equal(spark.credentials.supertoken.token_type, 'Bearer');
          assert.isTrue(spark.canAuthorize);
        });
      });
  });


  it('emits the `loaded` event when the storage layer has loaded all data', () => {
    // I'd love to do this with mock spark, or at least, a mock plugin, but I
    // couldn't get it to work. We do get better coverage this way, but it means
    // that the storage tests are dependent on the credentials implementation.
    const spark = new Spark({
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
        }
      }
    });

    assert.isFalse(spark.loaded);
    assert.isFalse(spark.canAuthorize);
    return new Promise((resolve) => {
      spark.once('loaded', resolve);
    })
      .then(() => {
        assert.isTrue(spark.loaded);
        assert.equal(spark.credentials.supertoken.access_token, 'AT');
        assert.isTrue(spark.canAuthorize);
      });
  });

  it('emits the ready event when the storage layer has loaded and all plugins signal ready', () => {
    const spark = new Spark();
    assert.isFalse(spark.ready);

    return new Promise((resolve) => {
      spark.once('ready', resolve);
    })
      .then(() => assert.isTrue(spark.ready));
  });

  it('allows plugins to control ready status', () => {
    registerPlugin('test', SparkPlugin.extend({
      namespace: 'test',
      session: {
        ready: {
          default: false,
          type: 'boolean'
        }
      }
    }), {replace: true});

    const spark = new Spark();
    spark.on('all', (ev) => console.info('XXX', ev, spark.ready));

    const changeSpy = sinon.spy();
    spark.on('change:ready', changeSpy);

    const readySpy = sinon.spy();
    spark.on('ready', readySpy);

    assert.isFalse(spark.test.ready);
    assert.isFalse(spark.ready);

    return new Promise((resolve) => spark.once('loaded', resolve))
      .then(() => {
        assert.isFalse(spark.ready);
        assert.isFalse(spark.test.ready);
        spark.test.ready = true;
        assert.isTrue(spark.test.ready);
        assert.isTrue(spark.ready);
        assert.called(changeSpy);
        assert.called(readySpy);
      });
  });
});
