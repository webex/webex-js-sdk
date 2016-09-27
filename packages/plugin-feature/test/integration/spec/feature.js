/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-feature`, function() {
  this.timeout(10000);
  let spark, spock;
  describe(`#setFeature()`, () => {

    before(() => testUsers.create({count: 1})
      .then((users) => {
        spock = users[0];
        spark = new CiscoSpark({
          credentials: {
            authorization: spock.token
          }
        });
        return spark.device.register();
      })
    );

    [
      `developer`,
      `user`
    ].forEach((keyType) => {
      it(`sets a value for a ${keyType} feature toggle`, () => {
        return spark.feature.setFeature(keyType, `testFeature`, false)
          .then((res) => {
            assert.equal(res.key, `testFeature`);
            assert.equal(res.val, `false`);
            assert.equal(res.value, false);
            assert.equal(res.type, `boolean`);

            assert.equal(spark.device.features[keyType].get({key: `testFeature`}).val, `false`);
            assert.becomes(spark.feature.getFeature(keyType, `testFeature`), false);
          });
      });
    });
  });
});
