/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-feature';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe('plugin-feature', function () {
  this.timeout(30000);
  let spark, spock;
  describe('#setFeature()', () => {
    before(() => testUsers.create({count: 1})
      .then((users) => {
        spock = users[0];
        spark = new CiscoSpark({
          credentials: {
            authorization: spock.token
          }
        });
        return spark.internal.device.register();
      }));

    [
      'developer',
      'user'
    ].forEach((keyType) => {
      it(`sets a value for a ${keyType} feature toggle`, () => spark.internal.feature.setFeature(keyType, 'testFeature', false)
        .then((res) => {
          assert.equal(res.key, 'testFeature');
          assert.equal(res.val, 'false');
          assert.equal(res.value, false);
          assert.equal(res.type, 'boolean');

          assert.equal(spark.internal.device.features[keyType].get({key: 'testFeature'}).val, 'false');
          return spark.internal.feature.getFeature(keyType, 'testFeature')
            .then((result) => assert.deepEqual(result, false));
        }));
    });
  });

  describe('#setBatchUserFeatures()', () => {
    before(() => testUsers.create({count: 1})
      .then((users) => {
        spock = users[0];
        spark = new CiscoSpark({
          credentials: {
            authorization: spock.token
          }
        });
        return spark.internal.device.register();
      }));

    const featureUpdateArray = [{
      key: 'key1',
      val: 'value1',
      type: 'USER',
      mutable: 'true'
    }, {
      key: 'key2',
      val: 'value2',
      mutable: 'false'
    }];

    it('sets a value for two user feature toggle', () => {
      spark.internal.feature.setFeature('user', 'key1', false);
      return spark.internal.feature.setBundledFeatures(featureUpdateArray)
        .then(() => Promise.all([
          spark.internal.feature.getFeature('user', 'key1')
            .then((result) => assert.deepEqual(result, 'value1')),
          spark.internal.feature.getFeature('user', 'key2')
            .then((result) => assert.deepEqual(result, 'value2'))
        ]));
    });
  });
});
