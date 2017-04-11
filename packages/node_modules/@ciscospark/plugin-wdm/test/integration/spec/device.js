/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-wdm`, function() {
  this.timeout(30000);
  describe(`Device`, () => {

    let spark;

    beforeEach(`create users`, () => testUsers.create({count: 1})
      .then((users) => {
        spark = new CiscoSpark({
          credentials: {
            authorization: users[0].token
          }
        });
      }));

    describe(`#register()`, () => {
      it(`registers a device`, () => spark.device.register()
        .then(() => {
          assert.property(spark.device, `modificationTime`);
          assert.property(spark.device, `services`);
          assert.property(spark.device, `url`);
          assert.property(spark.device, `userId`);
          assert.property(spark.device, `webSocketUrl`);
        }));
    });

    describe(`#refresh()`, () => {
      let modificationTime;
      beforeEach(() => spark.device.register()
        .then(() => {
          modificationTime = spark.device.modificationTime;
        }));

      it(`refreshes a device`, () => {
        const url = spark.device.url;
        return spark.device.refresh()
          .then(() => {
            assert.property(spark.device, `modificationTime`);
            assert.property(spark.device, `services`);
            assert.property(spark.device, `url`);
            assert.property(spark.device, `userId`);
            assert.property(spark.device, `webSocketUrl`);
            assert.notEqual(spark.device.modificationTime, modificationTime);
            assert.equal(spark.device.url, url, `Refreshing the device without sending the entire original payload must not give us a new registration`);
          });
      });

      it(`refreshes the device even if the device has expired`, () => {
        const url = spark.device.url;
        return spark.request({
          url,
          method: `DELETE`
        })
          .then(() => spark.device.refresh())
          .then(() => {
            assert.equal(spark.device.url, url);
          });
      });
    });

    describe(`#unregister()`, () => {
      it(`unregisters the device`, () => spark.device.register()
        .then(() => spark.device.unregister())
        .then(() => assert.isUndefined(spark.device.url)));
    });
  });
});
